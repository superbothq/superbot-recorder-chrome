const addActionNotification = (message) => {
  if(window.self !== window.top) return;

  const fragment = document.createDocumentFragment();
  const nc = document.createElement('iframe');
  nc.id = 'superbot-action-notification';
  nc.style.position = 'fixed';
  nc.style.top = '15px'; //-80px
  nc.style.left = '15px';
  nc.style.width = '290px';
  nc.style.height = '60px';
  nc.style.zIndex = 2147483647;
  nc.style.backgroundColor = '#fff';
  nc.style.border = '2px solid #23a3f3';
  nc.style.borderRadius = '2px';
  nc.style.boxShadow = '3px 3px 5px 0px rgba(0,0,0,0.5)';
  
  const msgText = document.createElement('p');
  msgText.innerText = message;
  msgText.style.textAlign = 'center';
  msgText.style.fontSize = '15px';
  msgText.style.margin = '21px 0 0 0';
  msgText.style.color = '#333';
  msgText.style.fontFamily = 'Helvetica';

  const fadeOutBar = document.createElement('div');
  fadeOutBar.style.height = '3px';
  fadeOutBar.style.width = '100%';
  fadeOutBar.style.position = 'absolute';
  fadeOutBar.style.left = '0px';
  fadeOutBar.style.bottom = '0px';
  fadeOutBar.style.backgroundColor = '#6dc7ff';
      
  fragment.appendChild(nc)
  document.body.appendChild(fragment);

  const notificationContainer = document.getElementById('superbot-action-notification');
  notificationContainer.contentDocument.body.appendChild(msgText);
  notificationContainer.contentDocument.body.appendChild(fadeOutBar);
  notificationContainer.contentDocument.body.style.overflow = 'hidden';
  notificationContainer.onclick = () => {
    notificationContainer.remove();
  }
  
  const notificationTime = 1000;
  const stepInterval = 20;

  const bar = notificationContainer.contentDocument.body.children[1];
  const barDimensions = bar.getBoundingClientRect();
  const shortenPerStep = barDimensions.width / (notificationTime / stepInterval);
  
  let currentWidth = barDimensions.width;
  const barStepInterval = setInterval(() => {
    bar.style.width = `${currentWidth - shortenPerStep}px`;
    currentWidth -= shortenPerStep;
    if(currentWidth < 0){
      clearInterval(barStepInterval);
      notificationContainer.remove();
    }
  }, stepInterval)
}

export default addActionNotification;
