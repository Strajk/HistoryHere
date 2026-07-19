// Pure, dependency-free binning for the visit-frequency sparkline.
//
// Kept free of date-fns (and any other import) on purpose: this way the exact
// same module runs in Node under Vitest *and* natively in the browser via
// `<script type="module">` in demo/histogram.html — no bundler, no drift
// between what we preview and what ships.

/**
 * Bucket a list of visits into `bucketCount` equal-width time bins spanning
 * from the oldest visit up to `now` (or the newest visit, whichever is later).
 *
 * Oldest is bin 0 (left), newest/now is the last bin (right) — matching how a
 * time axis reads and how the timeline below flows newest-first from the top.
 *
 * @param {Array<{visitTime:number}>|Array<number>} visits
 * @param {{bucketCount?:number, now?:number}} [opts]
 * @returns {{bars:Array<{index:number,start:number,end:number,count:number}>,
 *            start:number|null, end:number|null, bucketMs:number,
 *            max:number, total:number}}
 */
export function buildHistogram(visits, { bucketCount = 28, now = Date.now() } = {}) {
  const times = (visits || [])
    .map((v) => (typeof v === 'number' ? v : v && v.visitTime))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (times.length === 0) {
    return { bars: [], start: null, end: null, bucketMs: 0, max: 0, total: 0 };
  }

  const start = times[0];
  const end = Math.max(now, times[times.length - 1]);
  // Guard against a zero span (single visit, or every visit at the same
  // instant) so we never divide by zero.
  const span = Math.max(end - start, 1);
  const bucketMs = span / bucketCount;

  const bars = Array.from({ length: bucketCount }, (_, i) => ({
    index: i,
    start: start + i * bucketMs,
    end: start + (i + 1) * bucketMs,
    count: 0,
  }));

  times.forEach((t) => {
    // The newest visit lands exactly on `end`, which would compute to
    // bucketCount — clamp it into the last (inclusive) bin.
    let idx = Math.floor((t - start) / bucketMs);
    if (idx >= bucketCount) idx = bucketCount - 1;
    if (idx < 0) idx = 0;
    bars[idx].count += 1;
  });

  const max = bars.reduce((m, b) => Math.max(m, b.count), 0);
  return { bars, start, end, bucketMs, max, total: times.length };
}
