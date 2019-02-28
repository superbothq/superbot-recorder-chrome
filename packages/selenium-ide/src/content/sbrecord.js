import { addRecordingIndicator } from './recordingIndicator'
import cssPathBuilder from './cssPathBuilder'

const EventHandlers = []
let attached = false

// tell extension to evaluate scripts needed for creating selectors later on
chrome.runtime.sendMessage({ type: 'exec' })

const messageHandler = (message, sender, sendResponse) => {
  switch(message.type){
    case 'attachSuperbotRecorder':
      if(!attached){
        addRecordingIndicator();
        attachEventHandlers();
        attached = true;
        sendResponse(attached);
      }
    break;

    case 'showActionPalette':
      showActionPalette(sendResponse);
      return true;
    break;

    default: break;
  }
}

const preventClicks = (event) => {
  for(let i = 0; i < event.path.length; i++){
    if(event.path[i].id === 'action-palette'){
      return;
    }
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

const actionPaletteOnclick = (actionPalette, action, sendResponse) => {
  actionPalette.remove();
  document.removeEventListener('click', preventClicks, true);
  sendResponse(action)
}

const showActionPalette = (sendResponse) => {
  const fragment = document.createDocumentFragment()
  const actionPalette = document.createElement('div');
  actionPalette.id = 'action-palette';
  actionPalette.style.backgroundColor = '#fff';
  actionPalette.style.color = '#000';
  actionPalette.style.width = '145px';
  actionPalette.style.position = 'fixed';
  actionPalette.style.top = '50px';
  actionPalette.style.left = '50px';
  actionPalette.style.fontSize = '17px';
  actionPalette.style.fontFamily = 'arial, helvetica, sans-serif';
  actionPalette.style.border = '1px solid #000';
  actionPalette.style.zIndex = 2147483647;
  actionPalette.style.display = 'block';
  actionPalette.style.textAlign = 'center';

  const baseButton = document.createElement('div');
  const baseButtonLabel = document.createElement('div');
  baseButtonLabel.innerText = 'button';
  baseButton.appendChild(baseButtonLabel);
  baseButton.style.paddingTop = '5px';
  baseButton.style.paddingBottom = '5px';
  baseButton.style.borderBottom = '1px solid #ccc';

  const click = baseButton.cloneNode(true);
  click.onclick = () => actionPaletteOnclick(actionPalette, 'click', sendResponse)
  click.childNodes[0].innerText = 'Click';
  actionPalette.appendChild(click);
  
  const doubleClick = baseButton.cloneNode(true);
  doubleClick.onclick = () => actionPaletteOnclick(actionPalette, 'doubleClick', sendResponse)
  doubleClick.childNodes[0].innerText = 'Double Click';
  actionPalette.appendChild(doubleClick);

  const waitFor = baseButton.cloneNode(true);
  waitFor.onclick = () => actionPaletteOnclick(actionPalette, 'waitForElementPresent', sendResponse)
  waitFor.childNodes[0].innerText = 'Wait For';
  actionPalette.appendChild(waitFor);
  
  const verify = baseButton.cloneNode(true);
  verify.onclick = () => actionPaletteOnclick(actionPalette, 'verifyText', sendResponse)
  verify.childNodes[0].innerText = 'Verify Text';
  actionPalette.appendChild(verify);

  const cancel = baseButton.cloneNode(true);
  cancel.onclick = () => actionPaletteOnclick(actionPalette, 'cancel', sendResponse)
  cancel.childNodes[0].innerText = 'Cancel';
  actionPalette.appendChild(cancel);
  cancel.style.borderBottom = 'none';
  
  //prevent clicks on action palette from closing drop down menus etc.
  document.addEventListener('click', preventClicks, true);
  fragment.appendChild(actionPalette);
  document.body.appendChild(fragment);
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
      const selector = [['css=' + cssPathBuilder(event.target)]]
      if(event.target.value !== null && event.target.value !== ''){
        recordCommand('type', selector, event.target.value)
      }
      
      recordCommand('sendKeys', selector, '${KEY_ENTER}')
    }
  })

  for(let i = 0; i < EventHandlers.length; i++){
    window.addEventListener(EventHandlers[i].type, EventHandlers[i].handler, true)
  }
}

chrome.runtime.onMessage.addListener(messageHandler)