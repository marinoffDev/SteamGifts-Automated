chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'getPointsBudget') {
    sendResponse(getPointsBudget());
  } else if (message.action === 'openGiveawayTab') {
    const tabId = await openGiveawayTab(message.giveawayPageUrl, message.giveawayCost);
    sendResponse({ tabId });
  }
  return true; // Keep the message channel open for asynchronous response
});

// Open a new tab and send message to content script when tab is ready
async function openGiveawayTab(giveawayPageUrl, giveawayCost) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: giveawayPageUrl, active: false }, (newTab) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.sendMessage(tabId, { action: 'enterGiveaway', giveawayCost });
          chrome.tabs.onUpdated.removeListener(listener); // Remove listener after it's done
          resolve(tabId);
        }
      });
    });
  });
}