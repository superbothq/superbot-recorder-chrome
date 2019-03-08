import { addRecordingIndicator } from './recordingIndicator'
import cssPathBuilder from './cssPathBuilder'

chrome.runtime.sendMessage({ type: 'evaluateScripts' })

const EventHandlers = []
let attached = false

//Mode Indicator
const modes = ['click', 'verify text', 'wait for element']
let currentMode = 0;
const maxMode = modes.length-1;

const messageHandler = (message, sender, sendResponse) => {
  if(message.type === 'attachSuperbotRecorder' && !attached){
    addRecordingIndicator();
    chrome.runtime.sendMessage({ type: 'getMode' }, (res) => {
      if(res !== 0){
        currentMode = res;
      }
      addModeIndicator();
    });
    attachEventHandlers();
    attached = true;
    sendResponse(attached);
  }
}
const addModeIndicator = () => {
  if(window.self !== window.top) return;

  const modeIndicator = window.document.createElement('div');
  modeIndicator.id = 'superbot-mode-indicator';
  modeIndicator.innerText = 'Current mode: ' + modes[currentMode];
  modeIndicator.style.color = '#333';
  //modeIndicator.style.backgroundColor = '#fff';
  modeIndicator.style.fontSize = '16px';
  modeIndicator.style.fontFamily = 'Arial, Helvetica, sans-serif';
  modeIndicator.style.fontWeight = 'bold';
  modeIndicator.style.width = '277px';
  modeIndicator.style.padding = '5px';
  modeIndicator.style.textAlign = 'center';
  modeIndicator.style.zIndex = 2147483647;
  modeIndicator.style.position = 'fixed';
  //modeIndicator.style.top = '0px';
  modeIndicator.style.bottom = '40px';
  modeIndicator.style.right = '40px';
  modeIndicator.style.border = 'none';
  modeIndicator.style.margin = 'initial';
  modeIndicator.style.backgroundColor = 'initial';
  modeIndicator.style.borderRadius = 'initial';
  //modeIndicator.style.boxShadow = 'rgba(0, 0, 0, 0.3) 4px 4px 3px -2px';
  document.getElementById('selenium-ide-indicator').addEventListener(
    'mouseenter',() => {
      modeIndicator.style.visibility = 'hidden'
      setTimeout(function() {
        modeIndicator.style.visibility = 'visible'
      }, 1000)
    },
    false
  )
  window.document.body.appendChild(modeIndicator);
}

const highlightElement = (elem) => {
  if(window.self !== window.top) return;

  elem.style.border = '10px solid green';
  setTimeout(() => {
    elem.style.border = 'initial';
  }, 150)

}

const addEventHandler = (type, handler) => {
  EventHandlers.push({
    type: type,
    handler: handler
  })
}

const recordCommand = (command, targets, value) => {
  chrome.runtime.sendMessage({
    type: 'command',
    command: command,
    targets: targets,
    value: value
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
    highlightElement(event.target);
    if(modes[currentMode] === 'click'){
      recordCommand(modes[currentMode], [['css=' + cssPathBuilder(event.target)]], '');
    } else {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const command = modes[currentMode] === 'verify text' ? 'verifyText' : 'waitForElementPresent';
      const value = modes[currentMode] === 'verify text' ? (event.target.value || event.target.innerText) : '7000';
      recordCommand(command, [['css=' + cssPathBuilder(event.target)]], value);
    }
  })
  
  addEventHandler('mousemove', event => {
    chrome.runtime.sendMessage({ type: 'updateMousePos', coordinates: { x: event.clientX, y: event.clientY, time: new Date().getTime() }})
  })

  addEventHandler('keydown', event => {
    if(event.target.tagName.toLowerCase() !== 'input' && event.keyCode === 32){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const elem = document.getElementById('superbot-mode-indicator');
      currentMode = currentMode + 1 <= maxMode ? currentMode + 1 : 0
      elem.innerText = 'Current mode: ' + modes[currentMode];
      chrome.runtime.sendMessage({ type: 'setMode', mode: currentMode });
    }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)