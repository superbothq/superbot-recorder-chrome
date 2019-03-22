import addModeIndicator from './modeIndicator'
import cssPathBuilder from './cssPathBuilder'

chrome.runtime.sendMessage({ type: 'evaluateScripts' })

let attached = false
const EventHandlers = []

let currentMode = null;
const modes = ['recording', 'hover', 'assert text', 'wait for element']

const messageHandler = (message, sender, sendResponse) => {
  if(message.type === 'attachSuperbotRecorder' && !attached){
    chrome.runtime.sendMessage({ type: 'getMode' }, savedMode => {
      currentMode = savedMode;
      if(currentMode !== 'recording'){
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
      }
      addModeIndicator(currentMode);
    });
    attachEventHandlers();
    attached = true;
  } else if(message.type === 'toggleRecordingIndicator'){
    if(message.enabled){
      addModeIndicator(currentMode);
    } else {
      const modeIndicator = document.getElementById('superbot-mode-indicator');
      if(modeIndicator !== null){
        modeIndicator.remove();
      }
      sendResponse(true)
    }
  } else if(message.type === 'updateMode'){
    currentMode = message.mode
    const modeIndicator = document.getElementById('superbot-mode-indicator');
    if(modeIndicator !== null){
      modeIndicator.contentDocument.body.children[1].innerText = `Current mode: ${currentMode}`;
    }
    if(currentMode === 'recording'){
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
    }
  }
}

const recordCommand = (command, targets, value, coords) => {
  chrome.runtime.sendMessage({
    type: 'command',
    command: command,
    targets: targets,
    value: value,
    coords: coords
  })
}

const advanceCurrentMode = (targetMode = null) => {
  try {
    const modeIndicator = document.getElementById('superbot-mode-indicator');
    if(targetMode !== null){
      currentMode = targetMode;
    } else {
      const index = modes.findIndex(m => m === currentMode);
      if(index + 1 > modes.length - 1){
        currentMode = modes[0];
      } else {
        currentMode = modes[index + 1];
      }
    }
    modeIndicator.contentDocument.body.children[1].innerText = 'Current mode: ' + currentMode;
    chrome.runtime.sendMessage({ type: 'setMode', mode: currentMode });
    if(currentMode === 'recording'){
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
    } else {
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
    }
  } catch(e){
    console.log(e)
  }
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
    if(currentMode !== 'recording'){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    const coords = event.target.getBoundingClientRect();
    if(coords.width === 0 || coords.height === 0) return;

    recordCommand('click', [['css=' + cssPathBuilder(event.target)]], '', coords);
  })
  
  addEventHandler('mousemove', event => {
    if(currentMode !== 'recording') return;

    chrome.runtime.sendMessage({ type: 'updateMousePos', coordinates: { x: event.clientX, y: event.clientY, time: new Date().getTime() }})
  })

  addEventHandler('keydown', event => {
    if(event.keyCode !== 17) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      advanceCurrentMode();
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)