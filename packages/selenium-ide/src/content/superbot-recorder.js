import addModeIndicator, { removeModeIndicator } from './modeIndicator'
import LocatorBuilders from './locatorBuilders'
import addActionNotification from './actionNotification';
const locatorBuilders = new LocatorBuilders(window)

let attached = false
let currentMode = null;
const modes = ['recording: select target', 'recording: click element', 'drag', 'hover', 'assert text', 'wait for element']
const eventHandlers = [];

const messageHandler = (message, sender, sendResponse) => {
  switch(message.type){
    case 'attachSuperbotRecorder':
      if(!attached){
        currentMode = message.mode;
        chrome.runtime.sendMessage({
          type: 'debuggerCommand',
          enabled: currentMode === 'drag' ||
          currentMode === 'recording: click element' ? false : true
        })
        addModeIndicator(currentMode);
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

    case 'updateMode': {
      console.log('updateMode:', message.mode)
      currentMode = message.mode
      const modeIndicator = document.getElementById('superbot-mode-indicator');
      if(modeIndicator !== null){
        modeIndicator.contentDocument.body.children[1].innerText = currentMode;
      }
      if(currentMode === 'recording: click element' || currentMode === 'drag'){
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
      } else {
        chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
      }
    } break;

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

    case 'pollAlive':
      sendResponse(true)
    break;

    case 'stopRecording':
      detachEventListeners();
      removeModeIndicator();
      attached = false;
      currentMode = null;
    break
  }
}

const recordCommand = (command, targets, value, coordinates) => {
  console.log('recordCommand command:', command)
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
    if(currentMode === 'recording: click element' || currentMode === 'drag'){
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: false })
    } else {
      chrome.runtime.sendMessage({ type: 'debuggerCommand', enabled: true })
    }
  } catch(e){
    console.log(e)
  }
}

const attachEventHandlers = () => {
  if(eventHandlers.length == 0){
    eventHandlers.push({ event: 'keyup', handler: (event) => {
      console.log('event.target.value:', event.target.value)
      console.log('event.keyCode:', event.keyCode)
      if(!event.target.value || event.target.value === '' || event.keyCode === 17){
        if(event.keyCode !== 13 && event.keyCode !== 8){
          return
        }
      }
    
      if(event.keyCode === 13){
        recordCommand('sendKeys', locatorBuilders.buildAll(event.target), '${KEY_ENTER}')
      } else {
        recordCommand('type', locatorBuilders.buildAll(event.target), event.target.value);
      }
    }})

    eventHandlers.push({ event: 'click', handler: (event) => {
      if(currentMode !== 'recording: click element'){
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
    }})

    eventHandlers.push({ event: 'scroll', handler: (event) => {
      //console.log('document scroll event!')
      recordCommand('scroll', [['window']], window.pageYOffset.toString())
    }})

    eventHandlers.push({ event: 'mousemove', handler: (event) => {
      if(currentMode !== 'recording: click element') return;

      chrome.runtime.sendMessage({
        type: 'updateMousePos',
        coordinates: {
          x: event.clientX,
          y: event.clientY,
          time: new Date().getTime()
        }
      })
    }})

    let isMouseDown = false;
    let mouseDownEvent = null;
    let dragCoordinates = [];
    eventHandlers.push({ event: 'mousedown', handler: (event) => {
      console.log('mousedown!')
      isMouseDown = true;
      mouseDownEvent = event
    }})

    eventHandlers.push({ event: 'mousemove', handler: (event) => {
      console.log('currentMode:', currentMode)
      console.log('isMouseDown:', isMouseDown)
      if(currentMode !== 'drag' || !isMouseDown) return;
      console.log('mousemove!')
      //record time step and coordinate
      dragCoordinates.push({ 
        pos: { x: event.x, y: event.y },
        time: event.timeStamp
      });
    }})

    eventHandlers.push({ event: 'mouseup', handler: (event) => {
      console.log('mouseup!')
      if(isMouseDown && mouseDownEvent && dragCoordinates.length > 0){
        recordCommand('drag', locatorBuilders.buildAll(mouseDownEvent.target), dragCoordinates);
      }
      isMouseDown = false;
      mouseDownEvent = null;
      dragCoordinates = [];
    }})

    eventHandlers.push({ event: 'dragend', handler: (event) => {
      console.log('dragend!');
      if(isMouseDown && mouseDownEvent && dragCoordinates.length > 0){
        recordCommand('drag', locatorBuilders.buildAll(mouseDownEvent.target), dragCoordinates);
      }
      isMouseDown = false;
      mouseDownEvent = null;
      dragCoordinates = [];
    }})

    let dragStartTarget = null;
    eventHandlers.push({ event: 'dragstart', handler: (event) => {
      dragStartTarget = event.target;
    }})

    eventHandlers.push({ event: 'drop', handler: (event) => {
      if (dragStartTarget && dragStartTarget !== event.target && event.button == 0){
        recordCommand('dragAndDropToObject', locatorBuilders.buildAll(dragStartTarget), locatorBuilders.build(event.target));
      }
      dragStartTarget = null;
    }})

    eventHandlers.push({ event: 'keydown', handler: (event) => {
      console.log('keydown:', event.key)
      if(event.keyCode !== 17) return;
    
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    
        advanceCurrentMode();
    }})
  }

  for(let i = 0; i < eventHandlers.length; i++){
    document.addEventListener(eventHandlers[i].event, eventHandlers[i].handler, true);
  }
}

const detachEventListeners = () => {
  for(let i = 0; i < eventHandlers.length; i++){
    document.removeEventListener(eventHandlers[i].event, eventHandlers[i].handler, true);
  }
}

chrome.runtime.onMessage.addListener(messageHandler);
chrome.runtime.sendMessage({ type: 'getMode' }, (mode) => {
  if(mode){
    currentMode = mode;
    chrome.runtime.sendMessage({ type: 'evaluateScripts' })
  }
})