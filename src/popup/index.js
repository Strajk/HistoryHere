// @jsx h
import h from 'hyperapp-jsx-pragma'; // eslint-disable-line no-unused-vars
import { app } from 'hyperapp';
import { format as timeago } from 'timeago.js';
import { format, getTime, subMinutes, subDays, startOfToday, isAfter } from 'date-fns';
import { css, cx, injectGlobal, keyframes } from '@emotion/css';

const styles = {
  width: '320px',
  minHeight: '120px',
  sizes: {
    fontSize: '12px',
    circle: 8,
    dot: 4,
  },
  colors: {
    base: '#333',
    white: '#FFF',
    bg: '#FAFBFF',
    primary: '#5A88F7',
  },
  fonts: {
    base: "'Roboto', sans-serif;",
  },
};

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
    font-family: ${styles.fonts.base}
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

const view = (state) => {
  const ranges = {
    today: {
      title: 'Now',
      threshold: startOfToday(),
      visits: [],
    },
    7: {
      title: 'Yesterday',
      threshold: subDays(startOfToday(), 7),
      visits: [],
    },
    31: {
      title: '7 days ago',
      threshold: subDays(startOfToday(), 31),
      visits: [],
    },
    365: {
      title: '31 days ago',
      threshold: subDays(startOfToday(), 365),
      visits: [],
    },
    earlier: {
      title: '365 days ago',
      threshold: subDays(startOfToday(), 365 * 5), // anything even earlier is probably a bug
      visits: [],
    },
  };

  state.visits.forEach((visit) => {
    if (isAfter(visit.visitTime, ranges.today.threshold)) {
      ranges.today.visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges['7'].threshold)) {
      ranges['7'].visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges['31'].threshold)) {
      ranges['31'].visits.push(visit);
    } else if (isAfter(visit.visitTime, ranges['365'].threshold)) {
      ranges['365'].visits.push(visit);
    } else {
      ranges.earlier.visits.push(visit);
    }
  });

  return (
    <div>
      <header class={css`
        margin-bottom: 8px;
        padding: 8px 12px;
        color: #999;
        font-weight: 700;
        font-size: 16px;
        text-align: center;
        line-height: 40px;
        background: #FFF;
        border-bottom: 1px solid #F0F2F8;
      `}>
        <strong class={css`
          color: ${styles.colors.primary};
        `}>
          {state.visits.length} visits
        </strong>
        {' '}
        of this page
      </header>

      {state.visits.length ? (
        <div class={cx('timeline', css`
          padding: 8px 12px;
          margin-top: 14px;
        `)}>
          {['today', '7', '31', '365', 'earlier'].map((rangeKey) => {
            const range = ranges[rangeKey];
            return (
              <div key={rangeKey} class={cx('timeline-entry', css`
                position: relative;
                box-shadow: inset 2px 0 0 #dbdde0;
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
                    background-color: #fafbfc;
                    border: 1px solid ${styles.colors.primary};
                    box-shadow: 0 0 0 ${styles.sizes.circle / 2}px ${styles.colors.bg};
                  }
                `)}>
                  {range.title}
                </div>
                <div class="timeline-entry-data">
                  {range.visits.length
                    ? range.visits.map(visit => (
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
                          background-color: #dbdde0;
                        }
                      `)}>
                        <span class={cx('timestamp', '_absolute', css`
                          font-family: 'Roboto Mono', monospace;
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
                    ))
                    : <span class={css`
                      line-height: 24px;
                      padding-left: 18px;
                      opacity: .7;
                    `}>No visits</span>
                  }
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
  init: { visits: isExtension ? [] : makeFixtures() },
  view,
  node: document.getElementById('app'),
  subscriptions: () => (isExtension ? [[chromeVisitsSub, { action: SetVisits }]] : []),
});
