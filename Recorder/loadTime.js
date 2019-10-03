(() => {
  const getLoadTime = () => {
    setTimeout(() => {
      const duration = performance.getEntriesByType('navigation')[0].duration;
      if (duration > 0) {
        chrome.runtime.sendMessage({ time: (duration / 1000).toFixed(2) });
      }
    }, 0);
  }

  if (document.readyState === 'complete') {
    getLoadTime();
  } else {
    window.addEventListener('load', getLoadTime);
  }
})();
