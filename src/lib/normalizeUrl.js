// Marketing / tracking query params identify a *campaign*, not a *page*.
// Stripping them lets us treat the same article opened from a newsletter, a
// tweet, and a Google result as one page when answering "have I seen this?".
const TRACKING_PARAMS = [
  /^utm_/, // Google Analytics / generic UTM (utm_source, utm_medium, …)
  /^fbclid$/, // Facebook
  /^gclid$/, // Google Ads
  /^gclsrc$/,
  /^dclid$/, // DoubleClick
  /^msclkid$/, // Microsoft Ads
  /^mc_cid$/, /^mc_eid$/, // Mailchimp
  /^_hsenc$/, /^_hsmi$/, // HubSpot
  /^igshid$/, // Instagram
  /^yclid$/, // Yandex
  /^_openstat$/,
  /^vero_id$/, /^vero_conv$/,
  /^wickedid$/,
  /^ref$/, /^ref_src$/, // generic referral tags
];

const isTracking = (name) => {
  const lower = name.toLowerCase();
  return TRACKING_PARAMS.some((re) => re.test(lower));
};

// Produce a stable identity for a URL so visits that differ only by tracking
// params, query-param order, a fragment, or a trailing slash collapse into
// one page. This is a best-effort dedupe key, not a security boundary.
//
// Note: the fragment is dropped, which merges "#section" anchors on the same
// document (usually what we want) but also merges routes of hash-based SPAs
// (occasionally not). Anchors are the far more common case in browsing history.
export default function normalizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return rawUrl; // non-URL (chrome://newtab, about:blank, …) — leave as-is
  }

  // Keep non-tracking params, re-added in sorted order for a stable string.
  const kept = [];
  url.searchParams.forEach((value, name) => {
    if (!isTracking(name)) kept.push([name, value]);
  });
  kept.sort((a, b) => a[0].localeCompare(b[0]));
  url.search = '';
  kept.forEach(([name, value]) => url.searchParams.append(name, value));

  url.hash = '';

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
