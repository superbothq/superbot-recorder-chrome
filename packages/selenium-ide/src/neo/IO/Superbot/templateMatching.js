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
  const matchesFiltered = [];
  for(let i = 0; i < matches.length; i++){
    if(matches[i] !== undefined && matches[i].minVal !== 1 && matches[i].maxVal > 0.85){
      matchesFiltered.push(matches[i]);
    }
  }
  console.log('parentsToDom raw:', matches)
  console.log('parentsToDom filtered:', matchesFiltered)

  if(matchesFiltered.length < 1){
    return null;
  } else {
    const bestMatch = sortResults(matchesFiltered);
    console.log('Best parent to DOM match:', bestMatch)
    return bestMatch;
  }
}

const targetToParents = async (parents, targetElement) => {
  const matchesPromises = [];
  for(let i = 0; i < parents.length; i++){
    matchesPromises.push(templateMatch(parents[i], targetElement));
  }

  const matches = await Promise.all(matchesPromises);
  const matchesFiltered = [];
  for(let i = 0; i < matches.length; i++){
    if(matches[i] !== undefined && matches[i].minVal !== 1 && matches[i].maxVal > 0.9){
      matchesFiltered.push(matches[i]);
    }
  }

  console.log('targetToParents raw:', matches)
  console.log('targetToParents:', matchesFiltered)

  if(matchesFiltered.length < 1){
    return null;
  } else {
    const bestMatch = sortResults(matchesFiltered);
    console.log('Best target to parent match:', bestMatch)
    return bestMatch;
  }
}

const compareImages = async (sourceData, templatesData) => {
  //Convert base64 data to matrices
  const matricesPromises = [];
  for(let i = 0; i < templatesData.length; i++){
    matricesPromises.push(readBase64Image(templatesData[i]));
  }
  const source = await readBase64Image(sourceData);
  const templates = await Promise.all(matricesPromises);
  const targetEl = templates.shift();

  //Remove falty templates
  for(let i = 0; i < templates.length; i++){
    if(source.cols < templates[i].cols || source.rows < templates[i].rows){
      templates[i].delete();
      templates.splice(i, 1);
    }
  }

  //Test if opencv can identify target element straight away
  const targetElementResult = await templateMatch(source, targetEl);
  //const copiedSource = source.clone();
  //renderResult(copiedSource, targetEl, targetElementResult)
  //Uncomment line below to test fallback
  //targetElRes.maxVal -= 1.0;
  
  if(parseFloat(targetElementResult.maxVal.toFixed(2)) > 0.9){
    const targetElementCoordinates = {
      x: targetElementResult.maxLoc.x + (targetElementResult.width / 2),
      y: targetElementResult.maxLoc.y + (targetElementResult.height / 2),
    };
    console.log('targetElementCoordinates:', targetElementCoordinates)
    return targetElementCoordinates;
  }

  //Compare target element's parents to DOM
  //Compare target element to it's parents

  const results = await Promise.all([parentsToDom(source, templates), targetToParents(templates, targetEl)]);
  console.log('Fallback results:', results)

  source.delete();
  targetEl.delete();
  for(let i = 0; i < templates.length; i++){
    templates[i].delete();
  }

  if(results[0] !== null && results[1] !== null){
    const targetElementCoordinates = {
      x: (results[0].maxLoc.x + results[1].maxLoc.x) + (results[1].width / 2),
      y: (results[0].maxLoc.y + results[1].maxLoc.y) + (results[1].height / 2),
    };
    console.log('targetElementCoordinates:', targetElementCoordinates)
    return targetElementCoordinates;
  } else {
    return null;
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
      
    dest.delete();
    mask.delete();
    resolve(result);
  } catch(e) {
    resolve(undefined);
    console.log('Error during template match:', e)
  }
})

export default compareImages;