const acceptCookies = () => {
  const elements = Array.from(document.body.querySelectorAll("*")).filter(e => {
    const skipElems = [
      "BODY",
      "SCRIPT",
      "NOSCRIPT",
      "META",
      "STYLE",
      "SOURCE",
    ];

    if (e.id && (e.id.toLowerCase().includes("container") || e.id.toLowerCase().includes("content") || e.id.toLowerCase().includes("root"))) {
      return false;
    }

    return skipElems.indexOf(e.nodeName) === -1 && (e.innerHTML.toLowerCase().includes("cookie") || e.innerHTML.toLowerCase().includes("eväste"));
  });

  for (let i = elements.length - 1; i >= 0; i--) {
    let c = elements[i];

    //console.log("includes gdpr:", c.className.toLowerCase().includes("gdpr"))
    if (c.id.toLowerCase().includes("gdpr") || c.className.toLowerCase().includes("gdpr")) {
      c.remove();
    }

    //console.log("elements:", elements);

    //const zIndex = document.defaultView.getComputedStyle(e, null).getPropertyValue("z-index");

    //console.log("element:", c);

    const buttons = c.querySelectorAll("button");
    if (buttons.length > 0) {
      for (let j = 0; j < buttons.length; j++) {
        console.log("button:", buttons[j].innerText);
        buttons[j].click();
      }
      //return
    }
    //console.log("got here!")
    const links = c.querySelectorAll("a");
    if (links.length > 0) {
      for (let j = 0; j < links.length; j++) {
        if (!links[i] || links[i].href) continue;

        //console.log("link:", links[j].innerText);
        links[j].click();
        return
      }
    }

    while (true) {
      //console.log("parent loop elem:", c);
      const p = c.parentElement;
      if (!p) break;;

      const partOfElem = (p.clientWidth - c.clientWidth) > 5 || (p.clientHeight - c.clientHeight) > 5;
      const notAnotherElem = (p.clientWidth - c.clientWidth) < 50 || (p.clientHeight - c.clientHeight) < 50;
      const identicalDimensions = (p.clientWidth === c.clientWidth && p.clientHeight === c.clientHeight);
      const notBody = p.nodeName !== "BODY"

      if (((partOfElem && notAnotherElem) || identicalDimensions) && notBody && c.parentElement) {
        c = p;
      } else {
        //console.warn("REMOVE!");
        c.remove()
        return
      }
    }
  }
}
