export const nodeResolver = (el) => {
  if(el === null) return null;
  if(typeof el.click === 'function'){
    return el
  } else {
    let pNode = el.parentNode
    while(typeof pNode.click !== 'function'){
      pNode = pNode.parentNode
    }
    return pNode
  }
};

export const cssPathBuilder = (el) => {
  if (!(el instanceof Element)){
    return;
  }
  const path = [];
  while (el !== null && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break;
    } else {
      let sib = el, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() == selector)
          nth++;
      }
      if (nth != 1)
        selector += ":nth-of-type(" + nth + ")";
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
};

const isCanvasDrawn = (context, width, height) => {
  const pixels = context.getImageData(0, 0, width, height).data;
  for(let i = 0; i < pixels.length; i++){
    if(pixels[i] !== 0){
      return true;
    }
  }
  return false;
}

export const waitForCanvas = (canvas, context) => new Promise(resolve => {
  const timerId = setInterval(() => {
    if(isCanvasDrawn(context, canvas.width, canvas.height)){
      resolve(canvas.toDataURL());
      clearInterval(timerId);
    }
  }, 10);
})

export const focusWindow = () => {
  chrome.windows.getCurrent(window => {
    chrome.tabs.getSelected(window.id, response => {
      chrome.windows.update(response.windowId, { focused: true }, () => {
        //check the error message :^)
        chrome.runtime.lastError;
      });
    });
  });
}