const renderResult = (source, template, result) => {
  const c = document.createElement('canvas');
  c.onclick = () => c.remove();

  c.style.position = 'absolute';
  c.style.top = '10px';
  c.style.left = '0px';
  c.style.zIndex = 2147444444;
  c.style.width = '98%';
  c.style.border = '1px solid black';
  c.style.left = '10px';
  document.body.appendChild(c);
  
  const maxPoint = result.maxLoc;
  const color = result.maxVal > 0.9 ?
  new cv.Scalar(0, 255, 0, 255) : 
  new cv.Scalar(255, 0, 0, 255);

  const point = new cv.Point(maxPoint.x + template.cols, maxPoint.y + template.rows);
  cv.rectangle(source, maxPoint, point, color, 2, cv.LINE_8, 0);
  
  cv.imshow(c, source);
  setTimeout(() => {
    c.remove()
  }, 5000);
}

const readBase64Image = (dataUrl) => {
  return new Promise(resolve => {
    let tempIMG = new Image;
    tempIMG.onload = () => {
      resolve(cv.imread(tempIMG));
      tempIMG = null;
    }
    tempIMG.src = dataUrl;
  })
}

const compareImages = async (img1, img2) => {
  console.time('compare images took')
  const matrices = await Promise.all([readBase64Image(img1), readBase64Image(img2)])
  const results = await templateMatch(matrices);
  console.timeEnd('compare images took')
  return results;
}

const templateMatch = async (matrices) => {
  const dest = new cv.Mat();
  const mask = new cv.Mat();
  cv.matchTemplate(matrices[0], matrices[1], dest, cv.TM_CCOEFF_NORMED);
  const result = cv.minMaxLoc(dest, mask);
  result.width = matrices[1].size().width;
  result.height = matrices[1].size().height;

  //TODO: for debugging purposes, remove...
  renderResult(matrices[0], matrices[1], result);
  
  dest.delete();
  mask.delete();
  return result;
}

export default compareImages;