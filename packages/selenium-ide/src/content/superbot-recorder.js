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
  if(window.self === window.top){
    const modeIndicator = window.document.createElement('div');
    modeIndicator.id = 'superbot-mode-indicator';
    modeIndicator.innerText = modes[currentMode];
    modeIndicator.style.color = '#000';
    modeIndicator.style.backgroundColor = '#fff';
    modeIndicator.style.fontSize = '18px';
    modeIndicator.style.fontFamily = 'Arial, Helvetica, sans-serif';
    modeIndicator.style.fontWeight = 'bold';
    modeIndicator.style.width = '165px';
    modeIndicator.style.padding = '5px';
    modeIndicator.style.textAlign = 'center';
    modeIndicator.style.zIndex = 2147483647;
    modeIndicator.style.position = 'fixed';
    modeIndicator.style.top = '0px';
    modeIndicator.style.border = 'none';
    modeIndicator.style.boxShadow = 'rgba(0, 0, 0, 0.3) 4px 4px 3px -2px';
    modeIndicator.addEventListener(
      'mouseenter',
      function(event) {
        event.target.style.visibility = 'hidden'
        setTimeout(function() {
          event.target.style.visibility = 'visible'
        }, 1000)
      },
      false
    )
    window.document.body.appendChild(modeIndicator);
  }
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
    switch(currentMode){
      case 0: 
        recordCommand('click', [['css=' + cssPathBuilder(event.target)]], '');
      break;

      case 1:
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        recordCommand('verifyText', [['css=' + cssPathBuilder(event.target)]], event.target.value || event.target.innerText);
      break;

      case 2:
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        recordCommand('waitForElementPresent', [['css=' + cssPathBuilder(event.target)]], '7000');
      break;

      default: console.log('Current action mode not recognized:', currentMode); break;
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
      if(currentMode + 1 <= maxMode){
        currentMode++;
        elem.innerText = modes[currentMode];
        chrome.runtime.sendMessage({ type: 'setMode', mode: currentMode });
      } else if(currentMode + 1 > maxMode){
        currentMode = 0;
        elem.innerText = modes[currentMode];
        chrome.runtime.sendMessage({ type: 'setMode', mode: currentMode });
      }
    }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)