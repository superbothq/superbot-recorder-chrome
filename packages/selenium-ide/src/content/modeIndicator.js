const addModeIndicator = (targetMode = null) => {
  if(window.self !== window.top) return;

  const fragment = document.createDocumentFragment();
  const indicator = document.createElement('div');
  const recordingText = document.createElement('label');
  recordingText.innerText = 'Superbot IDE is recording...';
  recordingText.style.color = '#E80600';
  recordingText.style.marginTop = '10px';
  
  const modeText = document.createElement('label');
  modeText.style.position = 'relative';
  modeText.style.bottom = '-10px';
  modeText.style.left = '0px';
  modeText.innerText = 'Current mode: ' + (targetMode !== null ? targetMode : 'recording');
  
  indicator.id = 'superbot-mode-indicator';
  
  indicator.style.color = '#333';
  indicator.style.fontSize = '16px';
  indicator.style.fontFamily = 'Arial, Helvetica, sans-serif';
  indicator.style.fontWeight = 'bold';
  indicator.style.textAlign = 'center';

  indicator.style.width = '280px';
  indicator.style.height = '80px';
  indicator.style.padding = '5px';
  indicator.style.margin = 'initial';
  indicator.style.zIndex = 2147483647;

  indicator.style.position = 'fixed';
  indicator.style.bottom = '36px';
  indicator.style.right = '36px';

  indicator.style.backgroundColor = 'whitesmoke';
  indicator.style.border = '1px solid #dfdfdf';
  indicator.style.borderRadius = '0px';
  indicator.style['box-shadow'] = '7px   7px 10px 0 rgba(0,0,0,0.3)'

  indicator.appendChild(recordingText);
  indicator.appendChild(modeText);
  fragment.appendChild(indicator)
  document.body.appendChild(fragment);
  
  document.getElementById('superbot-mode-indicator').addEventListener(
    'mouseenter',() => {
      indicator.style.visibility = 'hidden'
      setTimeout(() => {
        indicator.style.visibility = 'visible'
      }, 1000)
    },
    false
  )
}

export default addModeIndicator;
