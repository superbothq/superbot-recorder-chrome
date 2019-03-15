import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'

//MASSIVE TODO: clean this mess up
const helpers = `
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

  const nodeResolver = (el) => {
    if(el === null) return;

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

  const highlightElement = (coords) => {
    if(window.self !== window.top) return;
    const targetIndicator = window.document.createElement('div');
    targetIndicator.id = 'superbot-target-indicator';
    targetIndicator.style.position = 'absolute';
    targetIndicator.style.top = coords.y + 'px';
    targetIndicator.style.left = coords.x + 'px';
    targetIndicator.style.width = coords.width + 'px';
    targetIndicator.style.height = coords.height + 'px';
    targetIndicator.style.backgroundColor = '#77dd777F';
    targetIndicator.style.display = 'block';
    window.document.body.appendChild(targetIndicator);
    setTimeout(() => {
      targetIndicator.remove();
    }, 150);
  }`

//TODO: remove this duplicate mode list, content script recorder already has one
const modes = ['recording', 'hover', 'assert text', 'wait for element']

export default class SuperbotRecorder {
  constructor(){
    this.currentWindow = null
    this.debugTarget = null
    //TODO: do something with these
    this.mouseCoordinates = []
    this.currentMode = 0;

    chrome.runtime.onMessage.addListener(this.messageHandler)
    chrome.debugger.onEvent.addListener(this.debuggerCommandHandler)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if(!UiState.isSuperbotRecording || this.currentWindow === null || this.currentWindow.tabs[0].id !== tabId) return;

      if(UiState.displayedTest.commands.length < 1 && !tab.url.includes('chrome://') && !tab.url.includes('chrome-extension://')){
        recordCommand('open', [[tab.url]], '')
        this.attachDebugger()
      }

      if(this.debugTarget !== null){
        runDebuggerScript(this.debugTarget, helpers, 'helpers')
      }
    })
  }

  createRecordingWindow = () => {
    return new Promise((resolve) => {
      chrome.windows.create({ url: 'chrome://newtab/' }, window => {
        this.currentWindow = window
        checkForErrors('createRecordingWindow');
        resolve()
      })
    })
  }

  removeRecordingWindow = () => {
    if(this.currentWindow === null) return;

    chrome.windows.remove(this.currentWindow.id, () => {
      checkForErrors('removeRecordingWindow');
    });
  }

  stateChecks = () => {
    const stateChecksInterval = setInterval(() => {
      if(UiState.isSuperbotRecording === false){
        this.stopRecording()
        return clearInterval(stateChecksInterval);
      }

      if(this.currentWindow === null){
        this.stopRecording()
        UiState.toggleSuperbotRecording()
        clearInterval(stateChecksInterval);
      } else {
        chrome.tabs.query({ windowId: this.currentWindow.id }, windowInfo => {
          checkForErrors('stateChecks');
          if(windowInfo.length === 0){
            this.currentWindow = null
            this.stopRecording()
            UiState.toggleSuperbotRecording()
            clearInterval(stateChecksInterval);
          }
        })
      }
    }, 250)
  }

  start = async () => {
    await this.createRecordingWindow()
    this.stateChecks()
    chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' }, () => {
      checkForErrors('start');
    })
  }

  stopRecording = () => {
    try {
      clearInterval(this.stateCheckInterval);
      this.removeRecordingWindow();
      this.currentWindow = null;
      this.debugTarget = null;
      this.currentMode = 3;
      recordCommand('close', [['']], '');

      //focus extension window
      chrome.windows.getCurrent(window => {
        chrome.tabs.getSelected(window.id, response => {
          chrome.windows.update(response.windowId, { focused: true }, () => {
            checkForErrors('stop recording focus window');
          });
        });
      });
      
    } catch(e) {
      console.log('stop recording:', e)
    }
  }

  attachDebugger = () => {
    chrome.debugger.getTargets(targets => {
      const newTarget = targets.filter(target => target.tabId === this.currentWindow.tabs[0].id)[0]
      this.debugTarget = {
        targetId: newTarget.id
      }

      if(!newTarget.attached){
        chrome.debugger.attach(this.debugTarget, '1.3', () => {
          chrome.debugger.sendCommand(this.debugTarget, 'Runtime.enable', () => {
            checkForErrors('attachDebugger');
          });
        });
      }
    })
  }

  messageHandler = (message, sender, sendResponse) => {
    if(this.currentWindow === null || sender.tab.id !== this.currentWindow.tabs[0].id || message.type === undefined) return;

    switch(message.type){
      case 'command':
        commandHandler(message.command, message.targets, message.value);      
      break;

      case 'setMode':
        this.currentMode = message.mode;
      break;

      case 'getMode':
        sendResponse(this.currentMode);
      break;

      case 'updateMousePos':
        this.mouseCoordinates.push(message.coordinates)
      break;

      case 'debuggerCommand':
        switchDebuggerHighlight(this.debugTarget, message.enabled);
      break;

      case 'evaluateScripts':
        chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
      break;

      default: console.log('Message type not recognized:', message.type); break;
    }
  }

  debuggerCommandHandler = (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
      //Do not record commands before a valid base url is opened
      if(UiState.displayedTest.commands.length === 0) return;

        chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
        backendNodeId: params.backendNodeId
      }, boxModelData => {
        const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
        const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)

        let execScript = null;
        switch(modes[this.currentMode]){
          case 'assert text':
            execScript = `
            elem = nodeResolver(document.elementFromPoint(${pointX}, ${pointY}));
            selector = cssPathBuilder(elem);
            highlightElement(elem.getBoundingClientRect());
            elemText = elem.innerText || elem.innerValue;`
          break;

          case 'hover':
          case 'wait for element':
            execScript = `
            elem = nodeResolver(document.elementFromPoint(${pointX}, ${pointY}));
            highlightElement(elem.getBoundingClientRect());
            cssPathBuilder(elem);`
          break;

          default: console.log('Mode not recognized:', modes[this.currentMode]); return;
        }

        chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', {
          expression: execScript,
          includeCommandLineAPI: true
        }, result => {
          if(chrome.runtime.lastError !== undefined){
            console.log('evaluateScript error:', chrome.runtime.lastError.message)
          }

          console.log('result:', result.result);
          switch(modes[this.currentMode]){
            case 'assert text':
              recordCommand('assertText', [['css=body']], result.result.value)
            break;

            case 'hover':
              recordCommand('mouseOver', [['css=' + result.result.value]], '');
              recordCommand('mouseOut', [['css=' + result.result.value]], '');
            break;

            case 'wait for element':
              recordCommand('waitForElementPresent', [['css=' + result.result.value]], '7')
            break;

            default: console.log('mode not recognized:', modes[this.currentMode]); return;
          }
        })
      })
    }
  }
}

