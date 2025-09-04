// Constants for timing and durations
const BELL_DELAY_MS = 2000; // Delay between bell strikes (let each ring settle)
const BELL_PAUSE_MS = 1200; // Pause after last bell before starting
const SETTLING_DURATION_MS = 30000; // 30-second settling animation
const SETTLING_UPDATE_MS = 50; // Settling animation update interval
const CHECK_INTERVAL_MS = 1000; // Check timer state interval
const CONFIRM_DURATION_MS = 1200; // Confirmation visual duration
const HOLD_UPDATE_MS = 30; // Hold duration update interval
const INITIAL_DURATION_MIN = 10; // Default meditation duration
const MAX_DURATION_MIN = 60; // Maximum hold duration
const INITIAL_HOLD_MIN = 5; // Starting hold duration

function PracticeView() {
  const { useState, useEffect, useRef, createElement: h } = React;
  const [isActive, setIsActive] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleProgress, setSettleProgress] = useState(0);
  const [duration, setDuration] = useState(INITIAL_DURATION_MIN);
  const [isHolding, setIsHolding] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [holdDuration, setHoldDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isRingingBells, setIsRingingBells] = useState(false);
  const [bellCount, setBellCount] = useState(0);
  
  const holdStartTime = useRef(null);
  const holdInterval = useRef(null);
  const settlingInitiated = useRef(false);
  const settleIntervalRef = useRef(null);
  
  useEffect(() => {
    checkActiveSession();
    const interval = setInterval(checkActiveSession, CHECK_INTERVAL_MS);
    
    // Listen for session completion event
    const handleSessionCompleted = () => {
      if (!isSettling) {
        beginSettling();
        setIsActive(false);
      }
    };
    
    window.addEventListener('session-completed', handleSessionCompleted);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('session-completed', handleSessionCompleted);
      // Clean up any active intervals
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
      if (settleIntervalRef.current) {
        clearInterval(settleIntervalRef.current);
        settleIntervalRef.current = null;
      }
    };
  }, [isSettling]);
  
  const checkActiveSession = () => {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get timer state:', chrome.runtime.lastError);
        return;
      }
      
      if (response) {
        setIsActive(response.isActive);
        
        if (response.isActive && response.endTime) {
          const now = Date.now();
          const elapsed = now - (response.endTime - (response.duration * 60000));
          const total = response.duration * 60000;
          setProgress(Math.min(1, elapsed / total));
          setDuration(response.duration);
          
          // Check if session just completed
          if (elapsed >= total && !isSettling && !settlingInitiated.current) {
            settlingInitiated.current = true;
            beginSettling();
            setIsActive(false);
          }
        } else if (!isSettling) {
          setProgress(0);
        }
      }
    });
  };
  
  const handleHoldStart = (e) => {
    e.preventDefault();
    if (isActive) return;
    
    setIsHolding(true);
    holdStartTime.current = Date.now();
    setHoldDuration(INITIAL_HOLD_MIN);
    
    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTime.current;
      // Smooth progression: slower at first, faster as you hold longer
      const progression = Math.pow(elapsed / 1000, 1.5); // Exponential growth
      const minutes = Math.min(MAX_DURATION_MIN, Math.floor(INITIAL_HOLD_MIN + progression));
      setHoldDuration(minutes);
    }, HOLD_UPDATE_MS); // Smoother updates
  };
  
  const handleHoldEnd = async (e) => {
    e.preventDefault();
    if (!isHolding) return;
    
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
    
    const finalDuration = holdDuration || INITIAL_DURATION_MIN;
    setDuration(finalDuration);
    
    // Visual confirmation state
    setIsConfirming(true);
    
    // Keep showing duration for 1.2 seconds with confirmation style
    setTimeout(async () => {
      setIsHolding(false);
      setIsConfirming(false);
      
      // Play three bells to begin (traditional)
      await playStartBells();
      
      // Start session after bells
      chrome.runtime.sendMessage({
        action: 'START_TIMER',
        duration: finalDuration,
        type: 'presence'
      });
      setIsActive(true);
      setProgress(0);
    }, CONFIRM_DURATION_MS);
  };
  
  const playStartBells = async () => {
    const audio = new Audio('../assets/bell.mp3');
    
    // Show bell ringing interstitial
    setIsRingingBells(true);
    setBellCount(0);
    
    for (let i = 0; i < 3; i++) {
      setBellCount(i + 1);
      await new Promise(resolve => {
        audio.volume = 0.4; // Consistent volume for start
        audio.currentTime = 0;
        audio.play().catch(err => console.error('Bell playback failed:', err));
        setTimeout(resolve, BELL_DELAY_MS);
      });
    }
    
    // Brief pause after last bell
    await new Promise(resolve => setTimeout(resolve, BELL_PAUSE_MS));
    setIsRingingBells(false);
  };
  
  const beginSettling = () => {
    setIsSettling(true);
    setSettleProgress(0);
    settlingInitiated.current = false; // Reset for next time
    
    // 30-second settling animation
    const settleStart = Date.now();
    const settleInterval = setInterval(() => {
      const elapsed = Date.now() - settleStart;
      const progress = Math.min(1, elapsed / SETTLING_DURATION_MS);
      setSettleProgress(progress);
      
      if (progress >= 1) {
        clearInterval(settleInterval);
        setIsSettling(false);
        setProgress(0);
        settleIntervalRef.current = null;
      }
    }, SETTLING_UPDATE_MS);
    
    // Store interval ref for early interruption
    settleIntervalRef.current = settleInterval;
  };
  
  const interruptSettling = () => {
    if (settleIntervalRef.current) {
      clearInterval(settleIntervalRef.current);
      settleIntervalRef.current = null;
    }
    setIsSettling(false);
    setSettleProgress(0);
    setProgress(0);
    settlingInitiated.current = false;
  };
  
  const handleReturn = () => {
    chrome.runtime.sendMessage({ action: 'STOP_TIMER' });
    setIsActive(false);
    // Don't reset progress immediately - let settling handle it
  };
  
  return h('div', { className: 'practice-view' },
    // History button - always visible at top-right
    h('div', { 
      className: 'history-tap',
      onClick: (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('navigate-to-reflection'));
      },
      title: 'View practice history',
      'aria-label': 'Navigate to practice history',
      role: 'button',
      tabIndex: 0
    },
      h('span', null, '≈')
    ),
    
    h('div', { className: 'practice-container' },
      
      isRingingBells ? (
        // Bell ringing interstitial - Jonathan Harris inspired
        h('div', { className: 'bell-interstitial' },
          h('div', { className: 'bell-container' },
            h('div', { className: 'bell-rings' },
              [1, 2, 3].map(i => 
                h('div', { 
                  key: i,
                  className: `bell-ring ${bellCount >= i ? 'ringing' : ''}`,
                  style: {
                    animationDelay: `${(i - 1) * 0.2}s`
                  }
                })
              )
            ),
            h('div', { className: 'bell-text' },
              bellCount === 1 ? 'arriving' :
              bellCount === 2 ? 'settling' :
              bellCount === 3 ? 'beginning' : ''
            )
          )
        )
      ) :
      
      isSettling ? (
        // Settling period - pendulum slowing to rest
        h('div', { className: 'settling-session' },
          h('div', { className: 'settling-container' },
            h('div', { 
              className: 'settling-circle',
              style: {
                '--settle-progress': settleProgress,
                '--oscillation': Math.cos(settleProgress * Math.PI * 10) * (1 - settleProgress)
              }
            },
              h('div', { className: 'breath-circle settling' },
                h('div', { className: 'breath-guide settling' })
              )
            ),
            h('div', { className: 'settling-text' },
              settleProgress < 0.5 ? 'returning...' : 
              settleProgress < 0.9 ? 'settling...' : 
              'rest'
            ),
            h('button', { 
              className: 'skip-settling',
              onClick: interruptSettling,
              'aria-label': 'Skip settling animation and continue'
            }, 'continue')
          )
        )
      ) : isActive ? (
        h('div', { className: 'active-session' },
          // Progress ring container
          h('div', { className: 'progress-container' },
            h('svg', { 
              className: 'progress-ring',
              width: '260',
              height: '260',
              viewBox: '0 0 260 260'
            },
              h('circle', {
                className: 'progress-ring-bg',
                cx: '130',
                cy: '130',
                r: '120',
                fill: 'none',
                strokeWidth: '1'
              }),
              h('circle', {
                className: 'progress-ring-fill',
                cx: '130',
                cy: '130',
                r: '120',
                fill: 'none',
                strokeWidth: '2',
                strokeDasharray: 2 * Math.PI * 120,
                strokeDashoffset: 2 * Math.PI * 120 * (1 - progress),
                transform: 'rotate(-90 130 130)'
              })
            ),
            // Breathing circle inside progress ring
            h('div', { className: 'breath-circle' },
              h('div', { className: 'breath-guide' })
            )
          ),
          
          h('button', { 
            className: 'return-button',
            onClick: handleReturn,
            'aria-label': 'End meditation and return'
          }, 'return')
        )
      ) : (
        h('div', { className: 'setup-session' },
          h('h1', { className: 'app-title' }, 'Moment'),
          h('div', { 
            className: `arrive-circle ${isHolding ? 'holding' : ''} ${isConfirming ? 'confirming' : ''}`,
            onMouseDown: handleHoldStart,
            onMouseUp: handleHoldEnd,
            onMouseLeave: handleHoldEnd,
            onTouchStart: handleHoldStart,
            onTouchEnd: handleHoldEnd,
            'aria-label': 'Hold to select meditation duration',
            role: 'button',
            tabIndex: 0,
            style: isHolding || isConfirming ? {
              '--depth': `${holdDuration * 2}`,
              '--opacity': `${Math.max(0, 1 - (holdDuration / 60))}`
            } : {
              '--depth': '0',
              '--opacity': '1'
            }
          },
            h('div', { 
              className: 'arrive-text',
              style: {
                opacity: isHolding ? Math.max(0.2, 1 - (holdDuration / 80)) : 1
              }
            },
              isHolding || isConfirming ? 
                h('div', null,
                  h('span', { 
                    className: `duration-feedback ${isConfirming ? 'confirmed' : ''}`,
                    style: {
                      opacity: isHolding ? Math.max(0.3, 1 - (holdDuration / 60)) : 1
                    }
                  }, holdDuration),
                  h('div', { 
                    className: 'duration-label-active',
                    style: {
                      opacity: isHolding ? Math.max(0.2, 1 - (holdDuration / 40)) : 1
                    }
                  }, 
                    isConfirming ? 'starting...' : 'minutes'
                  )
                ) : 
                h('div', null,
                  h('div', { className: 'arrive-instruction' }, 'hold to arrive'),
                  h('div', { className: 'duration-label' }, 'minutes')
                )
            )
          )
        )
      )
    )
  );
}