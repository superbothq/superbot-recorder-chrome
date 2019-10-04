(() => {
  window.onload = () => {
    chrome.runtime.sendMessage({ type: "getExploringStatus" }, (status) => {
      if (true) {
        explore();
      }
    })
  }

  window.onfocus = () => {
    chrome.runtime.sendMessage({ type: "updateContextMenu" });
  }

  const sanitizeUrl = (url) => {
    if (!url) return null;

    const uri = new URL(url);
    if (uri.protocol !== "http:" && uri.protocol !== "https:") {
      return null;
    }

    const host = new URL(window.location.href);
    if (uri.host !== host.host) {
      return null;
    }

    if (uri.pathname.includes(".")) {
      const parts = uri.pathname.split(".");
      const extension = parts[parts.length - 1];
      const validExtensions = [
        "htm", "xhtm", "shtm", "php", "phtm", "asp", "do",
        "jsp", "jsp", "action", "wss", "pl", "rhtm", "cgi",
        "dll", "cfm", "yaws", "hta"
      ];


      if (validExtensions.indexOf(extension) < 0) {
        return null;
      }
    }

    return url;
  }


  const smootherScroll = (to, duration) => {
    return new Promise(resolve => {
      const scroll = (amount) => {
        document.documentElement.scrollTop = amount;
        document.body.parentNode.scrollTop = amount;
        document.body.scrollTop = amount;
      }

      const position = () => document.documentElement.scrollTop || document.body.parentNode.scrollTop || document.body.scrollTop;

      let start = position();
      let change = to - start;
      let currentTime = 0;
      let increment = 20;

      console.log("-------------------");

      console.log("start:", start);
      console.log("to:", to);
      console.log("change:", change);
      console.log("currentTime:", currentTime);
      console.log("increment:", increment);
      console.log("duration:", duration);

      const animateScroll = () => {
        currentTime += increment;
        const step = easeInOutQuad(currentTime, start, change, duration);
        scroll(step);

        if (currentTime < duration) {
          requestAnimationFrame(animateScroll);
        } else if (step >= to) {
          return resolve();
        }
      }

      animateScroll();
    })
  }

  const sleep = (duration) => {
    return new Promise(resolve => {
      console.log("SLEEP!");
      setTimeout(resolve, duration);
    })
  }

  const collectUrls = () => {
    const hrefLinks = Array.from(document.querySelectorAll('a')).map(e => e.href);
    const iframeSrcs = Array.from(document.querySelectorAll('iframe')).map(e => e.src);
    const frameSrcs = Array.from(document.querySelectorAll('frame')).map(e => e.src);
    const areaHrefs = Array.from(document.querySelectorAll('area')).map(e => e.href);

    const destinations = [...hrefLinks, ...iframeSrcs, ...frameSrcs, ...areaHrefs];
    return destinations.map(e => sanitizeUrl(e)).filter(e => e);
  }

  const simulateBrowsing = async (url) => {
    if (!url) {
      return chrome.runtime.sendMessage({ type: "exploreQuit" })
    }

    const randomDelay = rand(10) + 1;

    console.log("random delay:", randomDelay);

    const scrollDownDelay = rand(randomDelay / 3) + 1;
    const fakeReadDelay = rand((randomDelay - scrollDownDelay) / 3 * 2) + 1;
    const scrollUpDelay = rand(randomDelay - scrollDownDelay - fakeReadDelay) + 1;

    const scrollDownAmount = document.body.scrollHeight * (10 + rand(90)) / 100;
    const distanceFromTop = document.documentElement.scrollTop || document.body.parentNode.scrollTop || document.body.scrollTop;
    const scrollUpAmount = distanceFromTop - Math.min(Math.max(document.body.scrollHeight * rand(50) / 100, 0), distanceFromTop)

    console.log("scroll down delay:", scrollDownDelay);
    console.log("fake read delay:", fakeReadDelay);
    console.log("scroll up delay:", scrollUpDelay);
    console.log("scroll down amount:", scrollDownAmount);
    console.log("scroll up amount:", scrollUpAmount);

    await smootherScroll(scrollDownAmount, scrollDownDelay * 1000);

    setTimeout(async () => {
      console.log("AFTER SLEEP!");

      await smootherScroll(scrollUpAmount, scrollUpDelay * 1000);

      chrome.runtime.sendMessage({ type: "getExploringStatus" }, (exploringStatus) => {
        console.log("exploringStatus:", exploringStatus)
        if (true) {
          window.location.href = url;
        }
      })
    }, fakeReadDelay * 1000);
  }

  const explore = () => {
    const currentPageUrls = collectUrls();
    const urlFromCurrentPage = 1 - Math.random() > 0.05;

    let url = null;
    if (urlFromCurrentPage) {
      const index = rand(currentPageUrls.length);
      url = currentPageUrls.splice(index, 1);
    }

    console.log("currentPageUrls:", currentPageUrls);

    if (currentPageUrls.length > 0) {
      chrome.runtime.sendMessage({ type: "addDiscoveredUrls", urls: currentPageUrls })
    }

    if (url) {
      simulateBrowsing(url);
    } else {
      chrome.runtime.sendMessage({ type: "getNextUrl" }, (url) => simulateBrowsing(url));
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, res) => {
    console.log("msg.exploring:", msg.exploring);
    if (msg.exploring) {
      explore();
    }

    if (chrome.runtime.lastError) {
      console.log("tabs runtime error:", chrome.runtime.lastError.message);
    }
  })
})();
