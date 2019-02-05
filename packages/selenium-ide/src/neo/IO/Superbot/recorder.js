
export default class SuperbotRecorder {
  constructor(){
    this.attached = false
    this.currentWindow = null
    this.currentTab = null
  }

  start = () => {
    if(this.attached){
      return console.log('Recorder already attached!')
    }
    try {
      chrome.windows.create({ url: 'about:blank' }, (_window) => {
        this.currentWindow = _window
        this.currentTab = _window.tabs[0]
        console.log('current window', this.currentWindow)
        console.log('current tab', this.currentTab)

        chrome.tabs.sendMessage(this.currentTab.id, { command: 'attachRecorder' }, (res) => {
          if(res.status === true){
            chrome.runtime.onMessage.addListener(this.commandMessageHandler)
            this.attached = true
          } else {
            this.stop()
          }
        })
      })
    } catch(e) {
      console.log('Failed to attach recorder:', e)
    }
  }

  stop = () => {
    try {
      chrome.tabs.remove(this.currentTab.id, (res) => {
        console.log('tabs remove callback', res)
        this.currentWindow = null
        this.currentTab = null
        this.record('close', [['']], '')
      })
    } catch(e) {
      console.log('Failed to detach recorder:', e)
    }
  }

  record = (command, targets, value) => {
    const test = UiState.displayedTest

  }

  commandMessageHandler = (message, sender, sendResponse) => {
    if(message.type !== 'command'){
      return
    }

    if(UiState.selectedTest.test.commands.length < 1){
      this.record('open', [[sender.tab.url]], '')
    }

    this.record(message.command, message.targets, message.value)

    sendResponse(true)
  }
}
