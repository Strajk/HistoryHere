// @jsx h
import { h, app } from 'hyperapp'; // eslint-disable-line no-unused-vars
import timeago from 'timeago.js';
import { format, getTime, subMinutes, subDays, startOfToday, isAfter } from 'date-fns';
import { injectGlobal, keyframes } from 'emotion';

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

const STATE = {
  raw: '',
  visits: [],
  timeago: timeago(),
};

const ACTIONS = {
  update: _items => _state => ({ visits: _items }), // eslint-disable-line no-unused-vars
};

const view = (state, actions) => { // eslint-disable-line no-unused-vars
  const ranges = {
    today: {
      title: 'Today',
      threshold: startOfToday(),
      visits: [],
    },
    7: {
      title: 'Last 7 days',
      threshold: subDays(startOfToday(), 7),
      visits: [],
    },
    31: {
      title: 'Last 31 days',
      threshold: subDays(startOfToday(), 31),
      visits: [],
    },
    365: {
      title: 'Last 365 days',
      threshold: subDays(startOfToday(), 365),
      visits: [],
    },
    earlier: {
      title: 'Earlier',
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
      <header css={`
        margin-bottom: 8px;
        padding: 8px 12px;
        color: #999;
        font-weight: 700;
        font-size: 16px
        text-align: center;
        line-height: 40px;
        background: #FFF;
        border-bottom: 1px solid #F0F2F8;
      `}>
        <strong css={`
          color: ${styles.colors.primary};
        `}>
          {state.visits.length} visits
        </strong>
        {' '}
        of this page
      </header>

      {state.raw && <pre>{state.raw}</pre>}

      {state.visits.length ? (
        <div className="timeline" css={`
          padding: 8px 12px;
          margin-top: 14px;
        `}>
          {['today', '7', '31', '365', 'earlier'].map((rangeKey) => {
            const range = ranges[rangeKey];
            return (
                <div className="timeline-entry" css={`
                  position: relative;
                  box-shadow: inset 2px 0 0 #dbdde0
                `}>
                  <div className="timeline-entry-title" css={`
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
                  `}>
                    {range.title}
                  </div>
                  <div className="timeline-entry-data" css={`
                    /* nothing */
                  `}>
                    {range.visits.length
                      ? range.visits.map(visit =>
                          <div className="timeline-entry-data-point" css={`
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
                          `}>
                            <span className="timestamp _absolute" css={`
                              font-family: 'Roboto Mono', monospace;
                              font-weight: 500;
                            `}>
                              {format(visit.visitTime, 'YYYY/MM/DD HH:mm, ddd')}
                            </span>
                            <span className="timestamp _relative" css={`
                              margin-left: 8px;
                              opacity: .7;
                            `}>
                              {state.timeago.format(visit.visitTime)}
                            </span>
                          </div>,
                        )
                      : <span css={`
                          line-height: 24px;
                          padding-left: 18px;
                          opacity: .7;
                        `}>No visits</span>
                    }

                  </div>
                </div>
            );
          },
          )}
        </div>
      ) : (
        <div css={`
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
const main = app(STATE, ACTIONS, view, document.getElementById('app'));

const render = () => {
  chrome.storage.local.get('visits', (storage) => {
    main.update(storage.visits);
  });
};

if (chrome.runtime.onMessage) { // Run as chrome extension
  chrome.runtime.onMessage.addListener(render);
  render();
} else { // Run by itself - for debugging
  const fixture = [];
  const now = new Date();
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < 50; i++) {
    fixture.push({
      visitTime: getTime(subMinutes(now, i ** 3.3)),
    });
  }

  main.update(fixture);
}

