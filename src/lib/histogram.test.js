import { describe, it, expect } from 'vitest';
import { buildHistogram } from './histogram';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('buildHistogram', () => {
  it('returns an empty result for no visits', () => {
    const h = buildHistogram([], { now: 1000 });
    expect(h).toMatchObject({ bars: [], start: null, end: null, max: 0, total: 0 });
  });

  it('produces exactly bucketCount bars', () => {
    const now = 100 * DAY;
    const visits = [{ visitTime: 0 }, { visitTime: 50 * DAY }, { visitTime: now }];
    const h = buildHistogram(visits, { bucketCount: 10, now });
    expect(h.bars).toHaveLength(10);
  });

  it('counts every visit exactly once across the bars', () => {
    const now = 30 * DAY;
    const visits = Array.from({ length: 17 }, (_, i) => ({ visitTime: i * DAY }));
    const h = buildHistogram(visits, { bucketCount: 12, now });
    const summed = h.bars.reduce((s, b) => s + b.count, 0);
    expect(summed).toBe(17);
    expect(h.total).toBe(17);
  });

  it('places the newest visit in the last bin, oldest in the first', () => {
    const now = 10 * DAY;
    const visits = [{ visitTime: 0 }, { visitTime: now }];
    const h = buildHistogram(visits, { bucketCount: 5, now });
    expect(h.bars[0].count).toBe(1);
    expect(h.bars[h.bars.length - 1].count).toBe(1);
  });

  it('reports the tallest bar as max', () => {
    const now = 4 * DAY;
    // Three visits clustered in the first day, one later.
    const visits = [
      { visitTime: 0 },
      { visitTime: 1 * HOUR },
      { visitTime: 2 * HOUR },
      { visitTime: now },
    ];
    const h = buildHistogram(visits, { bucketCount: 4, now });
    expect(h.max).toBe(3);
  });

  it('handles a single visit without dividing by zero', () => {
    const t = 5 * DAY;
    const h = buildHistogram([{ visitTime: t }], { bucketCount: 8, now: t });
    expect(h.total).toBe(1);
    expect(h.max).toBe(1);
    expect(h.bars.reduce((s, b) => s + b.count, 0)).toBe(1);
  });

  it('accepts raw timestamps as well as {visitTime} objects', () => {
    const now = 2 * DAY;
    const h = buildHistogram([0, DAY, now], { bucketCount: 4, now });
    expect(h.total).toBe(3);
  });

  it('ignores non-finite timestamps', () => {
    const now = 2 * DAY;
    const h = buildHistogram(
      [{ visitTime: 0 }, { visitTime: NaN }, { visitTime: undefined }, { visitTime: now }],
      { bucketCount: 4, now },
    );
    expect(h.total).toBe(2);
  });
});
