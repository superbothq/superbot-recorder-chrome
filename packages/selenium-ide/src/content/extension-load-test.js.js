const loadTestListener = () => {
  document.addEventListener('extensionLoadTest', evnt => {
    chrome.runtime.sendMessage({ type: 'extensionLoadTest', testId: evnt.detail.testId })
  }, true);
}

if(document.readyState !== 'loading'){
  loadTestListener();
} else {
  window.addEventListener('DOMContentLoaded', loadTestListener, true)
}