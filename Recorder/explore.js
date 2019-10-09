(() => {
  window.onfocus = () => {
    chrome.runtime.sendMessage({ type: "updateContextMenu" });
  }

  window.onload = () => {
    chrome.runtime.sendMessage({ type: "getExploringStatus" }, (exploringStatus) => {
      if (exploringStatus) {
        explore();
      }
    })
  }

  chrome.runtime.onMessage.addListener((msg, sender, res) => {
    if (msg.exploring) {
      explore();
    }

    if (chrome.runtime.lastError) {
      console.error("Tab runtime error:", chrome.runtime.lastError.message);
    }
  })

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

  const sleep = (delay) => new Promise(resolve => setTimeout(resolve, delay));

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

      const animateScroll = () => {
        currentTime += increment;
        const step = easeInOutQuad(currentTime, start, change, duration);
        scroll(step);

        if (Math.round(step) === Math.round(to)) {
          resolve()
        } else if (currentTime < duration) {
          requestAnimationFrame(animateScroll);
        } else {
          resolve();
        }
      }

      animateScroll();
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

  const navigate = (url) => {
    window.location.href = url;
    if (/^#/.test(window.location.href) || !!window.location.hash || window.location.href[window.location.href.length - 1] === "#") {
      explore();
    }
  }

  const simulateBrowsing = async () => {
    const scrollableHeight = Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight);
    if (scrollableHeight === window.innerHeight) {
      await sleep(rand(3) * 1000);
      return;
    }

    const randomDelay = rand(10);

    const scrollDownDelay = rand(randomDelay / 3) + 1;
    const waitDelay = rand((randomDelay - scrollDownDelay) / 3 * 2) + 1;
    const scrollUpDelay = rand(randomDelay - scrollDownDelay - waitDelay) + 1;

    const scrollDownAmount = scrollableHeight * (30 + rand(60)) / 100;
    const scrollUpAmount = scrollDownAmount * rand(80) / 100;

    //console.log("Scroll delays:", { randomDelay, waitDelay, scrollDownDelay, scrollUpDelay });
    //console.log("Scroll px:", { scrollDownAmount, scrollUpAmount });

    await smootherScroll(scrollDownAmount, scrollDownDelay * 1000);

    await sleep(waitDelay * 1000);

    await smootherScroll(scrollUpAmount, scrollUpDelay * 1000);
  }

  const explore = async () => {
    await simulateBrowsing();

    const discoveredUrls = collectUrls();
    const urlFromCurrentPage = 1 - Math.random() > 0.05;

    let nextUrl = null;
    if (urlFromCurrentPage) {
      const index = rand(discoveredUrls.length - 1);
      nextUrl = discoveredUrls.splice(index, 1)[0];
    }

    if (discoveredUrls.length > 0) {
      chrome.runtime.sendMessage({ type: "addUrls", discoveredUrls, visitedUrl: nextUrl })
    }

    if (nextUrl) {
      navigate(nextUrl);
    } else {
      chrome.runtime.sendMessage({ type: "getNextUrl" }, (url) => {
        if (url) {
          navigate(url);
        }
      });
    }
  }
})();
