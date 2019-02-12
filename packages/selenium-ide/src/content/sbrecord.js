import { addRecordingIndicator } from './recordingIndicator'
import LocatorBuilder from './locatorBuilders'

const EventHandlers = []
const locatorBuilder = new LocatorBuilder(window)

const attachRecorder = (message, sender, sendResponse) => {
  if(message.type === 'attachSuperbotRecorder'){
    addRecordingIndicator()
    attachEventHandlers()
    attached = true
    sendResponse(true)
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
      if(event.target.value !== null && event.target.value !== ''){
        recordCommand('type', locatorBuilder.buildAll(event.target), event.target.value)
      }
      
      recordCommand('sendKeys', locatorBuilder.buildAll(event.target), '${KEY_ENTER}')
    }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(attachRecorder)

const debugChannel = (obj) => {
  chrome.runtime.sendMessage({
    type: 'debug',
    obj: obj
  })
}