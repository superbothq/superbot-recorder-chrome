const removeModal = () => {
  const modal = document.getElementById('template-match-preview');
  if(modal !== null){
    modal.remove();
  }
}

const templateMatchPreview = (command, images, target, value) => new Promise(async () => {
  const elem = document.getElementById('template-match-preview');
  if(elem !== null){
    elem.remove();
  }

  const previewIframe = document.createElement('iframe');
  previewIframe.id = 'template-match-preview';
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
  text.innerText = 'Command template image'

  const xbutton = document.createElement('div')
  xbutton.style.position = 'absolute';
  xbutton.style.top = '5px';
  xbutton.style.right = '15px';
  xbutton.style.fontSize = '26px';
  xbutton.style.cursor = 'pointer';
  xbutton.innerText = '×';
  xbutton.onclick = () => removeModal();
  
  const image = await new Promise(resolve => {
    const tmp = document.createElement('img');
    //tmp.style.maxWidth = '97%';
    //tmp.style.maxHeight = '72%';
    tmp.style.position = 'absolute';
    tmp.style.top = '50%';
    tmp.style.left = '50%';      
    tmp.onload = () => {
      tmp.style.marginLeft = `-${tmp.clientWidth / 2}px`;
      tmp.style.marginTop = `-${tmp.clientHeight / 2}px`;
      resolve(tmp);
    }
    console.log('images:', images)
    tmp.src = images[0];
  })
  
  const commandText = document.createElement('p');
  commandText.style.margin = '0 0 5px 0';
  commandText.style.fontSize = '16px';
  commandText.style.color = '#333';
  commandText.innerText = `Command: ${command}`;

  const targetText = document.createElement('p');
  targetText.style.margin = '0 0 5px 0';
  targetText.style.fontSize = '16px';
  targetText.style.color = '#333';
  targetText.innerText = `Target: ${target}`;

  container.appendChild(text);
  container.appendChild(xbutton);
  container.appendChild(image);
  container.appendChild(commandText);
  container.appendChild(targetText);
  if(command.value && command.value !== ''){
    const valueText = document.createElement('p');
    valueText.style.margin = '0 0 5px 0';
    valueText.style.fontSize = '16px';
    valueText.style.color = '#333';
    valueText.innerText = `Value: ${value}`;

    container.appendChild(valueText);
  }
  document.body.appendChild(previewIframe);

  const domIframe = document.getElementById('template-match-preview');
  domIframe.contentDocument.body.style.margin = 'none';

  domIframe.contentDocument.body.appendChild(container);

  setTimeout(() => {
    try {
      previewIframe.remove();
    } catch(e) {
    }
  }, 3000)
})

export default templateMatchPreview;