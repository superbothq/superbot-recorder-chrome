import addModeIndicator from './modeIndicator'
import cssPathBuilder from './cssPathBuilder'

chrome.runtime.sendMessage({ type: 'evaluateScripts' })

let attached = false
const EventHandlers = []

let currentModeIndex = 0;
const modes = ['recording', 'hover', 'assert text', 'wait for element']

const messageHandler = message => {
  if(message.type === 'attachSuperbotRecorder' && !attached){
    chrome.runtime.sendMessage({ type: 'getMode' }, savedModeIndex => {
      currentModeIndex = savedModeIndex;
      addModeIndicator(modes[currentModeIndex]);
    });
    attachEventHandlers();
    attached = true;
  }
}

const recordCommand = (command, targets, value) => {
  chrome.runtime.sendMessage({
    type: 'command',
    command: command,
    targets: targets,
    value: value
  })
}

const highlightElement = (coords) => {
  if(window.self !== window.top) return;
  const targetIndicator = window.document.createElement('div');
  targetIndicator.id = 'superbot-target-indicator';
  targetIndicator.style.position = 'absolute';
  targetIndicator.style.top = `${coords.y}px`;
  targetIndicator.style.left = `${coords.x}px`;
  targetIndicator.style.width = `${coords.width}px`;
  targetIndicator.style.height = `${coords.height}px`;
  targetIndicator.style.backgroundColor = '#77dd777F';
  targetIndicator.style.display = 'block';
  window.document.body.appendChild(targetIndicator);
  setTimeout(() => {
    targetIndicator.remove();
  }, 150);
}

const advanceCurrentMode = (targetMode = null) => {
  const elem = document.getElementById('superbot-mode-indicator').children[1];
  if(targetMode !== null){
    currentModeIndex = modes.findIndex(currentMode => currentMode === targetMode);
  } else {
    currentModeIndex = currentModeIndex + 1 <= modes.length-1 ? currentModeIndex + 1 : 0
  }
  elem.innerText = 'Current mode: ' + modes[currentModeIndex];
}

const addEventHandler = (type, handler) => {
  EventHandlers.push({
    type: type,
    handler: handler
  })
}

const attachEventHandlers = () => {
  addEventHandler('keydown', (event) => {
    if(event.target.tagName.toLowerCase() === 'input' && event.keyCode === 13){
      const selector = [['css=' + cssPathBuilder(event.target)]]
      if(event.target.value !== null && event.target.value !== ''){
        recordCommand('type', selector, event.target.value)
      }
      
      recordCommand('sendKeys', selector, '${KEY_ENTER}')
    }
  })

  addEventHandler('click', event => {
    if(modes[currentModeIndex] !== 'recording'){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    const coords = event.target.getBoundingClientRect();
    highlightElement(coords);
    recordCommand('click', [['css=' + cssPathBuilder(event.target)]], '');
    advanceCurrentMode('wait for element');
    chrome.runtime.sendMessage({ type: 'setMode', mode: currentModeIndex });
    chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
  })
  
  addEventHandler('mousemove', event => {
    if(modes[currentModeIndex !== 'recording']) return;

    chrome.runtime.sendMessage({ type: 'updateMousePos', coordinates: { x: event.clientX, y: event.clientY, time: new Date().getTime() }})
  })

  addEventHandler('keydown', event => {
    if(event.target.tagName.toLowerCase() === 'input' || event.keyCode !== 32) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      advanceCurrentMode();
      chrome.runtime.sendMessage({ type: 'setMode', mode: currentModeIndex });
      
      if(modes[currentModeIndex] === 'recording'){
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
      } else {
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
      }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)