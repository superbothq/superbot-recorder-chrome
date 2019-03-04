import { addRecordingIndicator } from './recordingIndicator'
import cssPathBuilder from './cssPathBuilder'

// tell extension to evaluate scripts needed for creating selectors later on
chrome.runtime.sendMessage({ type: 'exec' })

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
  const modeIndicator = window.document.createElement('div');
  modeIndicator.id = 'superbot-mode-indicator';
  modeIndicator.innerText = modes[currentMode];
  modeIndicator.style.color = '#000';
  modeIndicator.style.backgroundColor = '#fff';
  modeIndicator.style.fontSize = '17px';
  modeIndicator.style.fontFamily = 'Arial, Helvetica, sans-serif';
  modeIndicator.style.fontWeight = 'bold';
  modeIndicator.style.width = '210px';
  modeIndicator.style.padding = '5px';
  modeIndicator.style.textAlign = 'center';
  modeIndicator.style.zIndex = 2147483647;
  modeIndicator.style.position = 'fixed';
  modeIndicator.style.top = '5px';
  modeIndicator.style.border = 'none';
  window.document.body.appendChild(modeIndicator);

  window.addEventListener('keydown', event => {
    event.preventDefault();
    console.log('modeIndicator:', event);  
    if(event.target.tagName.toLowerCase() !== 'input' && event.keyCode === 32){
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
  }, true)
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
        recordCommand('waitForElementPresent', [['css=' + cssPathBuilder(event.target)]], '7');
      break;

      default: console.log('wat???', currentMode); break;
    }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)