const addModeIndicator = (targetMode = null) => {
  if(window.self !== window.top || document.getElementById('superbot-mode-indicator') !== null) return;


  const fragment = document.createDocumentFragment();
  const indicatorContainer = document.createElement('iframe')
  indicatorContainer.id = 'superbot-mode-indicator';
  indicatorContainer.style.position = 'fixed';
  indicatorContainer.style.bottom = '15px';
  indicatorContainer.style.right = '15px';
  indicatorContainer.style.width = '280px';
  indicatorContainer.style.height = '80px';
  indicatorContainer.style.border = '1px solid rgb(223, 223, 223)';
  indicatorContainer.style.boxShadow = 'rgba(0, 0, 0, 0.3) 7px 7px 10px 0px';
  indicatorContainer.style.zIndex = 2147483647;

  const recordingText = document.createElement('p');
  recordingText.innerText = 'Superbot IDE is recording...';
  recordingText.style.color = '#E80600';
  recordingText.style.marginBottom = '-3px';
  
  const modeText = document.createElement('p');
  modeText.innerText = 'Current mode: ' + (targetMode !== null ? targetMode : 'recording');
    
  fragment.appendChild(indicatorContainer)
  document.body.appendChild(fragment);

  const iframe = document.getElementById('superbot-mode-indicator')
  iframe.contentDocument.body.appendChild(recordingText);
  iframe.contentDocument.body.appendChild(modeText);
  iframe.contentDocument.body.style.color = '#333';
  iframe.contentDocument.body.style.fontSize = '16px';
  iframe.contentDocument.body.style.fontFamily = 'Arial, Helvetica, sans-serif';
  iframe.contentDocument.body.style.fontWeight = 'bold';
  iframe.contentDocument.body.style.textAlign = 'center';
  iframe.contentDocument.body.style.padding = '5px';
  iframe.contentDocument.body.style.backgroundColor = 'whitesmoke';
  
  document.getElementById('superbot-mode-indicator').addEventListener(
    'mouseenter',() => {
      indicatorContainer.style.visibility = 'hidden'
      setTimeout(() => {
        indicatorContainer.style.visibility = 'visible'
      }, 1000)
    },
    false
  )
}

export default addModeIndicator;
