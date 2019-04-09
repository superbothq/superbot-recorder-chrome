const addActionNotification = (message) => {
  if(window.self !== window.top) return;

  const fragment = document.createDocumentFragment();
  const nc = document.createElement('iframe');
  nc.id = 'superbot-action-notification';
  nc.style.position = 'fixed';
  nc.style.top = '15px'; //-80px
  nc.style.left = '15px';
  nc.style.width = '280px';
  nc.style.height = '55px';
  nc.style.zIndex = 2147483647;
  nc.style.backgroundColor = '#39e491';
  nc.style.border = '1px solid #00c163';
  nc.style.borderRadius = '2px';
  //nc.style.animation = '2s bounce infinite';
  
  const msgText = document.createElement('p');
  msgText.innerText = message;
  msgText.style.textAlign = 'center';
  msgText.style.fontSize = '18px';
  msgText.style.margin = '16px 0 0 0';
  msgText.style.color = '#fff';
  msgText.style.fontFamily = 'Helvetica';

  const fadeOutBar = document.createElement('div');
  fadeOutBar.style.height = '3px';
  fadeOutBar.style.width = '100%';
  fadeOutBar.style.position = 'absolute';
  fadeOutBar.style.left = '0px';
  fadeOutBar.style.bottom = '0px';
  fadeOutBar.style.backgroundColor = '#07a558';
      
  fragment.appendChild(nc)
  document.body.appendChild(fragment);

  const notificationContainer = document.getElementById('superbot-action-notification');
  notificationContainer.contentDocument.body.appendChild(msgText);
  notificationContainer.contentDocument.body.appendChild(fadeOutBar);
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
