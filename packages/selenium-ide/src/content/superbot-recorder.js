import addModeIndicator from './modeIndicator'
import LocatorBuilders from './locatorBuilders'
import addActionNotification from './actionNotification';
const locatorBuilders = new LocatorBuilders(window)

chrome.runtime.sendMessage({ type: 'evaluateScripts' })

let attached = false
const EventHandlers = []

let currentMode = null;
const modes = ['recording: select target', 'recording: click element', 'hover', 'assert text', 'wait for element']

const messageHandler = (message, sender, sendResponse) => {
  switch(message.type){
    case 'attachSuperbotRecorder':
      if(!attached){
        chrome.runtime.sendMessage({ type: 'getMode' }, savedMode => {
          currentMode = savedMode;
          if(currentMode !== 'recording: click element'){
            chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
          }
          addModeIndicator(currentMode);
        });
        attachEventHandlers();
        attached = true;
      }
    break;

    case 'toggleRecordingIndicator':
      if(message.enabled){
        addModeIndicator(currentMode);
      } else {
        const modeIndicator = document.getElementById('superbot-mode-indicator');
        if(modeIndicator !== null){
          modeIndicator.remove();
        }
        sendResponse(true)
      }
    break;

    case 'updateMode':
      currentMode = message.mode
      const modeIndicator = document.getElementById('superbot-mode-indicator');
      if(modeIndicator !== null){
        modeIndicator.contentDocument.body.children[1].innerText = currentMode;
      }
      if(currentMode === 'recording: click element'){
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
      } else {
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
      }
    break;

    case 'notificationVisible':
      try {
        const nc = document.getElementById('superbot-action-notification');
        if(nc !== null){
          nc.remove();
        }
        addActionNotification(message.message);
      } catch(e){
        console.log('Message - notificationVisible error:', e);
      }
    break;
  }
}

const recordCommand = (command, targets, value, coordinates) => {
  chrome.runtime.sendMessage({
    type: 'command',
    command: command,
    targets: targets,
    value: value,
    coordinates: coordinates
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
    modeIndicator.contentDocument.body.children[1].innerText = currentMode;
    chrome.runtime.sendMessage({ type: 'setMode', mode: currentMode });
    if(currentMode === 'recording: click element'){
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
    } else {
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
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
  addEventHandler('keyup', event => {
    if(event.target.value === '' || event.target.value === undefined || event.target.value === null){
      if(event.keyCode !== 13 && event.keyCode !== 8){
        return;
      }
    }

    if(event.keyCode === 13){
      recordCommand('sendKeys', locatorBuilders.buildAll(event.target), '${KEY_ENTER}')
    } else {
      recordCommand('type', locatorBuilders.buildAll(event.target), event.target.value);
    }
  })

  addEventHandler('click', (event) => {
    if(currentMode !== 'recording: click element'){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    } else {
      for(let i = 0; i < event.path.length; i++){
        if(event.path[i].id === 'screenshot-preview-container'){
            return;
        }
        if(event.path[i].id === 'superbot-action-notification'){
          return;
        }
      }
    }

    const coordinates = event.target.getBoundingClientRect();
    recordCommand('click', locatorBuilders.buildAll(event.target), '', coordinates);
  })
  
  addEventHandler('mousemove', event => {
    if(currentMode !== 'recording: click element') return;

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