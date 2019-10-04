(() => {
  //copied from utils.js
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
    contexts: ["all"]
  });

  const getTab = (tabId) => {
    return new Promise(resolve => {
      chrome.storage.local.get("cache", (data) => {
        if (!data.cache) {
          data.cache = {};
        }

        if (!data.cache[tabId]) {
          data.cache[tabId] = {};
          data.cache[tabId].exploringStatus = false;
          data.cache[tabId].discoveredUrls = [];
          data.cache[tabId].visitedUrls = [];
        }



        console.log("get tab tab:", data.cache[tabId]);

        resolve(data.cache[tabId]);
      })
    })
  }

  const updateTab = (id, tab) => {
    chrome.storage.local.get("cache", (data) => {
      if (!data.cache) {
        data.cache = {};
      }
      console.log("updateTab data:", data);
      data.cache[id] = tab;
      chrome.storage.local.set(data);
    })
  }

  const deleteTab = (id) => {
    chrome.storage.local.get("cache", (data) => {
      if (data.cache[id]) {
        delete data.cache[id];
      }
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
      console.log("type:", req.type);
      console.log("tab:", tab);

      switch (req.type) {
        case "updateContextMenu": {
          updateContextMenu(tab.exploringStatus);
        } break;

        case "getExploringStatus": {
          console.log("GET EXPLORING STATUS:");
          sendResponse(tab.exploringStatus);
        } break;

        case "addDiscoveredUrls": {
          tab.discoveredUrls = [...tab.discoveredUrls, ...req.urls];
          updateTab(sender.tab.id, tab);
        } break;

        case "getNextUrl": {
          if (tab.exploringStatus !== true) {
            return sendResponse(null);
          }

          if (tab.discoveredUrls.length < 1 && tab.visitedUrls.length > 0) {
            const url = tab.visitedUrls[rand(tab.visitedUrls.length)];
            return sendResponse(url);
          }

          const index = rand(tab.discoveredUrls.length);
          const url = tab.discoveredUrls.splice(index, 1);
          tab.visitedUrls.push(url);
          updateTab(sender.tab.id, tab);
          sendResponse(url);
        } break;

        case "exploreQuit": {
          tab.exploringStatus = false;
          updateTab(sender.tab.id, tab);
        } break;

        case "deleteCache": {
          deleteTab(sender.tab.id);
        } break;

        default: console.log("request type not recognized:", req.type);
      }

      if (chrome.runtime.lastError) {
        console.log("background runtime error:", chrome.runtime.lastError.message);
      }
    })
  });


  chrome.contextMenus.onClicked.addListener((info, currentTab) => {
    if (info.menuItemId !== "explore")
      return;

    getTab(currentTab.id).then((tab) => {
      console.log("ONCLICK TAB STATUS:", !tab.exploringStatus);
      tab.exploringStatus = !tab.exploringStatus;
      updateTab(currentTab.id, tab);
      updateContextMenu(tab.exploringStatus);
      chrome.tabs.sendMessage(currentTab.id, { exploring: tab.exploringStatus });
    })
  })
})();
