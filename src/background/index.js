// Note: in MV3 the background is a non-persistent service worker, so this
// module-level cache is reset whenever the worker is suspended. That's fine
// here — it's only an optimisation to skip re-querying history for the same
// URL; on wake it simply resets to '' and recomputes.
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
        chrome.action.setBadgeText({
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
