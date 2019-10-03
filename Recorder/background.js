const updateContextMenu = (currentStatus) => {
  const updated = {
    title: currentStatus ? "Stop exploring" : "Start exploring"
  }

  chrome.contextMenus.update("explore", updated);
}

const initTab = (cache, tabId) => {

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

const rand = (max) => {
  if (!max) {
    max = Math.max();
  }
  return Math.floor(Math.random() * max)
}

chrome.runtime.onMessage.addListener(async (req, sender, sendResponse) => {
  if (req.time) {
    chrome.browserAction.setBadgeText({
      text: req.time,
      tabId: sender.tab.id
    });
    return;
  }

  const tab = await getTab(sender.tab.id);

  console.log("type:", req.type);
  console.log("tab:", tab);

  if (req.type === "updateContextMenu") {
    updateContextMenu(tab.exploringStatus);
  }

  if (req.type === "getExploringStatus") {
    sendResponse(tab.exploringStatus);
  }

  if (req.type === "addDiscoveredUrls") {
    tab.discoveredUrls = [...tab.discoveredUrls, ...req.urls];
    updateTab(sender.tab.id, tab);
  }

  if (req.type === "getNextUrl") {
    if (tab.discoveredUrls.length < 1 && tab.visitedUrls.length > 0) {
      const url = tab.visitedUrls[rand(tab.visitedUrls.length)];
      return sendResponse(url);
    }

    const index = rand(tab.discoveredUrls.length);
    const url = tab.discoveredUrls.splice(index, 1);
    tab.visitedUrls.push(url);
    updateTab(sender.tab.id, tab);
    sendResponse(url);
  }

  if (req.type == "exploreQuit") {
    tab.exploringStatus = false;
    updateTab(sender.tab.id, tab);
  }

  if (chrome.runtime.lastError) {
    console.log("background runtime error:", chrome.runtime.lastError.message);
  }

  return true;
});


chrome.contextMenus.onClicked.addListener(async (info, currentTab) => {
  if (info.menuItemId != "explore")
    return;

  const tab = await getTab(currentTab.id);
  console.log("tab:", tab);
  tab.exploringStatus = !tab.exploringStatus;
  updateTab(currentTab.id, tab);
  updateContextMenu(tab.exploringStatus);
  chrome.tabs.sendMessage(currentTab.id, { exploring: tab.exploringStatus });
})
