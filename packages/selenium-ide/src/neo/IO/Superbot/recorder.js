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

  const highlightElement = (x , y, width, height) => {
    if(window.self !== window.top) return;

    const targetIndicator = document.createElement('div');
    targetIndicator.id = 'superbot-target-indicator';
    targetIndicator.style.position = 'fixed';
    targetIndicator.style.top = y + 'px';
    targetIndicator.style.left = x + 'px';
    targetIndicator.style.width = width + 'px';
    targetIndicator.style.height = height + 'px';
    targetIndicator.style.zIndex = 2147483647;
    targetIndicator.style.backgroundColor = '#77dd777F';
    targetIndicator.style.display = 'block';
    document.body.appendChild(targetIndicator);
    setTimeout(() => targetIndicator.remove(), 150);
  }`

export default class SuperbotRecorder {
  constructor(){
    this.currentWindow = null
    this.debugTarget = null
    //TODO: do something with these
    this.mouseCoordinates = []
    this.currentMode = 'wait for element';

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
      this.currentMode = 'wait for element';
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
          checkForErrors('attachDebugger')
          chrome.debugger.sendCommand(this.debugTarget, 'Runtime.enable', () => {
            checkForErrors('Runtime.enable');
          });
        });
      }
    })
  }

  captureScreenshot = (coords) => {
    console.time('element screenshot took:')
    return new Promise(resolve => {
      chrome.tabs.captureVisibleTab(this.currentWindow.id, { format: 'jpeg', quality: 92 }, imgData => {
        this.highlightElement(coords);

        const { x, y, width, height } = coords;

        const tempIMG = new Image;
        tempIMG.onload = async () => {
          const canvas = document.createElement('canvas');
          const canvasContext = canvas.getContext('2d');
          canvas.width = width;
          canvas.height = height;

          canvasContext.drawImage(tempIMG, x, y, width, height, 0, 0, width, height);

          const croppedImage = await this.waitForCanvas(canvas, canvasContext, width, height)
          console.log('%c       ', `font-size: 100px; background: url(${croppedImage}) no-repeat;`);
          canvas.remove()
          resolve(croppedImage)
          console.timeEnd('element screenshot took:')
        }
        tempIMG.src = imgData;
      })
    })
  }

  highlightElement = (coords) => {
    if(coords === undefined || coords === null){
      return console.log('Element coordinates:', coords);
    }

    const { x, y, width, height } = coords;

    chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', {
      expression: `highlightElement(${x}, ${y}, ${width}, ${height});`,
      includeCommandLineAPI: true
    })
  }

  waitForCanvas = (canvas, context, width, height) => {
    return new Promise(resolve => {
      const timerId = setInterval(() => {
        if(isCanvasDrawn(context, width, height)){
          resolve(canvas.toDataURL());
          canvas.remove()
          clearInterval(timerId);
        }
      }, 20);
    })
  }

  messageHandler = async (message, sender, sendResponse) => {
    if(this.currentWindow === null || sender.tab.id !== this.currentWindow.tabs[0].id || message.type === undefined) return;

    switch(message.type){
      case 'command':
        if(message.command !== 'type' && message.command !== 'sendKeys'){
          this.toggleRecordingIndicator(false);
          const elementImage = await this.captureScreenshot(message.coords);
          this.toggleRecordingIndicator(true);
          commandHandler(message.command, message.targets, message.value, elementImage);
        } else {
          sendResponse(true)
          commandHandler(message.command, message.targets, message.value);
        }
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
        this.toggleDebuggerHighlight(message.enabled);
      break;

      case 'evaluateScripts':
        chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'attachSuperbotRecorder' })
      break;

      default: console.log('Message type not recognized:', message.type); break;
    }
  }

  debuggerCommandHandler = (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
        this.toggleDebuggerHighlight(false);
        this.toggleRecordingIndicator(false);
        
        chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
        backendNodeId: params.backendNodeId
      }, async boxModelData => {
        if(boxModelData === undefined || boxModelData === null){
          return console.log('Error boxModelData:', boxModelData);
        }
        const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
        const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)

        console.log('currentMode:', this.currentMode)

        switch(this.currentMode){
          case 'assert text': {
            const res = await this.evaluateScript(`
              try {
                elem = document.elementFromPoint(${pointX}, ${pointY});
                JSON.stringify({ text: elem.innerText || elem.innerValue, coords: nodeResolver(elem).getBoundingClientRect() });
              } catch(e){
              }`);
            console.log('res:', res)
            const { text, coords } = JSON.parse(res);
            const elementImage = await this.captureScreenshot(coords);
            commandHandler('assertText', [['css=body']], text, elementImage)
          } break; 

          case 'hover':
          case 'wait for element': 
            const res = await this.evaluateScript(`
              try {
                elem = document.elementFromPoint(${pointX}, ${pointY});
                JSON.stringify({ selector: cssPathBuilder(elem), coords: nodeResolver(elem).getBoundingClientRect() });
              } catch(e) {
              }`);
              console.log('res:', res)
              const { selector, coords } = JSON.parse(res);
              const elementImage = await this.captureScreenshot(coords);

              if(this.currentMode === 'hover'){
                commandHandler('mouseOver', [[`css=${selector}`]], '', elementImage);
                commandHandler('mouseOut', [[`css=${selector}`]], '', elementImage);
              } else if(this.currentMode === 'wait for element'){
                commandHandler('waitForElementPresent', [[`css=${selector}`]], '5000', elementImage)
                this.currentMode = 'recording'
                chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'updateMode', mode: this.currentMode })
              }
          break;

          default: console.log('Mode not recognized:', this.currentMode); return;
        }

        this.toggleDebuggerHighlight(true);
        this.toggleRecordingIndicator(true);
      })
    }
  }

  evaluateScript = (script) => {
    return new Promise(resolve => {
      chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', {
        expression: script,
        includeCommandLineAPI: true
      }, result => {
        resolve(result.result.value);
      })
    })
  }

  toggleDebuggerHighlight = (enabled) => {
    if(enabled){
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight)
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
      checkForErrors('Enable debugger highlight');
    } else {
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.disable')
      checkForErrors('Disabled debugger highlight');
    }
  }

  toggleRecordingIndicator = (enabled) => {
    chrome.tabs.sendMessage(this.currentWindow.tabs[0].id, { type: 'toggleRecordingIndicator', enabled: enabled })
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
const commandHandler = (command, targets, value, elementImage) => {
  console.log('Command recorded:', command, targets, value)

  //Do not record commands before a valid base url is opened
  if(UiState.displayedTest.commands.length === 0) return;

  const newCommand = recordCommand(command, targets, value)
  if (Commands.list.has(command)) {
    const type = Commands.list.get(command).target
    if (type && type.name === ArgTypes.locator.name) {
      newCommand.setTargets(targets)
      newCommand.setImage(elementImage)
    }
  }
  console.log('newCommand:', newCommand)
}

const runDebuggerScript = (debugTarget, script, name) => {
  return new Promise(resolve => {
    chrome.debugger.sendCommand(debugTarget, 'Runtime.compileScript', {
      expression: script,
      sourceURL: name,
      persistScript: true
    }, script => {
      if(script === undefined || script === null){
        return console.log('Error compiled script:', script)
        
      }
      chrome.debugger.sendCommand(debugTarget, 'Runtime.runScript', {
        scriptId: script.scriptId
      }, () => {
        checkForErrors('Runtime.runScript')
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

const isCanvasDrawn = (context, width, height) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  for(let i = 0; i < pixels.length; i++){
    if(pixels[i] !== 0){
      return true;
    }
  }
  return false;
}