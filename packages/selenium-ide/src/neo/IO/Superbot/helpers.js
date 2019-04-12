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

export const spawnTargetIndicator = (x , y, width, height) => {
  if(window.self !== window.top) return;

  const targetIndicator = document.createElement('div');
  targetIndicator.id = 'superbot-target-indicator';
  targetIndicator.style.position = 'fixed';
  targetIndicator.style.top = y + 'px';
  targetIndicator.style.left = x + 'px';
  targetIndicator.style.width = width + 'px';
  targetIndicator.style.height = height + 'px';
  targetIndicator.style.zIndex = 2147483647;
  targetIndicator.style.backgroundColor = '#77dd777F';
  targetIndicator.style.display = 'block';
  document.body.appendChild(targetIndicator);
  setTimeout(() => targetIndicator.remove(), 150);
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

export const waitForCanvas = (canvas, context, width, height) => {
  return new Promise(resolve => {
    const timerId = setInterval(() => {
      if(isCanvasDrawn(context, width, height)){
        resolve(canvas.toDataURL());
        canvas.remove()
        clearInterval(timerId);
      }
    }, 20);
  })
}

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