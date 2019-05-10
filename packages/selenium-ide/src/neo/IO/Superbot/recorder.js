import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'
import { nodeResolver, cssPathBuilder, focusWindow, waitForCanvas } from './helpers';
import commandPreview from './commandsPreview'

const helpers = `
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
    this.currentMode = null;
    this.recordingTempImage = null;
    this.lastUrl = null;

    chrome.runtime.onMessage.addListener(this.messageHandler)
    chrome.debugger.onEvent.addListener(this.debuggerCommandHandler)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if(!UiState.isRecording || this.currentWindow === null || this.currentTab === null || UiState.recordingPaused === true) return;

      if(changeInfo.url && this.lastUrl !== null){
        const hostname = new URL(this.lastUrl).hostname;
        if(hostname && !tab.url.includes(hostname)){
          recordCommand('open', [[tab.url]], '')
        }
      }

      if(changeInfo.url){
        this.lastUrl = changeInfo.url;
      }

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
      if(UiState.isRecording === false){
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
    this.currentMode = 'wait for element';
    await this.createRecordingWindow();
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
      this.currentMode = null;
      recordCommand('close', [['']], '');

      //Does not work when minimize button is pressed, only when window is "left behind" under other windows
      focusWindow();
      
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
              chrome.debugger.sendCommand(this.debugTarget, 'DOM.enable', () => {
                clearInterval(debuggerTimer);
                resolve(true);
              })
            });
            chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight, () => {
              checkForErrors('Enable debugger highlight');
              chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable', () => {
                resolve();
              })
            })
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

  captureScreenshot = (sourceImg, coords) => {
    return new Promise(async (resolve) => {
      if(sourceImg === undefined || sourceImg === null || coords === undefined || coords === null){
        return resolve(null);
      }

      const promises = [];
      for(let i = 0; i < coords.length; i++){
        promises.push(this.cropImage(sourceImg, coords[i]));
      }
      const croppedImages = await Promise.all(promises);
      console.log('croppedImages:', croppedImages);
      resolve(croppedImages);
    })
  }

  cropImage = (source, coords) => new Promise(resolve => {
    const { x, y, width, height } = coords;
    console.log('raw img data:', { imgData: source });
    console.log('elem coordinates:', coords)
    const tempIMG = new Image;
    tempIMG.onload = async () => {
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;

      canvasContext.drawImage(tempIMG, x, y, width, height, 0, 0, width, height);

      const croppedImage = await waitForCanvas(canvas, canvasContext)
      canvas.remove()
      resolve(croppedImage)
    }
    tempIMG.src = source;
  })

  toggleNotification = (msg = null) => {
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'notificationVisible', message: msg });
  }

  messageHandler = async (message, sender, sendResponse) => {
    if(this.currentWindow === null || message.type === undefined || UiState.recordingPaused) return;
    switch(message.type){
      case 'command':
        switch(message.command) {
          case 'type':
          case 'sendKeys':
            this.toggleNotification(`${message.command} recorded!`);
            if(isDuplicateCommand(message)){
              const test = UiState.displayedTest;
              test.removeCommand(test.commands[test.commands.length-1])
            }
            if(message.command === 'sendKeys'){
              const test = UiState.displayedTest;
              const lastCommand = test.commands[test.commands.length-1];
              if(lastCommand.command === 'type'){
                message.targets = lastCommand.targets;
              }
            }
            this.commandHandler(message.command, message.targets, message.value);
          break;

          case 'scroll':
            preprocessScroll(message);
            this.commandHandler(message.command, message.targets, message.value);
          break;

          case 'drag':
            console.log('message received:', message)
            this.toggleNotification(`${message.command} recorded!`);
            this.commandHandler(message.command, message.targets, message.value);
          break

          case 'dragAndDropToObject':
            this.toggleNotification(`${message.command} recorded!`);
            this.commandHandler(message.command, message.targets, message.value);
          break;

          case 'click':
            if(this.recordingTempImage !== null){
              console.log('click recorded:', message);
              console.log('current temp images:', { image: this.recordingTempImage })
              console.log('message.targets:', message.targets)
              commandPreview({ command: 'click', target: message.targets[0], value: message.value, image: this.recordingTempImage[0] });
              this.commandHandler(message.command, message.targets, message.value, this.recordingTempImage);
              this.recordingTempImage = null;
            }
            this.currentMode = 'recording: select target';
            chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
          break;
        }
      break;

      case 'setMode':
        this.currentMode = message.mode;
      break;

      case 'getMode':
        console.log('getMode:', this.currentMode)
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
    if(UiState.recordingPaused) return;

    if(method === 'Overlay.inspectNodeRequested'){
      try {
        Promise.all([this.toggleDebuggerHighlight(false), this.toggleRecordingIndicator(false)]).then(() => {
          chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
            backendNodeId: params.backendNodeId
          }, async (boxModelData) => {
            if(checkForErrors('boxModelData')){
              console.log('ERROR: debugger command not recorded!')
              return;
            }

            const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
            const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)

            console.log('currentMode:', this.currentMode)

            console.time('element path coordinates')
            const res = await this.evaluateScript(`
              {
                try {
                  elements = document.elementsFromPoint(${pointX}, ${pointY});
                  if(elements.length < 1){
                    throw new Error('No elements found at point ${pointX}, ${pointY}');
                  }
                  console.log('elements:  ', [...elements])

                  elementCoordinates = elements.reduce((acc, el) => {
                    const coordinates = el.getBoundingClientRect();
                    console.log('coordinates:', coordinates)
                    if(coordinates.width < 1 || coordinates.height < 1){
                      return acc;
                    }
                    console.log('acc:', acc)
                    console.log('el:', el)

                    if(acc.length > 0){
                      const lastCoords = acc[acc.length - 1];
                      console.log('lastCoords:', lastCoords)
  
                      if(coordinates.x !== lastCoords.x ||
                        coordinates.y !== lastCoords.y ||
                        coordinates.width !== lastCoords.width ||
                        coordinates.height !== lastCoords.height){
                          acc.push(coordinates);
                          return acc;
                      } else {
                        return acc;
                      }
                    } else {
                      acc.push(coordinates);
                      return acc;
                    }
                  }, []);

                  if(elementCoordinates.length > 5){
                    elementCoordinates.length = 6;
                  }
                  console.log('elementCoordinates:', elementCoordinates);
                  if(elementCoordinates.length < 1){
                    throw new Error('No elementCoordinates found for element!');
                  }

                  elem = nodeResolver(elements[0]);

                  JSON.stringify({
                    text: elem.innerText || elem.innerValue,
                    selector: cssPathBuilder(elem),
                    imageCoords: elementCoordinates
                  });
                } catch(e){
                  console.log('Error in debugger evaluate script:', e);
                }
              }
            `);
            console.timeEnd('element path coordinates');
            if(res === undefined){
              //throw new Error(`${this.currentMode} evaluateScript: ${res}`);
              console.log(`${this.currentMode} evaluateScript: ${res}`);
            }
            const oldMode = this.currentMode;
            if(this.currentMode === 'recording: select target'){
              this.currentMode = 'recording: click element';
              chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
            } else {
              this.currentMode = 'recording: select target';
              chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
            }

            let result = null;
            try {
              result = JSON.parse(res);
            } catch(e){
              console.log('Failed to parse JSON:', e)
              this.toggleDebuggerHighlight(true);
              this.toggleRecordingIndicator(true);
              return
            }
            const { text, selector, imageCoords } = result;

            const firstElemCoords = imageCoords.shift();

            chrome.tabs.captureVisibleTab(this.currentWindow.id, { format: 'png' }, async (sourceImg) => {
              this.toggleNotification(`${oldMode} recorded!`);
              this.toggleDebuggerHighlight(true);
              this.toggleRecordingIndicator(true);

              const elementTemplate = await this.cropImage(sourceImg, firstElemCoords)
              console.log('elementTemplate:', elementTemplate);

              switch(oldMode){
                case 'assert text':
                  
                  commandPreview({ command: 'assertText', target: 'css=body', value: text, image: elementTemplate });
                  this.commandHandler('assertText', [['css=body']], text, sourceImg, imageCoords, elementTemplate);
                break; 

                case 'hover':
                  commandPreview({ command: 'mouseOver', target: `css=${selector}`, value: '', image: elementTemplate });
                  this.commandHandler('mouseOver', [[`css=${selector}`]], '', sourceImg, imageCoords);
                  this.commandHandler('mouseOut', [[`css=${selector}`]], '', sourceImg, imageCoords);
                break;

                case 'wait for element':
                  commandPreview({ command: 'waitForElementPresent', target: `css=${selector}`, value: '5000', image: elementTemplate });
                  this.commandHandler('waitForElementPresent', [[`css=${selector}`]], '5000', sourceImg, imageCoords);
                break;

                case 'recording: select target':
                  console.log('select target sourceImg:', sourceImg)
                  console.log('select target imageCoords:', imageCoords)
                  const parentTemplates = await this.captureScreenshot(sourceImg, imageCoords);
                  if(parentTemplates === undefined || parentTemplates === null){
                    this.recordingTempImage = null;
                  } else {
                    this.recordingTempImage = [elementTemplate, ...parentTemplates];
                  }
                break;

                default: console.log('Debugger mode not recognized:', oldMode); break;
              }
            })
          })
        })
      } catch(e) {
        console.log(e);
      }
    }
  }

  commandHandler = async (command, targets, value, sourceImg, parentCoords, template) => {
    //Do not record commands before "open" is recorded
    if(UiState.displayedTest.commands.length === 0) return;
  
    const newCommand = recordCommand(command, targets, value, template)
    if (Commands.list.has(command)) {
      const type = Commands.list.get(command).target
      if (type && type.name === ArgTypes.locator.name) {
        newCommand.setTargets(targets)
      }
    }

    if(command === 'click'){
      if(sourceImg !== undefined && sourceImg !== null){
        newCommand.setImage(sourceImg);
      } else {
        newCommand.setImage(undefined);
      }
    } else {
      const parentTemplates = await this.captureScreenshot(sourceImg, parentCoords);
      if(parentTemplates === null){
        newCommand.setImage(undefined)
      } else {
        newCommand.setImage([template, ...parentTemplates]);
      }
    }
    console.log('newCommand:', newCommand)
  }

  evaluateScript = (script) => new Promise(resolve => {
    chrome.debugger.sendCommand(this.debugTarget, 'Runtime.evaluate', {
      expression: script,
      includeCommandLineAPI: true
    }, result => {
      checkForErrors('evaluateScript');
      console.log('eval script result:', result)
      resolve(result.result.value);
    })
  })

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

  toggleDebuggerHighlight = (enabled) => new Promise(resolve => {
    if(enabled){
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.setInspectMode', elemHighlight, () => {
        checkForErrors('Enable debugger highlight');
        chrome.debugger.sendCommand(this.debugTarget, 'Overlay.enable', () => {
          resolve();
        })
      })
    } else {
      chrome.debugger.sendCommand(this.debugTarget, 'Overlay.disable', () => {
        checkForErrors('Disabled debugger highlight');
        resolve();
      })
    }
  })

  toggleRecordingIndicator = (state) => new Promise(resolve => {
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'toggleRecordingIndicator', enabled: state }, () => {
      resolve();
    })
  })
}

const recordCommand = (command, targets, value, image) => {
  const test = UiState.displayedTest

  const newCommand = test.createCommand(test.commands.length)
  
  newCommand.setCommand(command)
  newCommand.setTarget(targets[0][0])
  newCommand.setValue(value)

  UiState.lastRecordedCommand = newCommand

  return newCommand
}

const checkForErrors = (source) => {
  if(chrome.runtime.lastError !== undefined){
    console.log(`${source}: ${chrome.runtime.lastError.message}`);
    return true;
  } else {
    return false;
  }
}

const isDuplicateCommand = (message) => {
  const targetTest = UiState.displayedTest;
  const lastCommand = targetTest.commands[targetTest.commands.length-1];
  if(message.command !== lastCommand.command){
    return false;
  } else {
    return message.targets[0][0] === lastCommand.target;
  }
}

const preprocessScroll = (message) => {
  const targetTest = UiState.displayedTest;
  const lastCommand = targetTest.commands[targetTest.commands.length-1]
  if(message.command !== lastCommand.command){
    return;
  } else {
    targetTest.removeCommand(targetTest.commands[targetTest.commands.length-1])
  }
}