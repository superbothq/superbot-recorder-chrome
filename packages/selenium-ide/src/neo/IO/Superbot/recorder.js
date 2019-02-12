import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'

const cssPathBuilder = `
var cssPathBuilder = function (el) {
  if (!(el instanceof Element) || el === null || el === undefined){
    return;
  }
  var path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    var selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break;
    } else {
      var sib = el, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() == selector)
          nth++;
      }
      if (nth != 1)
        selector += ":nth-of-type(" + nth + ")";
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}`

export default class SuperbotRecorder {
  constructor(){
    this.currentWindow = null
    this.debugTarget = null
    this.recordOpenStep = true
    this.stateChecksInterval = null

    chrome.runtime.onMessage.addListener(this.commandMessageHandler)
    chrome.tabs.onUpdated.addListener(this.tabsOnUpdatedHandler)
    chrome.debugger.onEvent.addListener(this.debugCommandHandler)
    chrome.webNavigation.onBeforeNavigate.addListener(this.handleNavigation)
  }

  createRecordingWindow = () => {
    return new Promise((resolve) => {
      chrome.windows.create({ url: 'about:blank' }, (_window) => {
        this.currentWindow = _window
        resolve()
      })
    })
  }

  removeRecordingWindow = () => {
    try {
      if(this.currentWindow === null){
        return
      }
      chrome.windows.remove(this.currentWindow.id)
    } catch(e) {
      console.log('removeRecordingWindow error:', e)
    }
  }

  stateChecks = () => {
    try {
      this.stateChecksInterval = setInterval(() => {
        if(UiState.isRecording === false){
          this.stopRecording()
          return
        }
        chrome.tabs.query({ windowId: this.currentWindow.id }, (windowInfo) => {
          if(windowInfo.length === 0){
            this.currentWindow = null
            this.stopRecording()
            UiState.toggleSuperbotRecording()
            return
          }
        })
      }, 500)
    } catch(e) {
      console.log('stateChecks error:', e)
    }
  }

  start = async () => {
    try {
      await this.createRecordingWindow()
      this.stateChecks()
      this.attachDebugger()
      chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
    } catch(e) {
      console.log('Failed to attach recorder:', e)
    }
  }

  stopRecording = () => {
    try {
      clearInterval(this.stateChecksInterval)
      this.stateChecksInterval = null
      this.recordOpenStep = true

      this.recordCommand('close', [['']], '')

      chrome.debugger.detach(this.debugTarget, () => {
        if(this.currentWindow !== null){
          this.removeRecordingWindow()
          this.currentWindow = null
        }
      })
      this.debugTarget = null
    } catch(e) {
      console.log('stopRecording error:', e)
    }
  }

  tabsOnUpdatedHandler = (tabId, changeInfo, tab) => {
    if(this.currentWindow === null || this.debugTarget === null){
      return
    }
    if(tabId === this.currentWindow.tabs[0].id && changeInfo.status === 'complete'){
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight)
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
      chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
    }
  }

  debugCommandHandler = (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
      chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', { backendNodeId: params.backendNodeId }, (boxModelData) => {
        const dimensions = {
          x: boxModelData.model.content[0],
          y: boxModelData.model.content[1],
        }

        chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', { expression: cssPathBuilder, includeCommandLineAPI: true})
  
        const getCSSPathAndClickElem = `
          window.currentElem = document.elementFromPoint(${dimensions.x}, ${dimensions.y});
          window.currentSelector = cssPathBuilder(window.currentElem);
          window.currentElem.click();
          window.currentElem = null;
          window.currentSelector;`
        chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', { expression: getCSSPathAndClickElem, includeCommandLineAPI: true }, (selector) => {
          this.recordCommand('click', [['css=' + selector.result.value]], '')
        })
      })
    }
  }

  handleNavigation = (target) => {
    if(this.currentWindow === null){
      return
    }
    if(target.tabId === this.currentWindow.tabs[0].id &&
      UiState.displayedTest.commands.length === 0 &&
      target.url !== 'about:blank'){
      this.recordCommand('open', [[target.url]], '')
    }
  }

  attachDebugger = () => {
    try {
      chrome.debugger.getTargets(targets => {
        const newTarget = targets.filter(target => target.tabId === this.currentWindow.tabs[0].id)[0]
        this.debugTarget = {
          targetId: newTarget.id
        }

        if(!newTarget.attached){
          chrome.debugger.attach(this.debugTarget, '1.3')
        }
      })
    } catch(e) {
      console.log('attachDebugger error:', e)
    }
  }

  recordCommand = (command, targets, value) => {
    const test = UiState.displayedTest

    const newCommand = test.createCommand(test.commands.length)
    
    newCommand.setCommand(command)
    newCommand.setTarget(targets[0][0])
    newCommand.setValue(value)

    UiState.lastRecordedCommand = newCommand

    return newCommand
  }

  commandMessageHandler = (message, sender, sendResponse) => {
    if(!message.command || sender.tab.id !== this.currentWindow.tabs[0].id){
      return
    }

    console.log('Command recorded:', message)
    
    const { command, targets, value } = message
    const newCommand = this.recordCommand(command, targets, value)
    if (Commands.list.has(command)) {
      const type = Commands.list.get(command).target
      if (type && type.name === ArgTypes.locator.name) {
        newCommand.setTargets(targets)
      }
    }

    sendResponse(true)
  }
}