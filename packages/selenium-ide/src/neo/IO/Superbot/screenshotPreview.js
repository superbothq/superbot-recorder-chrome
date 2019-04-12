const selectionDone = (status, resolve) => {
  const modal = document.getElementById('element-screenshot-preview');
  if(modal !== null){
    modal.remove();
  }
  resolve(status);
}

const previewScreenshot = dataUrl => {
  return new Promise(async (resolve) => {
    if(window.self !== window.top) return;

    let elem = document.getElementById('element-screenshot-preview');
    if(elem !== null){
      elem.remove();
    }

    const previewIframe = document.createElement('iframe');
    previewIframe.id = 'element-screenshot-preview';
    previewIframe.style.zIndex = 2147483647;
    previewIframe.style.position = 'fixed';
    previewIframe.style.top = '20px';
    previewIframe.style.left = '20px';
    previewIframe.style.width = '93.5%';
    previewIframe.style.height = '43%';
    previewIframe.style.backgroundColor = '#fff';
    previewIframe.style.border = '2px solid #3987BA';
    previewIframe.style.borderRadius = '5px';
    previewIframe.style.boxShadow = '0 5px 11px 0 rgba(0, 0, 0, 0.33), 0 4px 15px 0 rgba(0, 0, 0, 0.32)';

    const container = document.createElement('div');
    container.id = 'screenshot-preview-container';
    container.style.width = '100%';
    container.style.height = '100%';

    const text = document.createElement('p');
    text.style.fontFamily = 'sans-serif';
    text.style.fontSize = '22px';
    text.style.color = '#333';
    text.style.padding = '5px 0 0 5px';
    text.innerText = 'Element screenshot'

    const xbutton = document.createElement('div')
    xbutton.style.position = 'absolute';
    xbutton.style.top = '5px';
    xbutton.style.right = '15px';
    xbutton.style.fontSize = '26px';
    xbutton.style.cursor = 'pointer';
    xbutton.innerText = '×';
    xbutton.onclick = () => selectionDone(false, resolve);
    
    const image = await new Promise(resolve => {
      const tmp = document.createElement('img');
      tmp.style.maxWidth = '97%';
      tmp.style.maxHeight = '72%';
      tmp.style.position = 'absolute';
      tmp.style.top = '50%';
      tmp.style.left = '50%';      
      tmp.onload = () => {
        tmp.style.marginLeft = `-${tmp.clientWidth / 2}px`;
        tmp.style.marginTop = `-${tmp.clientHeight / 2}px`;
        resolve(tmp);
      }
      tmp.src = dataUrl;
    })

    const noButton = document.createElement('button');
    noButton.style.position = 'absolute';
    noButton.style.bottom = '10px';
    noButton.style.right = '110px';
    noButton.style.color = '#3987BA';
    noButton.style.fontSize = '20px';
    noButton.style.padding = '1px 20px';
    noButton.style.borderRadius ='2px';
    noButton.style.border = '2px solid #3987BA';
    noButton.style.background = 'inherit';
    noButton.style.cursor = 'pointer';
    noButton.innerText = 'Retake'
    noButton.onclick = () => selectionDone(false, resolve);

    const yesButton = document.createElement('button');
    yesButton.style.position = 'absolute';
    yesButton.style.bottom = '10px';
    yesButton.style.right = '10px';
    yesButton.style.border = 'none';
    yesButton.style.background = '#3987BA';
    yesButton.style.color = '#fff';
    yesButton.style.fontSize = '20px';
    yesButton.style.padding = '3px 22px';
    yesButton.style.borderRadius = '2px';
    yesButton.style.cursor = 'pointer';
    yesButton.innerText = 'Save'
    yesButton.onclick = () => selectionDone(true, resolve);

    container.appendChild(text);
    container.appendChild(xbutton);
    container.appendChild(image);
    container.appendChild(noButton);
    container.appendChild(yesButton);
    document.body.appendChild(previewIframe);

    const domIframe = document.getElementById('element-screenshot-preview');
    domIframe.contentDocument.body.style.margin = 'none';
    
    domIframe.contentDocument.body.appendChild(container);
  })
}

export default previewScreenshot;