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
    //c.remove()
  }, 5000);
}

const readBase64Image = (dataUrl) => new Promise(resolve => {
  let tempIMG = new Image;
  tempIMG.onload = () => {
    resolve(cv.imread(tempIMG));
    tempIMG = null;
  }
  tempIMG.src = dataUrl;
})

const sortResults = (results) => {
  const sorted = results.reduce((res, iter, index) => {
    try {
      //Copy variables to avoid changing the original values
      const prev = {...res}
      const current = {...iter}
      //If minVal gained > maxVal lost -> select current
      if(prev.maxVal > current.maxVal){
        if(((current.minVal) - (prev.minVal)) > (prev.maxVal - current.maxVal)){
          return { ...iter, index }
        } else {
          return { ...res, index }
        }
      } else {
        //If maxVal gained > minVal lost -> select current
        if((-(current.minVal) - -(prev.minVal)) < (current.maxVal - prev.maxVal)){
          return { ...iter,  index }
        } else {
          return { ...res, index }
        }
      }
    } catch(e) {
      console.log('sortResults error:', e)
    }
  })

  return sorted;
}

const parentsToDom = async (source, parents) => {
  const matchesPromises = [];
  for(let i = 0; i < parents.length; i++){
    matchesPromises.push(templateMatch(source, parents[i]));
  }

  const matches = await Promise.all(matchesPromises);
  console.log('parentsToDom matches:', matches)

  if(matches.length < 1){
    return null;
  } else {
    const res = sortResults(matches);
    console.log('Best parent match:', res)
    return res
  }
}

const compareImages = async (sourceData, templatesData) => {
  //Convert base64 data to matrices
  const matricesPromises = [];
  for(let i = 0; i < templatesData.length; i++){
    matricesPromises.push(readBase64Image(templatesData[i]));
  }
  const source = await readBase64Image(sourceData);
  const templatesUnfiltered = await Promise.all(matricesPromises);
  console.log('unfiltered templates:', templatesUnfiltered)
  const targetEl = templatesUnfiltered.shift();

  //Test if opencv can identify target element straight away
  const targetElementResult = await templateMatch(source, targetEl);
  console.log('targetElementResult:', targetElementResult)
  if(targetElementResult && targetElementResult.maxVal > 0.9){
    const targetElementCoordinates = {
      x: targetElementResult.maxLoc.x + (targetElementResult.width / 2),
      y: targetElementResult.maxLoc.y + (targetElementResult.height / 2),
    };
    console.log('targetElementCoordinates:', targetElementCoordinates)
    return targetElementCoordinates;
  } else {
    //Remove falty templates
    const templates = templatesUnfiltered.filter(t => t.cols <= source.cols && t.rows <= source.rows)
    console.log('filtered templates:', templates)

    //check parents to dom return p
    //check if target el is found in p
    const parent = await parentsToDom(source, templates);
    if(parent.maxVal < 0.9){
      return null;
    } 
    console.log('parent:', parent)
    console.log('templates:', templatesData)

    const targetToParent = await templateMatch(parent.mat, targetEl)
    console.log('targetToParent:', targetToParent)
    if(targetToParent.maxVal < 0.9){
      return null;
    }

    const targetElementCoordinates = {
      x: (parent.maxLoc.x + targetToParent.maxLoc.x) + (targetToParent.width / 2),
      y: (parent.maxLoc.y + targetToParent.maxLoc.y) + (targetToParent.height / 2),
    };
    console.log('targetElementCoordinates:', targetElementCoordinates)
    return targetElementCoordinates;
  }
}

const templateMatch = (source, template) => new Promise(resolve => {
  try {
    const dest = new cv.Mat();
    const mask = new cv.Mat();
    cv.matchTemplate(source, template, dest, cv.TM_CCOEFF_NORMED);
    const result = cv.minMaxLoc(dest, mask);
    result.width = template.size().width;
    result.height = template.size().height;

    //DEBUG
    //const copiedSource = source.clone();
    //renderResult(copiedSource, template, result)
      
    dest.delete();
    mask.delete();
    resolve({
      ...result,
      mat: template
    });
  } catch(e) {
    resolve(undefined);
    console.log('Error during template match:', e)
  }
})

export default compareImages;