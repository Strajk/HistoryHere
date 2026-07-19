// @jsx h
import h from 'hyperapp-jsx-pragma'; // eslint-disable-line no-unused-vars
import { app } from 'hyperapp';
import { format as timeago } from 'timeago.js';
import { format, getTime, subMinutes, subDays, startOfToday, isAfter } from 'date-fns';
import { css, cx, injectGlobal, keyframes } from '@emotion/css';
import { buildHistogram } from '../lib/histogram';

const styles = {
  width: '320px',
  minHeight: '120px',
  sizes: {
    fontSize: '12px',
    circle: 8,
    dot: 4,
  },
  // Colors are routed through CSS custom properties so the palette can be
  // swapped for dark mode in one place via prefers-color-scheme (see the
  // :root / @media block in injectGlobal below).
  colors: {
    base: 'var(--hh-text)',
    surface: 'var(--hh-surface)',
    bg: 'var(--hh-bg)',
    primary: 'var(--hh-primary)',
    muted: 'var(--hh-muted)',
    border: 'var(--hh-border)',
    line: 'var(--hh-line)',
  },
  fonts: {
    // System UI stack — no remote font fetch (keeps the popup offline-safe and
    // avoids pinging Google Fonts on every open). Roboto stays in the list so
    // ChromeOS/Android still render their native UI font.
    base: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'Roboto Mono', Menlo, Consolas, monospace",
  },
};

// Gentle breathing pulse for the loading placeholder. Distinct from the
// one-shot "shake" of the empty state: this loops until storage answers, so it
// reads as "thinking", not as a verdict.
const loadingKeyframes = keyframes`
  0%,
  100% {
    opacity: .25;
  }
  50% {
    opacity: .5;
  }
`;

const noVisitsKeyframes = keyframes`
  from {
    transform: scale3d(1, 1, 1);
  }

  10%,
  20% {
    transform: scale3d(0.9, 0.9, 0.9) rotate3d(0, 0, 1, -3deg);
  }

  30%,
  50%,
  70%,
  90% {
    transform: scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, 3deg);
  }

  40%,
  60%,
  80% {
    transform: scale3d(1.1, 1.1, 1.1) rotate3d(0, 0, 1, -3deg);
  }

  to {
    transform: scale3d(1, 1, 1);
  }
`;

// eslint-disable-next-line no-unused-expressions
injectGlobal`
  :root {
    --hh-text: #333;
    --hh-surface: #FFF;
    --hh-bg: #FAFBFF;
    --hh-primary: #5A88F7;
    --hh-muted: #999;
    --hh-border: #F0F2F8;
    --hh-line: #dbdde0;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --hh-text: #E4E6EB;
      --hh-surface: #25262B;
      --hh-bg: #1A1B1E;
      --hh-primary: #6E97F8;
      --hh-muted: #8A8D94;
      --hh-border: #33343A;
      --hh-line: #3A3B42;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html {
    min-height: ${styles.minHeight};
  }
  body {
    width: ${styles.width};
    background: ${styles.colors.bg};
    color: ${styles.colors.base};
    font-family: ${styles.fonts.base};
    font-weight: 300;
    font-size: ${styles.sizes.fontSize};
  }

  .timeline-entry:first-child .timeline-entry-title {
    padding-top: 0;
  }
`;

// --- hyperapp actions & subscriptions ---

// Replace the visit list with whatever the background last stored.
const SetVisits = (state, visits) => ({ ...state, visits: visits || [] });

// Subscription that keeps the popup in sync with chrome.storage: it does an
// initial read on mount and re-reads whenever the background service worker
// broadcasts an { action: 'update' } message.
const chromeVisitsSub = (dispatch, { action }) => {
  const load = () => chrome.storage.local.get('visits', (storage) => {
    dispatch(action, storage.visits);
  });
  const handler = () => load();
  chrome.runtime.onMessage.addListener(handler);
  load();
  return () => chrome.runtime.onMessage.removeListener(handler);
};

const isExtension = typeof chrome !== 'undefined'
  && !!(chrome.runtime && chrome.runtime.onMessage);

// When opened standalone (e.g. popup.html in a plain browser tab) there is no
// chrome API, so seed the view with synthetic visits for debugging/design.
const makeFixtures = () => {
  const fixture = [];
  const now = new Date();
  for (let i = 0; i < 50; i += 1) {
    fixture.push({ visitTime: getTime(subMinutes(now, i ** 3.3)) });
  }
  return fixture;
};

// Bar *shape* is static, so it lives in one shared class; the per-bar *data*
// (height + colour) is the only thing that varies, so it goes on `style`. This
// keeps one classname instead of generating ~28 per render and separates
// "how a bar looks" from "what this bar shows".
// One-shot "history filling in" flourish on open: each bar grows up from the
// baseline. We animate scaleY (not height) so it composes with the inline
// percentage heights and pins to the bottom via transform-origin — same tooling
// as the 🧐 shake, no deps.
const barGrowKeyframes = keyframes`
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
`;

