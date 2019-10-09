(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get("cache", (data) => {
      if (!data.cache) {
        data.cache = {};
      }
      chrome.storage.local.set(data);
    })
  });

  const rand = (max) => {
    if (!max) {
      max = Math.max();
    }
    return Math.floor(Math.random() * max)
  }

  const updateContextMenu = (currentStatus) => {
    const updated = {
      title: currentStatus ? "Stop exploring" : "Start exploring"
    }

    chrome.contextMenus.update("explore", updated);
  }

  chrome.contextMenus.create({
    id: "explore",
    title: "Start exploring",
    contexts: ["browser_action"]
  });

  const getTab = (tabId) => {
    return new Promise(resolve => {
      chrome.storage.local.get("cache", (data) => {
        const id = `tab-${tabId}`;
        if (!data.cache[id]) {
          data.cache[id] = {};
          data.cache[id].exploringStatus = false;
          data.cache[id].discoveredUrls = [];
          data.cache[id].visitedUrls = [];
        }

        resolve(data.cache[id]);
      })
    })
  }

  const updateTab = (id, tab) => {
    chrome.storage.local.get("cache", (data) => {
      const tabId = `tab-${id}`;
      data.cache[tabId] = tab;
      chrome.storage.local.set(data);
    })
  }

  const deleteTab = (id) => {
    chrome.storage.local.get("cache", (data) => {
      delete data.cache[`tab-${id}`];
      chrome.storage.local.set(data);
    });
  }

  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.time) {
      chrome.browserAction.setBadgeText({
        text: req.time,
        tabId: sender.tab.id
      });
      return;
    }

    getTab(sender.tab.id).then((tab) => {
      switch (req.type) {
        case "updateContextMenu": {
          updateContextMenu(tab.exploringStatus);
        } break;

        case "getExploringStatus": {
          sendResponse(tab.exploringStatus);
        } break;

        case "addUrls": {
          let newUrls = [];
          if (req.discoveredUrls && req.discoveredUrls.length > 0) {
            newUrls = [...tab.discoveredUrls, ...req.discoveredUrls];
            tab.discoveredUrls = [...new Set(newUrls)];
          }

          if (req.visitedUrl) {
            tab.visitedUrls = [...new Set([...tab.visitedUrls, req.visitedUrl])];
          }

          updateTab(sender.tab.id, tab);
        } break;

        case "getNextUrl": {
          if (tab.exploringStatus !== true) {
            return sendResponse(null);
          }

          if (tab.discoveredUrls.length < 1 && tab.visitedUrls.length > 0) {
            const url = tab.visitedUrls[rand(tab.visitedUrls.length - 1)];
            return sendResponse(url);
          }

          const index = rand(tab.discoveredUrls.length - 1);
          const url = tab.discoveredUrls.splice(index, 1);
          tab.visitedUrls = [...new Set([...tab.visitedUrls, url])];
          updateTab(sender.tab.id, tab);
          sendResponse(url);
        } break;

        default: break;
      }

      if (chrome.runtime.lastError) {
        console.error("Background runtime error:", chrome.runtime.lastError.message);
      }
    })

    return true;
  });


  chrome.contextMenus.onClicked.addListener((info, currentTab) => {
    if (info.menuItemId !== "explore")
      return;

    getTab(currentTab.id).then((tab) => {
      tab.exploringStatus = !tab.exploringStatus;
      updateTab(currentTab.id, tab);
      updateContextMenu(tab.exploringStatus);
      chrome.tabs.sendMessage(currentTab.id, { exploring: tab.exploringStatus });
      if (tab.exploringStatus === false) {
        deleteTab(currentTab.id);
      }
    })
  })
})();
