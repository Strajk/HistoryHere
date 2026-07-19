import normalizeUrl from '../lib/normalizeUrl';

// Note: in MV3 the background is a non-persistent service worker, so this
// module-level cache is reset whenever the worker is suspended. That's fine
// here — it's only an optimisation to skip re-querying history for the same
// URL; on wake it simply resets to '' and recomputes.
let lastUrl = '';

// Gather every history visit whose URL normalises to the same page as `rawUrl`.
//
// `history.getVisits` only matches an *exact* URL, but history stores the raw
// (dirty) URLs — so the same page reached with different tracking params lives
// under several entries. We first `history.search` for candidates (narrowed by
// host + path so we don't scan the whole history), keep the ones that share our
// normalised key, then merge each candidate's visits into one newest-first list.
const collectVisits = (rawUrl, cb) => {
  const key = normalizeUrl(rawUrl);

  let searchText = key;
  try {
    const u = new URL(rawUrl);
    searchText = u.hostname + u.pathname; // free-text query, params ignored
  } catch (e) { /* non-URL — fall back to the raw string */ }

  chrome.history.search({ text: searchText, startTime: 0, maxResults: 1000 }, (items) => {
    const matching = items.filter((item) => normalizeUrl(item.url) === key);
    if (!matching.length) {
      cb([]);
      return;
    }

    let pending = matching.length;
    let all = [];
    matching.forEach((item) => {
      chrome.history.getVisits({ url: item.url }, (visits) => {
        all = all.concat(visits);
        pending -= 1;
        if (pending === 0) {
          all.sort((a, b) => b.visitTime - a.visitTime); // newest first
          cb(all);
        }
      });
    });
  });
};

// Recompute the badge + stored visits for `url`, deduped so we never scan
// history twice for the same page.
const refreshForUrl = (url) => {
  if (!url || url === lastUrl) return;
  lastUrl = url;

  collectVisits(url, (visits) => {
    chrome.action.setBadgeText({
      text: visits.length ? String(visits.length) : '',
    });
    chrome.storage.local.set({ visits }, () => {
      // Notify an open popup to refresh. When no popup is listening this
      // rejects with "Could not establish connection" — read lastError in
      // the callback so Chrome doesn't log it as an unchecked runtime error.
      chrome.runtime.sendMessage({ action: 'update' }, () => {
        void chrome.runtime.lastError;
      });
    });
  });
};

// Resolve the active tab's URL, then refresh. Used when we only know "the
// active tab changed" (activation / window focus) and not which URL.
const refreshActiveTab = () => {
  chrome.tabs.query({
    active: true, // Whether the tabs are active in their windows
    currentWindow: true, // Whether the tabs are in the current window
  }, (activetabs) => {
    const currentTab = activetabs[0];
    if (currentTab) refreshForUrl(currentTab.url);
  });
};

// `tabs.onUpdated` fires many times per navigation (loading, title, favicon,
// audible, …). We only care about the two signals that mean "this tab now
// shows a different page whose history is worth recounting":
//   • `changeInfo.url`    — the URL changed (normal + SPA navigations), and
//   • `changeInfo.status === 'complete'` — the load finished, by which point
//     Chrome has recorded the visit so `history.search` will find it.
// Everything else is filtered out before we touch `tabs.query`/history, and
// we skip background tabs entirely since the popup/badge track the active tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  if (!tab.active) return;
  refreshForUrl(tab.url);
});

chrome.tabs.onActivated.addListener(refreshActiveTab);
