import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'
import { spawnTargetIndicator, nodeResolver, cssPathBuilder } from './helpers';

const helpers = `
  spawnTargetIndicator = ${spawnTargetIndicator.toString()};
  nodeResolver = ${nodeResolver.toString()};
  cssPathBuilder = ${cssPathBuilder.toString()};
`;

export default class SuperbotRecorder {
  constructor(){
    this.currentWindow = null
    this.currentTab = null
    this.debugTarget = null
    //TODO: do something with these
    this.mouseCoordinates = []
    this.currentMode = 'wait for element';

    chrome.runtime.onMessage.addListener(this.messageHandler)
    chrome.debugger.onEvent.addListener(this.debuggerCommandHandler)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if(!UiState.isSuperbotRecording || this.currentWindow === null || this.currentTab === null) return;

      if(this.debugTarget !== null && !tab.url.includes('chrome://') && !tab.url.includes('chrome-extension://')){
        if(UiState.displayedTest.commands.length < 1){
          recordCommand('open', [[tab.url]], '')
        }
        this.runDebuggerScript(helpers, 'helpers')
        .catch(e => console.log('runDebuggerScript throw an error!', e))
      }
    })
    chrome.tabs.onActiveChanged.addListener((tabId, selectInfo) => {
      this.currentTab = {
        id: tabId
      };
      console.log('Active tab changed:', tabId, selectInfo);
      if(this.debugTarget !== null){
        chrome.debugger.detach(this.debugTarget, () => {
          checkForErrors('onActiveChanged handler');
          this.attachDebugger();
          this.toggleRecordingIndicator(true);
        })
      }
    })
  }

  createRecordingWindow = () => {
    return new Promise((resolve) => {
      chrome.windows.create({ url: 'chrome://newtab/' }, window => {
        this.currentWindow = window;
        this.currentTab = this.currentWindow.tabs[0];
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
            this.currentWindow = null;
            this.currentTab = null;
            this.stopRecording();
            UiState.toggleSuperbotRecording();
            clearInterval(stateChecksInterval);
          }
        })
      }
    }, 250)
  }

  start = async () => {
    await this.createRecordingWindow()
    await this.attachDebugger();
    this.stateChecks()
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'attachSuperbotRecorder' }, () => {
      checkForErrors('start');
    })
  }

  stopRecording = () => {
    try {
      clearInterval(this.stateCheckInterval);
      this.removeRecordingWindow();
      this.currentWindow = null;
      this.currentTab = null;
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
    return new Promise(resolve => {
      chrome.debugger.getTargets(targets => {
        const newTarget = targets.filter(target => target.tabId === this.currentTab.id)[0]
        this.debugTarget = {
          targetId: newTarget.id
        }
      })
      console.log('debugTarget:', this.debugTarget);
      const debuggerTimer = setInterval(() => {
        chrome.debugger.attach(this.debugTarget, '1.3', () => {
          if(chrome.runtime.lastError === undefined){
            chrome.debugger.sendCommand(this.debugTarget, 'Runtime.enable', () => {
              clearInterval(debuggerTimer);
              resolve(true);
            });
          } else {
            console.log('attachDebugger error:', chrome.runtime.lastError);
            if(chrome.runtime.lastError !== undefined &&
              chrome.runtime.lastError.message.includes('Another debugger is already attached to the target with id:')){
              clearInterval(debuggerTimer);
              resolve(true);
            }
          }
        });
      }, 250)
    })
  }

  captureScreenshot = (coords) => {
    console.time('element screenshot took')
    return new Promise(resolve => {
      chrome.tabs.captureVisibleTab(this.currentWindow.id, { format: 'jpeg', quality: 92 }, imgData => {
        this.toggleNotification();

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
          console.timeEnd('element screenshot took')
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
      expression: `spawnTargetIndicator(${x}, ${y}, ${width}, ${height});`,
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

  isDuplicateCommand = (message) => {
    const targetTest = UiState.displayedTest;
    const lastCommand = targetTest.commands[targetTest.commands.length-1];
    return message.targets[0][0] === lastCommand.target;
  }

  toggleNotification = (msg = null) => {
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'notificationVisible', message: msg });
  }

  messageHandler = async (message, sender, sendResponse) => {
    if(this.currentWindow === null || message.type === undefined) return;

    switch(message.type){
      case 'command':
        if(message.command !== 'type' && message.command !== 'sendKeys'){
          this.toggleRecordingIndicator(false);
          const elementImage = await this.captureScreenshot(message.coords);
          this.toggleRecordingIndicator(true);
          commandHandler(message.command, message.targets, message.value, elementImage);
        } else {
          this.toggleNotification(`${message.command} recorded!`);
          if(this.isDuplicateCommand(message)){
            const test = UiState.displayedTest;
            test.removeCommand(test.commands[test.commands.length-1])
          }
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
        chrome.tabs.sendMessage(this.currentTab.id, { type: 'attachSuperbotRecorder' })
      break;

      default: console.log('Message type not recognized:', message.type); break;
    }
  }

  debuggerCommandHandler = (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
        this.toggleDebuggerHighlight(false);
        this.toggleRecordingIndicator(false);
      try {  
        chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
          backendNodeId: params.backendNodeId
        }, async boxModelData => {
          checkForErrors('boxModelData');
          if(boxModelData === undefined){
            this.toggleDebuggerHighlight(true);
            this.toggleRecordingIndicator(true);
            return;
          }
          const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
          const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)

          console.log('currentMode:', this.currentMode)

          switch(this.currentMode){
            case 'assert text': {
              try {
                const res = await this.evaluateScript(`
                  try {
                    elem = document.elementFromPoint(${pointX}, ${pointY});
                    JSON.stringify({ text: elem.innerText || elem.innerValue, coords: nodeResolver(elem).getBoundingClientRect() });
                  } catch(e){
                  }
                `);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { text, coords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(coords);
                commandHandler('assertText', [['css=body']], text, elementImage);
                this.currentMode = 'recording';
                chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
              } catch(e) {
                console.log(`debuggerCommandHandler error! Current mode: ${this.currentMode} --`, e);
              }
            } break; 

            case 'hover':
            case 'wait for element':
              try {
                const res = await this.evaluateScript(`
                try {
                  elem = document.elementFromPoint(${pointX}, ${pointY});
                  JSON.stringify({ selector: cssPathBuilder(elem), coords: nodeResolver(elem).getBoundingClientRect() });
                } catch(e) {
                }`);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { selector, coords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(coords);

                if(this.currentMode === 'hover'){
                  commandHandler('mouseOver', [[`css=${selector}`]], '', elementImage);
                  commandHandler('mouseOut', [[`css=${selector}`]], '', elementImage);
                } else if(this.currentMode === 'wait for element'){
                  commandHandler('waitForElementPresent', [[`css=${selector}`]], '5000', elementImage);
                }
                this.currentMode = 'recording';
                chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
              } catch(e) {
                console.log('debuggerCommandHandler error:', e);
              }
            break;

            default: console.log('Mode not recognized:', this.currentMode); return;
          }
        

          this.toggleDebuggerHighlight(true);
          this.toggleRecordingIndicator(true);
        })
      } catch(e) {
        console.log(e);
      }
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

  runDebuggerScript = (script, name) => {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(this.debugTarget, 'Runtime.compileScript', {
        expression: script,
        sourceURL: name,
        persistScript: true
      }, script => {
        checkForErrors('Runtime.compileScript')
        if(script === undefined){
          return reject(`Error compiled script: ${script}`);
        }
        chrome.debugger.sendCommand(this.debugTarget, 'Runtime.runScript', {
          scriptId: script.scriptId
        }, () => {
          checkForErrors('Runtime.runScript')
          resolve();        
        })
      })
    })
  }

  toggleDebuggerHighlight = (enabled) => {
    try {
      if(enabled){
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight, () => {
          checkForErrors('Enable debugger highlight');
        })
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable')
      } else {
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.disable', () => {
          checkForErrors('Disabled debugger highlight');
        })
      }
    } catch(e) {
     console.log('Error toggling debugger highlight:', e) 
    }
  }

  toggleRecordingIndicator = (enabled) => {
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'toggleRecordingIndicator', enabled: enabled })
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

const checkForErrors = (source) => {
  if(chrome.runtime.lastError !== undefined){
    console.log(`${source}: ${chrome.runtime.lastError.message}`);
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