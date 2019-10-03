(() => {
  window.onfocus = () => {
    chrome.runtime.sendMessage({ type: "updateContextMenu" });
  }

  const getAsyncMessage = (type) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type }, (status) => resolve(status))
    })
  }

  const sanitizeUrl = (url) => {
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

  const explore = async () => {
    const hrefLinks = Array.from(document.querySelectorAll('a')).map(e => e.href);
    const iframeSrcs = Array.from(document.querySelectorAll('iframe')).map(e => e.src);
    const frameSrcs = Array.from(document.querySelectorAll('frame')).map(e => e.src);
    const areaHrefs = Array.from(document.querySelectorAll('area')).map(e => e.href);

    const destinations = [...hrefLinks, ...iframeSrcs, ...frameSrcs, ...areaHrefs];
    const sanitizedUrls = destinations.map(e => sanitizeUrl(e)).filter(e => e);

    const urlFromCurrentPage = 1 - Math.random() > 0.05;

    let nextUrl = null;
    if (urlFromCurrentPage) {
      const index = Math.floor(Math.random * sanitizedUrls.length);
      nextUrl = sanitizedUrls.splice(index, 1);
    }

    if (sanitizedUrls.length > 0) {
      chrome.runtime.sendMessage({ type: "addDiscoveredUrls", urls: sanitizedUrls })
    }

    if (!nextUrl) {
      nextUrl = await getAsyncMessage("getNextUrl");
    }

    if (!nextUrl) {
      chrome.runtime.sendMessage({ type: "exploreQuit" })
    }
  }

  chrome.runtime.onMessage.addListener(async (msg, sender, res) => {
    if (msg.exploring) {
      explore();
    }

    if (chrome.runtime.lastError) {
      console.log("tabs runtime error:", chrome.runtime.lastError.message);
    }

    return true;
  })
})();
