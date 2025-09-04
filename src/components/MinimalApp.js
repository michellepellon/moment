function MinimalApp() {
  const { useState, useRef, useEffect, createElement: h } = React;
  const [view, setView] = useState('practice');
  const touchStartX = useRef(0);
  const containerRef = useRef(null);
  
  useEffect(() => {
    // Load theme preference
    chrome.storage.local.get(['theme'], (data) => {
      const theme = data.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    });
    
    // Listen for bell completion message
    const handleMessage = (message) => {
      if (message.action === 'PLAY_BELLS') {
        playCompletionBells(message.count || 3);
        // Trigger settling in PracticeView through event
        window.dispatchEvent(new CustomEvent('session-completed'));
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);
  
  const playCompletionBells = async (count) => {
    const audio = new Audio('../assets/bell.mp3');
    audio.volume = 0.5;
    
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => {
        audio.volume = 0.5 - (i * 0.15); // Each bell softer
        audio.currentTime = 0;
        audio.play();
        setTimeout(resolve, 2000); // 2 seconds between bells
      });
    }
  };
  
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  
  const handleTouchEnd = (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX.current - touchEndX;
    
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0 && view === 'practice') {
        // Swipe left - go to reflection
        setView('reflection');
      } else if (deltaX < 0 && view === 'reflection') {
        // Swipe right - go to practice
        setView('practice');
      }
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' && view === 'reflection') {
      setView('practice');
    } else if (e.key === 'ArrowRight' && view === 'practice') {
      setView('reflection');
    }
  };
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    // Listen for navigation events
    const handleNavigate = (e) => {
      if (e.type === 'navigate-to-reflection') {
        setView('reflection');
      } else if (e.type === 'navigate-to-practice') {
        setView('practice');
      }
    };
    
    window.addEventListener('navigate-to-reflection', handleNavigate);
    window.addEventListener('navigate-to-practice', handleNavigate);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('navigate-to-reflection', handleNavigate);
      window.removeEventListener('navigate-to-practice', handleNavigate);
    };
  }, [view]);
  
  return h('div', { 
    className: 'app-container',
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    ref: containerRef
  },
    h('div', { className: `views-container view-${view}` },
      h('div', { className: 'view-wrapper practice-wrapper' },
        h(PracticeView)
      ),
      h('div', { className: 'view-wrapper reflection-wrapper' },
        h(ReflectionView)
      )
    )
  );
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(MinimalApp));
});