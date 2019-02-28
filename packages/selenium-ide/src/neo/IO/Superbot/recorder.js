import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'

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
    this.stateChecksInterval = null
    this.scripts = []

    chrome.runtime.onMessage.addListener(this.messageHandler)
    chrome.debugger.onEvent.addListener(this.debuggerCommandHandler)
    chrome.webNavigation.onBeforeNavigate.addListener(this.navigationHandler)
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
        if(UiState.isSuperbotRecording === false){
          this.stopRecording()
          return
        }
        chrome.tabs.query({ windowId: this.currentWindow.id }, (windowInfo) => {
          if(windowInfo.length === 0){
            this.currentWindow = null
            this.stopRecording()
            UiState.toggleSuperbotRecording()
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
        if(chrome.runtime.lastError !== undefined)
          console.log('runtime.lastError:', chrome.runtime.lastError)
      })
      this.debugTarget = null
    } catch(e) {
      console.log('stopRecording error:', e)
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
          chrome.debugger.attach(this.debugTarget, '1.3', () => {
            if(chrome.runtime.lastError !== undefined){
              console.log('debugger attach error:', chrome.runtime.lastError)
            }
          })
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

  messageHandler = async (message, sender, sendResponse) => {
    if(sender.tab.id !== this.currentWindow.tabs[0].id) return;

    console.log('New message:', message)
    if(message.type === 'command'){
      this.commandHandler(message.command, message.targets, message.value);      
    } else if(message.type === 'exec'){
      this.scripts = []
      const script1 = this.compileScript(cssPathBuilder, 'cssPathBuilder')
      const script2 = this.compileScript(nodeResolver, 'nodeResolver')
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight)
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
      chrome.debugger.sendCommand(this.debugTarget, 'Runtime.enable')
      Promise.all([script1, script2]).then(() => {
        for(let i = 0; i < this.scripts.length; i++){
          console.log('Script executed:', this.scripts[i].scriptName);
          this.runScript(this.scripts[i].scriptId)
        }
        chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
      })
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

    sendResponse(true)
  }

  compileScript = (script, name) => {
    return new Promise(resolve => {
      chrome.debugger.sendCommand(this.debugTarget, 'Runtime.compileScript', {
        expression: script,
        sourceURL: name,
        persistScript: true
      }, res => {
        const found = this.scripts.find(s => s.scriptId === res.scriptId)
        if(res !== undefined && found === undefined){
          this.scripts.push({ scriptName: name, scriptId: res.scriptId })          
        }
        resolve()
      })
    })
  }

  runScript = (scriptId) => {
    chrome.debugger.sendCommand(this.debugTarget, 'Runtime.runScript', { scriptId: scriptId });
  }

  getElementAction = () => {
    return new Promise(resolve => {
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.disable')
      chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'showActionPalette' }, res => {
        console.log('getElementAction res:', res)
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight)
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
        resolve(res)
      })
    })
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

  navigationHandler = (target) => {
    if(this.currentWindow === null || target.tabId !== this.currentWindow.tabs[0].id){
      return
    }
    
    if(this.recordOpenStep && target.url !== 'about:blank'){
      this.recordCommand('open', [[target.url]], '')
      this.recordOpenStep = false
    }
  }
}
