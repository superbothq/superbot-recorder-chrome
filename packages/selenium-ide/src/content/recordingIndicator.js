export const addRecordingIndicator = () => {
  const recordingIndicator = window.document.createElement('iframe')
  recordingIndicator.src = browser.runtime.getURL('/indicator.html')
  recordingIndicator.id = 'selenium-ide-indicator'
  recordingIndicator.style.border = '1px solid white'
  recordingIndicator.style.position = 'fixed'
  recordingIndicator.style.bottom = '36px'
  recordingIndicator.style.right = '36px'
  recordingIndicator.style.width = '280px'
  recordingIndicator.style.height = '80px'
  recordingIndicator.style['background-color'] = 'whitesmoke'
  recordingIndicator.style['box-shadow'] = '7px 7px 10px 0 rgba(0,0,0,0.3)'
  recordingIndicator.style.transition = 'bottom 100ms linear'
  recordingIndicator.style['z-index'] = 1000000000000000
  recordingIndicator.addEventListener(
    'mouseenter',
    function(event) {
      event.target.style.visibility = 'hidden'
      setTimeout(function() {
        event.target.style.visibility = 'visible'
      }, 1000)
    },
    false
  )
  window.document.body.appendChild(recordingIndicator);
}