const barClass = css`
  flex: 1 1 0;
  min-width: 0;
  align-self: flex-end;
  border-radius: 2px 2px 0 0;
  transform-origin: bottom;
  animation: ${barGrowKeyframes} .45s ease both;
  transition: opacity .12s ease;
  &:hover {
    opacity: .75;
  }
`;

// Anchor every bar to the baseline; give any non-empty bin a floor height so a
// single visit is still visible next to a tall spike. Empty bins collapse to a
// faint 2px baseline tick. The per-bar animation delay staggers the grow-in
// left → right (oldest → now, matching the reading direction) — ~1s total
// across all bars, then still.
const barStyle = (bar, max) => ({
  ...(bar.count
    ? { height: `${Math.max((bar.count / max) * 100, 8)}%`, background: styles.colors.primary }
    : { height: '2px', background: styles.colors.line }),
  animationDelay: `${bar.index * 40}ms`,
});

// Mini visit-frequency histogram shown above the timeline. Single series, so
// one hue (the product primary) and no legend — the caption names it. Bars are
// equal-width time bins from the oldest visit up to "now" (left → right), which
// mirrors the newest-first timeline directly beneath it.
const Histogram = ({ data }) => {
  const { bars, max, start } = data;
  return (
    <div class={cx('histogram', css`
      padding: 12px 14px 6px;
      background: ${styles.colors.surface};
      border-bottom: 1px solid ${styles.colors.border};
    `)}>
      <div class={css`
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 36px;
      `}>
        {bars.map((bar) => (
          <div
            key={bar.index}
            class={barClass}
            style={barStyle(bar, max)}
            title={`${format(bar.start, 'yyyy/MM/dd HH:mm')} – ${bar.count} visit${bar.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div class={css`
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        color: ${styles.colors.muted};
        font-size: 10px;
      `}>
        <span>{format(start, 'yyyy/MM/dd')}</span>
        <span>now</span>
      </div>
    </div>
  );
};

// Headline that actually answers "have I been here before?". Three framings
// instead of a hard-plural "N visits": 0 → nudge that this is fresh territory
// (the 🧐 empty state carries the rest), 1 → celebrate the first visit, n>1 →
// the running count with a correctly pluralized noun.
const Headline = ({ count }) => {
  const emphasis = css`
    color: ${styles.colors.primary};
  `;
  if (count === 0) {
    return <span>Never seen this page</span>;
  }
  if (count === 1) {
    return <span><strong class={emphasis}>First time</strong> here</span>;
  }
  return (
    <span>
      Seen <strong class={emphasis}>{count}</strong> time{count === 1 ? '' : 's'}
    </span>
  );
};

const DAY_MS = 24 * 60 * 60 * 1000;

// A tiny, optional personality line under the header. Deliberately gated behind
// only two *unambiguous* patterns so it stays a rare remark, not a nag (the
// minimalist ethos would break if it commented on every page). Returns null —
// meaning "say nothing" — for everything in between, and 0/1-visit pages are
// already handled by the headline. `visits` is newest-first.
const pageVerdict = (visits) => {
  if (visits.length < 2) return null;

  // Habit: a burst of visits in the last week reads as "a place you keep coming
  // back to", worth acknowledging warmly.
  const weekAgo = subDays(new Date(), 7);
  const recent = visits.filter((v) => isAfter(v.visitTime, weekAgo)).length;
  if (recent >= 5) return 'You come here a lot 🔁';

  // Return-after-absence: the gap between this visit and the one before it is
  // large. Computed from the gap (not "now") so it's correct whether or not the
  // current load is already recorded. `timeago` is the same formatter the rows
  // use, so the phrasing stays consistent.
  const gap = visits[0].visitTime - visits[1].visitTime;
  if (gap > 30 * DAY_MS) return `Been a while — last seen ${timeago(visits[1].visitTime)}`;

  return null;
};

const view = (state) => {
  // `visits === null` means storage hasn't answered yet (see `init`). We must
  // NOT render the empty 🧐 "never seen" verdict here — on a page you *have*
  // visited, the async storage read lands a frame later and would snap the view
  // from a wrong answer to the real timeline. Instead show a verdict-free
  // pulsing placeholder until we actually know. Only `[]` (storage answered,
  // nothing stored) commits to "never seen".
  if (state.visits === null) {
    return (
      <div class={css`
        line-height: 100px;
        font-size: 36px;
        text-align: center;
        animation: ${loadingKeyframes} 1.4s ease-in-out infinite;
      `}>🧐</div>
    );
  }

  // Buckets are ordered newest → oldest. Each title describes the rolling
  // window a visit falls into (a visit is placed in the first bucket whose
  // threshold it is *after*), so the label always matches the actual range.
  const ranges = {
    today: {
      title: 'Today',
      threshold: startOfToday(),
      visits: [],
    },
    week: {
      title: 'Last 7 days',
      threshold: subDays(startOfToday(), 7),
      visits: [],
    },
    month: {
      title: 'Last 30 days',
      threshold: subDays(startOfToday(), 30),
      visits: [],
    },
    year: {
      title: 'Last year',
      threshold: subDays(startOfToday(), 365),
      visits: [],
    },
    earlier: {
      title: 'Older',
      threshold: subDays(startOfToday(), 365 * 5), // anything even earlier is probably a bug
      visits: [],
    },
  };

  state.visits.forEach((visit) => {
    if (isAfter(visit.visitTime, ranges.today.threshold)) {
      ranges.today.visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges.week.threshold)) {
      ranges.week.visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges.month.threshold)) {
      ranges.month.visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges.year.threshold)) {
      ranges.year.visits.push(visit);
    } else {
      ranges.earlier.visits.push(visit);
    }
  });

  const verdict = pageVerdict(state.visits);

  return (
    <div>
      <header class={css`
        margin-bottom: 8px;
        padding: 8px 12px;
        color: ${styles.colors.muted};
        font-weight: 700;
        font-size: 16px;
        text-align: center;
        line-height: 40px;
        background: ${styles.colors.surface};
        border-bottom: 1px solid ${styles.colors.border};
      `}>
        <Headline count={state.visits.length} />
      </header>

      {verdict && (
        <div class={css`
          margin: -4px 12px 10px;
          color: ${styles.colors.muted};
          font-size: 11px;
          line-height: 1.4;
          text-align: center;
        `}>{verdict}</div>
      )}

      {state.visits.length > 1 && (
        <Histogram data={buildHistogram(state.visits)} />
      )}

      {state.visits.length ? (
        <div class={cx('timeline', css`
          padding: 8px 12px;
          margin-top: 14px;
        `)}>
          {['today', 'week', 'month', 'year', 'earlier']
            // Empty buckets are pure noise — a page seen only today shouldn't
            // render four "No visits" rows. We only reach this block when at
            // least one visit exists, so filtering to populated buckets always
            // leaves ≥1, and the spine/dot language stays intact.
            .filter(rangeKey => ranges[rangeKey].visits.length)
            .map((rangeKey) => {
              const range = ranges[rangeKey];
              return (
              <div key={rangeKey} class={cx('timeline-entry', css`
                position: relative;
                box-shadow: inset 2px 0 0 ${styles.colors.line};
              `)}>
                <div class={cx('timeline-entry-title', css`
                  padding: 18px 0px 8px 16px;
                  font-size: 14px;
                  color: ${styles.colors.primary};

                  &:before {
                    content: '';
                    position: absolute;
                    left: -${styles.sizes.circle / 2}px;
                    transform: translateY(35%);
                    display: block;
                    width: ${styles.sizes.circle}px;
                    height: ${styles.sizes.circle}px;
                    border-radius: ${styles.sizes.circle}px;
                    background-color: ${styles.colors.bg};
                    border: 1px solid ${styles.colors.primary};
                    box-shadow: 0 0 0 ${styles.sizes.circle / 2}px ${styles.colors.bg};
                  }
                `)}>
                  {range.title}
                </div>
                <div class="timeline-entry-data">
                  {range.visits.map(visit => (
                    <div key={visit.visitTime} class={cx('timeline-entry-data-point', css`
                        line-height: 24px;
                        padding-left: 18px;
                        position: relative;
                        &:before {
                          content: '';
                          position: absolute;
                          left: -1px;
                          top: 10px;
                          display: block;
                          width: ${styles.sizes.dot}px;
                          height: ${styles.sizes.dot}px;
                          border-radius: ${styles.sizes.dot}px;
                          box-shadow: 0 0 0 1px ${styles.colors.bg};
                          background-color: ${styles.colors.line};
                        }
                      `)}>
                        <span class={cx('timestamp', '_absolute', css`
                          font-family: ${styles.fonts.mono};
                          font-weight: 500;
                        `)}>
                          {format(visit.visitTime, 'yyyy/MM/dd HH:mm, EEE')}
                        </span>
                        <span class={cx('timestamp', '_relative', css`
                          margin-left: 8px;
                          opacity: .7;
                        `)}>
                          {timeago(visit.visitTime)}
                        </span>
                      </div>
                  ))}
                </div>
              </div>
              );
            })}
        </div>
      ) : (
        <div class={css`
          line-height: 100px;
          font-size: 36px;
          opacity: .7;
          text-align: center;
          animation: ${noVisitsKeyframes} 2s linear 1;
        `}>🧐</div>
      )}
    </div>
  );
};

app({
  // `null` is the loading sentinel: in the extension we don't know the visit
  // count until chrome.storage answers async, so start unknown and let the
  // view render a verdict-free placeholder (see the null guard in `view`).
  // Standalone/design mode has fixtures synchronously, so it never loads.
  init: { visits: isExtension ? null : makeFixtures() },
  view,
  node: document.getElementById('app'),
  subscriptions: () => (isExtension ? [[chromeVisitsSub, { action: SetVisits }]] : []),
});
