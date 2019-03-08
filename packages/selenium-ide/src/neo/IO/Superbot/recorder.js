import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'
/*
const cssPathBuilder = `
  const cssPathBuilder = (el) => {
    if (!(el instanceof Element)){
      return;
    }
    const path = [];
    while (el !== null && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
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
  }
`
*/
const nodeResolver = `
  const nodeResolver = (el) => {
    //return first matching targeted element
    if(typeof el.click === 'function'){
      return el
    } else {
      //return first matching parent element
      let pNode = el.parentNode
      while(typeof pNode.click !== 'function'){
        pNode = pNode.parentNode
      }
      return pNode
    }
  }
`

export default class SuperbotRecorder {
  constructor(){
    this.currentWindow = null
    this.debugTarget = null
    this.recordOpenStep = true
    this.scripts = []
    this.mouseCoordinates = []
    this.currentMode = 0;

    chrome.runtime.onMessage.addListener(this.messageHandler)
    chrome.debugger.onEvent.addListener(this.debuggerCommandHandler)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if(this.recordOpenStep && !tab.url.includes('chrome://') && !tab.url.includes('chrome-extension://')){
        this.recordCommand('open', [[tab.url]], '')
        this.attachDebugger()
        this.recordOpenStep = false
      }
    })
  }

  createRecordingWindow = () => {
    return new Promise((resolve) => {
      chrome.windows.create({ url: 'chrome://newtab/' }, (_window) => {
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
      const stateChecksInterval = setInterval(() => {
        if(UiState.isSuperbotRecording === false){
          this.stopRecording()
          return clearInterval(stateChecksInterval);
        }
        chrome.tabs.query({ windowId: this.currentWindow.id }, (windowInfo) => {
          if(windowInfo.length === 0){
            this.currentWindow = null
            this.stopRecording()
            UiState.toggleSuperbotRecording()
            clearInterval(stateChecksInterval);
          }
        })
      }, 250)
    } catch(e) {
      console.log('stateChecks error:', e)
    }
  }

  start = async () => {
    try {
      await this.createRecordingWindow()
      this.stateChecks()
      chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
    } catch(e) {
      console.log('Failed to attach recorder:', e)
    }
  }

  stopRecording = () => {
    clearInterval(this.stateChecksInterval)
    this.recordOpenStep = true

    this.recordCommand('close', [['']], '')

    chrome.debugger.detach(this.debugTarget, () => {
      if(this.currentWindow !== null){
        this.removeRecordingWindow()
        this.currentWindow = null
      }
      if(chrome.runtime.lastError !== undefined)
        console.log('runtime.lastError:', chrome.runtime.lastError)
    })
    this.debugTarget = null
  }


  attachDebugger = () => {
    chrome.debugger.getTargets(targets => {
      const newTarget = targets.filter(target => target.tabId === this.currentWindow.tabs[0].id)[0]
      this.debugTarget = {
        targetId: newTarget.id
      }

      if(!newTarget.attached){
        chrome.debugger.attach(this.debugTarget, '1.3', () => {
          if(chrome.runtime.lastError !== undefined)
            console.log('debugger attach error:', chrome.runtime.lastError) 
        })
      }
    })
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

  messageHandler = (message, sender, sendResponse) => {
    if(this.currentWindow === null || sender.tab.id !== this.currentWindow.tabs[0].id || message.type === undefined) return;

    switch(message.type){
      case 'command':
        console.log('Command received:', message);
        this.commandHandler(message.command, message.targets, message.value);      
        sendResponse(true);
      break;

      case 'setMode':
        console.log('Set mode:', message);  
        this.currentMode = message.mode;
        sendResponse(true);
      break;

      case 'getMode':
        sendResponse(this.currentMode);
      break;

      case 'updateMousePos':
        this.mouseCoordinates.push(message.coordinates)
      break;

      case 'debuggerCommand':
        this.switchDebuggerHighlight(message.enabled);
      break;

      case 'evaluateScripts':
        console.log('Evaluate scripts request received:', message);
        chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
      break;

      default: console.log('Message type not recognized:', message.type); break;
    }
  }

  //handle recorded commands that are sent from content scripts
  commandHandler = (command, targets, value) => {
    console.log('Command recorded:', command, targets, value)

    //prevent recoding commands before open-step is recorded
    if(UiState.displayedTest.commands.length === 0){
      return
    }

    const newCommand = this.recordCommand(command, targets, value)
    if (Commands.list.has(command)) {
      const type = Commands.list.get(command).target
      if (type && type.name === ArgTypes.locator.name) {
        newCommand.setTargets(targets)
      }
    }
  }

  switchDebuggerHighlight = (enabled = true) => {
    if(enabled){
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight)
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
    } else {
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.disable')
    }
  }
  
  //handle commands that are sent from debugger
  debuggerCommandHandler = (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
      //prevent recoding commands before open-step is recorded
      if(UiState.displayedTest.commands.length === 0){
        return
      }
      chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
        backendNodeId: params.backendNodeId
      }, async (boxModelData) => {
        const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
        const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)
  
        const action = await this.getElementAction();
        let exec = null;
        switch(action){
          case 'click': 
            exec = `
              window.elem = nodeResolver(document.elementFromPoint(${pointX}, ${pointY}));
              window.selector = cssPathBuilder(window.elem);
              window.elem.click();
              window.elem = null;
              window.selector;
            `;
          break;

          case 'doubleClick':
            exec = `
              window.elem = nodeResolver(document.elementFromPoint(${pointX}, ${pointY}));
              window.selector = cssPathBuilder(window.elem);
              window.elem.click();
              window.elem.click();
              window.elem = null;
              window.selector;
            `;
          break;

          case 'waitForElementPresent':
            exec = `cssPathBuilder(nodeResolver(document.elementFromPoint(${pointX}, ${pointY})));`;
          break;

          case 'verifyText':
            exec = `
              window.elem = nodeResolver(document.elementFromPoint(${pointX}, ${pointY}));
              window.selector = cssPathBuilder(window.elem);
              window.text = window.elem.innerText;
              window.elem = null;
              JSON.stringify({ selector: window.selector, text: window.text })
            `;
          break;

          case 'cancel':
            return;
          break;

          default: return console.log('Action not recognized:', action); break;
        }
        
        //passthrough users click and get element selector
        chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', {
          expression: exec,
          includeCommandLineAPI: true
        }, result => {
          if(action === 'verifyText'){
            const res = JSON.parse(result.result.value)
            this.recordCommand(action, [['css=' + res.selector]], res.text)
          } else if(action === 'waitForElementPresent'){
            this.recordCommand(action, [['css=' + result.result.value]], '7')
          } else {
            this.recordCommand(action, [['css=' + result.result.value]], '')
          }
        })
      })
    }
  }
}