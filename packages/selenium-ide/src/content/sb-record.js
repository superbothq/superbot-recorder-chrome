
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch(message.command){
    case 'attachRecorder': 
      //eventListeners.attach()
      sendResponse(true)
    break;
    
    case 'detachRecorder': 
      //eventListeners.detach()
      sendResponse(true)
    break;

    default: sendResponse(false)
  }
})

export const record = (command, target, value) => {
  chrome.runtime.sendMessage({
    type: 'command',
    command,
    target,
    value
  })
  .catch(e => console.log('Error sending recorded command!', e))
}

const addRecordingIndicator = () => {

}

const removeRecordingIndicator = () => {

}