const recordCommand = (command, targets, value) => {
  const test = UiState.displayedTest

  const newCommand = test.createCommand(test.commands.length)
  
  newCommand.setCommand(command)
  newCommand.setTarget(targets[0][0])
  newCommand.setValue(value)

  UiState.lastRecordedCommand = newCommand

  return newCommand
}

//handle recorded commands that are sent from content scripts
const commandHandler = (command, targets, value) => {
  console.log('Command recorded:', command, targets, value)

  //Do not record commands before a valid base url is opened
  if(UiState.displayedTest.commands.length === 0) return;

  const newCommand = recordCommand(command, targets, value)
  if (Commands.list.has(command)) {
    const type = Commands.list.get(command).target
    if (type && type.name === ArgTypes.locator.name) {
      newCommand.setTargets(targets)
    }
  }
}

const switchDebuggerHighlight = (debugTarget, enabled) => {
  if(enabled){
    chrome.debugger.sendCommand(debugTarget, 'Overlay.setInspectMode', elemHighlight)
    chrome.debugger.sendCommand(debugTarget, 'Overlay.enable')
    checkForErrors('Enable debugger highlight');
  } else {
    chrome.debugger.sendCommand(debugTarget, 'Overlay.disable')
    checkForErrors('Disabled debugger highlight');
  }
}

const runDebuggerScript = (debugTarget, script, name) => {
  return new Promise(resolve => {
    chrome.debugger.sendCommand(debugTarget, 'Runtime.compileScript', {
      expression: script,
      sourceURL: name,
      persistScript: true
    }, script => {
      if(script === undefined){
        console.log('Error compiled script undefined:', script)
        return;
      }
      chrome.debugger.sendCommand(debugTarget, 'Runtime.runScript', {
        scriptId: script.scriptId
      }, () => {
        chrome.runtime.lastError;
        resolve();        
      })
    })
  })
}

const checkForErrors = (source) => {
  if(chrome.runtime.lastError !== undefined){
    console.log(`runtime.lastError(${source}): ${chrome.runtime.lastError.message}`);
  }
}