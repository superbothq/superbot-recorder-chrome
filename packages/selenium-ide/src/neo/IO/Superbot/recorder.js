import UiState from '../../stores/view/UiState'
import { Commands, ArgTypes } from '../../models/Command'
import { elemHighlight } from './elementHighlight'
import { spawnTargetIndicator, nodeResolver, cssPathBuilder, focusWindow } from './helpers';
import screenshotPreview from './screenshotPreview'

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
    this.recordingTempImage = null;

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

  captureScreenshot = coords => new Promise(resolve => {
    chrome.tabs.captureVisibleTab(this.currentWindow.id, { format: 'png' }, async (sourceImg) => {
      const promises = [];
      for(let i = 0; i < coords.length; i++){
        promises.push(this.cropImage(sourceImg, coords[i]));
        }
      const croppedImages = await Promise.all(promises);
      console.log('croppedImages:', croppedImages);
      resolve(croppedImages);
    })
  })

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
    if(this.currentWindow === null || message.type === undefined) return;

    switch(message.type){
      case 'command':
        if(message.command === 'type' || message.command === 'sendKeys'){
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
          commandHandler(message.command, message.targets, message.value);
        } else {
          console.log('click recorded:', message);
          console.log('current temp image:', { image: this.recordingTempImage })
          commandHandler(message.command, message.targets, message.value, this.recordingTempImage, message.coordinates);
          this.recordingTempImage = null;
          this.currentMode = 'recording: select target';
          chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
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

      case 'getRecordingTempImage':
        sendResponse(this.recordingTempImage);
        this.recordingTempImage = null;
      break;

      default: console.log('Message type not recognized:', message.type); break;
    }
  }

  debuggerCommandHandler = async (sender, method, params) => {
    if(method === 'Overlay.inspectNodeRequested'){
      try {
        await this.toggleDebuggerHighlight(false);
        await this.toggleRecordingIndicator(false);
        chrome.debugger.sendCommand(this.debugTarget, 'DOM.getBoxModel', {
          backendNodeId: params.backendNodeId
        }, async (boxModelData) => {
          checkForErrors('boxModelData');

          const pointX = boxModelData.model.content[0] + (boxModelData.model.width / 2)
          const pointY = boxModelData.model.content[1] + (boxModelData.model.height / 2)

          console.log('currentMode:', this.currentMode)

          switch(this.currentMode){
            case 'assert text': {
              try {
                const res = await this.evaluateScript(`
                  try {
                    elem = document.elementFromPoint(${pointX}, ${pointY});
                    elemParent = elem.parentNode;
                    while(elemParent.tagName !== 'DIV'){
                      elemParent = elemParent.parentNode;
                    }
                    JSON.stringify({
                      text: elem.innerText || elem.innerValue,
                      coords: elem.getBoundingClientRect(),
                      imageCoords: elemParent.getBoundingClientRect()
                    });
                  } catch(e){
                  }`);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { text, coords, imageCoords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(imageCoords);
                focusWindow();
                const status = await screenshotPreview(elementImage);
                if(status){
                  this.toggleNotification(`${this.currentMode} recorded!`);
                  this.currentMode = 'recording: select target';
                  chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
                  commandHandler('assertText', [['css=body']], text, elementImage, coords);
                }
              } catch(e) {
                console.log(`debuggerCommandHandler error! Current mode: ${this.currentMode} --`, e);
              }
            } break; 

            case 'hover': {
              try {
                const res = await this.evaluateScript(`
                try {
                  elem = document.elementFromPoint(${pointX}, ${pointY});
                  elemParent = elem.parentNode;
                    while(elemParent.tagName !== 'DIV'){
                      elemParent = elemParent.parentNode;
                    }
                  JSON.stringify({
                    selector: cssPathBuilder(elem),
                    coords: elem.getBoundingClientRect(),
                    imageCoords: elemParent.getBoundingClientRect()
                  });
                } catch(e) {
                }`);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { selector, coords, imageCoords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(imageCoords);
                focusWindow();
                const status = await screenshotPreview(elementImage);
                if(status){
                  this.toggleNotification(`${this.currentMode} recorded!`);
                  this.currentMode = 'recording: select target';
                  chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
                  commandHandler('mouseOver', [[`css=${selector}`]], '', elementImage, coords);
                  commandHandler('mouseOut', [[`css=${selector}`]], '', elementImage, coords);
                }
              } catch(e) {
                console.log('debuggerCommandHandler error:', e);
              }
            } break;

            case 'wait for element': {
              try {
                const res = await this.evaluateScript(`
                try {
                  elem = document.elementFromPoint(${pointX}, ${pointY});
                  elemParent = elem.parentNode;
                    while(elemParent.tagName !== 'DIV'){
                      elemParent = elemParent.parentNode;
                    }
                  JSON.stringify({
                    selector: cssPathBuilder(elem),
                    coords: elem.getBoundingClientRect(),
                    imageCoords: elemParent.getBoundingClientRect()
                  });
                } catch(e) {
                }`);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { selector, coords, imageCoords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(imageCoords);
                focusWindow();
                const status = await screenshotPreview(elementImage);
                if(status){
                  this.toggleNotification(`${this.currentMode} recorded!`);
                  this.currentMode = 'recording: select target';
                  chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
                  commandHandler('waitForElementPresent', [[`css=${selector}`]], '5000', elementImage, coords);
                }
              } catch(e) {
                console.log('debuggerCommandHandler error:', e);
              }
            } break;

            case 'recording: select target': {
              try {
                const res = await this.evaluateScript(`
                try {
                  elem = document.elementFromPoint(${pointX}, ${pointY});
                  elemParent = elem.parentNode;
                    while(elemParent.tagName !== 'DIV'){
                      elemParent = elemParent.parentNode;
                    }
                  JSON.stringify({
                    imageCoords: elemParent.getBoundingClientRect()
                  });
                } catch(e) {
                }`);
                if(res === undefined){
                  throw new Error(`${this.currentMode} evaluateScript: ${res}`);
                }
                const { imageCoords } = JSON.parse(res);
                const elementImage = await this.captureScreenshot(imageCoords);
                focusWindow();
                const status = await screenshotPreview(elementImage);
                if(status){
                  this.recordingTempImage = elementImage;
                  this.currentMode = 'recording: click element';
                  chrome.tabs.sendMessage(this.currentTab.id, { type: 'updateMode', mode: this.currentMode });
                }
              } catch(e) {
                console.log('debuggerCommandHandler error:', e);
              }
            } break;

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
        console.log('eval script result:', result)
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

  toggleDebuggerHighlight = (enabled) => new Promise(resolve => {
    try {
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
    } catch(e) {
      console.log('Error toggling debugger highlight:', e) 
    }
  })

  toggleRecordingIndicator = (state) => new Promise(resolve => {
    chrome.tabs.sendMessage(this.currentTab.id, { type: 'toggleRecordingIndicator', enabled: state }, () => {
      resolve();
    })
  })
}

const recordCommand = (command, targets, value, image, coordinates) => {
  const test = UiState.displayedTest

  const newCommand = test.createCommand(test.commands.length)
  
  newCommand.setCommand(command)
  newCommand.setTarget(targets[0][0])
  newCommand.setValue(value)
  newCommand.setImage(image);
  newCommand.setCoordinates(coordinates);

  UiState.lastRecordedCommand = newCommand

  return newCommand
}

const commandHandler = (command, targets, value, image, coordinates) => {
  //Do not record commands before "open" is recorded
  if(UiState.displayedTest.commands.length === 0) return;

  const newCommand = recordCommand(command, targets, value, image, coordinates)
  if (Commands.list.has(command)) {
    const type = Commands.list.get(command).target
    if (type && type.name === ArgTypes.locator.name) {
      newCommand.setTargets(targets)
    }
  }
  console.log('newCommand:', newCommand)
}

const checkForErrors = (source) => {
  if(chrome.runtime.lastError !== undefined){
    //console.log(`${source}: ${chrome.runtime.lastError.message}`);
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