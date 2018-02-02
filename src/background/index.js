let lastUrl = '';

const listener = () => {
  chrome.tabs.query({
    // TODO: Find out if these are needed
    active: true, // Whether the tabs are active in their windows
    currentWindow: true, // Whether the tabs are in the current window
  }, (activetabs) => {
    const currentTab = activetabs[0];
    const { url } = currentTab;
    if (url !== lastUrl) {
      // TODO: Maybe clean URL from *some* query params,
      // like affiliates & marketing
      lastUrl = url;
      chrome.history.getVisits({ url }, (historyVisits) => {
        const historyVisitsDesc = historyVisits.reverse(); // newest first
        chrome.browserAction.setBadgeText({
          text: historyVisitsDesc.length
            ? String(historyVisitsDesc.length)
            : '',
        });
        chrome.storage.local.set({ visits: historyVisitsDesc }, () => {
          // Force popup update
          chrome.runtime.sendMessage({ action: 'update' }, () => {});
        });
      });
    }
  });
};

chrome.tabs.onUpdated.addListener(listener);
chrome.tabs.onActivated.addListener(listener);
