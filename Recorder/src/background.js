chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("cache", (data) => {
    if (!data.cache) {
      data.cache = {};
    }

    if (!data.cache.settings) {
      data.cache.settings = {};
      data.cache.settings.clicksEnabled = false;
      data.cache.settings.scrollDownDelay = 2;
      data.cache.settings.scrollDownAmount = 75;
      data.cache.settings.scrollUpDelay = 1;
      data.cache.settings.scrollUpAmount = 25;
      data.cache.settings.clicksEnabled = 1;
    }

    chrome.storage.local.set(data);
  })
});

const asyncSendCommand = (target, cmd, param) => {
  return new Promise(resolve => {
    chrome.debugger.sendCommand(target, cmd, param, res => {
      resolve(res);
    })
  })
}

const rand = (max) => {
  if (!max) {
    max = Math.max();
  }
  return Math.floor(Math.random() * max)
}

const getActiveTab = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        resolve(tabs[0]);
      } else {
        reject(null)
      }
    });
  })
}

const getTab = (tabId) => {
  return new Promise(async (resolve) => {
    if (!tabId) {
      const activeTab = await getActiveTab();
      tabId = activeTab.id;
    }
    chrome.storage.local.get("cache", (data) => {
      const id = `tab-${tabId}`;
      if (!data.cache[id]) {
        data.cache[id] = {};
        data.cache[id].exploringStatus = false;
        data.cache[id].discoveredUrls = [];
        data.cache[id].visitedUrls = [];
      }

      data.cache[id].id = tabId;
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

const attachDebugger = (id) => {
  chrome.debugger.getTargets(targets => {

    const newTarget = targets.filter(t => t.tabId === id)[0];
    if (!newTarget) {
      return console.error("Error: debug target not found!");
    }


    const debugTarget = {
      targetId: newTarget.id
    }

    const debuggerAttach = setInterval(() => {
      chrome.debugger.attach(debugTarget, '1.3', () => {
        if (chrome.runtime.lastError && !chrome.runtime.lastError.message.includes("Another debugger is already attached")) {
          return console.error("Error attaching debugger:", chrome.runtime.lastError);
        }

        clearInterval(debuggerAttach);
      })
    })

    this.debugTarget = debugTarget;
  })
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.time) {
    chrome.browserAction.setBadgeText({
      text: req.time,
      tabId: sender.tab.id
    });
    return;
  }


  getTab(sender.tab && sender.tab.id ? sender.tab.id : null).then(tab => {
    switch (req.type) {
      case "getExploringStatus": {
        sendResponse({ status: tab.exploringStatus, id: tab.id });
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

        updateTab(tab.id, tab);
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
        updateTab(tab.id, tab);
        sendResponse(url);
      } break;

      case "getSettings": {
        chrome.storage.local.get("cache", data => {
          sendResponse(data.cache.settings);
        })
      } break;

      case "toggleExplore": {
        tab.exploringStatus = !tab.exploringStatus;
        updateTab(tab.id, tab);
        chrome.tabs.sendMessage(tab.id, { exploring: tab.exploringStatus });
        if (tab.exploringStatus === false) {
          deleteTab(tab.id);
        } else {
          attachDebugger(tab.id);
        }
      } break;

      case "clickRandom": {
        (async () => {
          const array = await asyncSendCommand(this.debugTarget, "Runtime.evaluate", {
            expression: "Array.from(document.querySelectorAll('*'))"
          })

          const arrayProperties = await asyncSendCommand(this.debugTarget, "Runtime.getProperties", {
            objectId: array.result.objectId
          });
          console.log("elements:", arrayProperties.result)

          const windowHeight = await asyncSendCommand(this.debugTarget, "Runtime.evaluate", {
            expression: "(window.innerHeight || document.documentElement.clientHeight)"
          });

          const scrollHeight = await asyncSendCommand(this.debugTarget, "Runtime.evaluate", {
            expression: "scrollY"
          });

          const indices = await Promise.all(arrayProperties.result.map(async (e, index) => {
            if (e.value && e.value.objectId && e.value.className.includes("HTML")) {
              const result = await asyncSendCommand(this.debugTarget, "DOM.getContentQuads", {
                objectId: e.value.objectId
              });
              if (!result) return null;


              const elTop = result.quads[0][1];
              const elBot = result.quads[0][5];
              const vpTop = scrollHeight.result.value;
              const vpBot = scrollHeight.result.value + windowHeight.result.value;

              if (vpTop > elBot || vpBot < elTop) {
                return null;
              }


              const { listeners } = await asyncSendCommand(this.debugTarget, "DOMDebugger.getEventListeners", {
                objectId: e.value.objectId
              });
              if (listeners) {
                for (let i = 0; i < listeners.length; i++) {
                  if (listeners[i].type === "click") {
                    return index;
                  }
                }
              }
            }
            return null;
          }));

          const indicesFiltered = indices.filter(e => e);
          console.log("indices filtered:", indicesFiltered);

        })();
      }

      default: break;
    }
  })

  if (chrome.runtime.lastError) {
    console.error("Background runtime error:", chrome.runtime.lastError.message);
  }

  return true;
});
