const loadTestListener = () => {
  document.addEventListener('extensionLoadTest', evnt => {
    chrome.runtime.sendMessage({
      type: 'extensionLoadTest',
      testId: evnt.detail.testId
    })
  }, true);
}

const playbackTestListener = () => {
  document.addEventListener('extensionPlaybackTest', event => {
    console.log('event listener test file:', event)
    chrome.runtime.sendMessage({
      type: 'extensionPlaybackTest',
      test: event.detail.test
    })
  }, true);
}

if(document.readyState !== 'loading'){
  loadTestListener();
  playbackTestListener();
} else {
  window.addEventListener('DOMContentLoaded', () => {
    loadTestListener();
    playbackTestListener();
  }, true);
}