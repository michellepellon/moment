function ReflectionView() {
  const { useState, useEffect, createElement: h } = React;
  const [sessions, setSessions] = useState([]);
  const [haiku, setHaiku] = useState(['', '', '']);
  const [riverData, setRiverData] = useState([]);
  
  useEffect(() => {
    loadSessions();
  }, []);
  
  const loadSessions = () => {
    chrome.storage.local.get(['sessions'], (data) => {
      const allSessions = data.sessions || [];
      setSessions(allSessions);
      generateHaiku(allSessions);
      generateRiver(allSessions);
    });
  };
  
  const generateRiver = (sessionList) => {
    if (sessionList.length === 0) {
      setRiverData([]);
      return;
    }
    
    // Group sessions by day
    const dayMap = {};
    sessionList.forEach(session => {
      const date = new Date(session.date).toDateString();
      if (!dayMap[date]) {
        dayMap[date] = [];
      }
      dayMap[date].push(session);
    });
    
    // Get last 30 days
    const river = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      if (dayMap[dateStr]) {
        // Day with practice - create ripple
        const totalMinutes = dayMap[dateStr].reduce((sum, s) => sum + s.duration, 0);
        const intensity = Math.min(1, totalMinutes / 60); // Normalize to 0-1
        river.push({
          type: 'ripple',
          intensity: intensity,
          count: dayMap[dateStr].length
        });
      } else {
        // Day without practice - still water
        river.push({
          type: 'still',
          intensity: 0,
          count: 0
        });
      }
    }
    
    setRiverData(river);
  };
  
  const generateHaiku = (sessionList) => {
    // Dogen quotes
    const koans = [
      ['If you are unable to find', 'the truth right where you are,', 'where else do you expect to find it?'],
      ['A fool sees himself', 'as another, but a wise man', 'sees others as himself.'],
      ['If you want to travel', 'the Way of Buddhas and Zen masters,', 'then expect nothing, seek nothing, and grasp nothing.'],
      ['If you want to see', 'things just as they are,', 'then you yourself must practice just as you are.'],
      ['Those who seek', 'the easy way', 'do not seek the true way.'],
      ['Prefer to be defeated', 'in the presence of the wise', 'than to excel among fools.'],
      ['To study Buddhism', 'is to study ourselves.', 'To study ourselves is to forget ourselves.'],
      ['The whole moon', 'and the entire sky', 'are reflected in one dewdrop on the grass.'],
      ['Enlightenment', 'is intimacy', 'with all things.'],
      ['When both body and mind are at peace,', 'all things appear as they are:', 'perfect, complete, lacking nothing.'],
      ['A flower falls,', 'even though we love it;', 'and a weed grows, even though we do not love it.']
    ];
    
    if (sessionList.length === 0) {
      // For empty practice, show invitation
      setHaiku(['The cushion waits', 'in perfect stillness—', 'begin when ready']);
      return;
    }
    
    // Use session count as seed for consistent but rotating koans
    // This ensures the same koan appears for the same practice state
    const seed = sessionList.length + new Date().getDay();
    const koanIndex = koans.length > 0 ? seed % koans.length : 0;
    if (koans.length > 0) {
      setHaiku(koans[koanIndex]);
    }
  };
  
  const renderRiverDay = (day, index) => {
    const opacity = 0.3 + (index / 30) * 0.7; // Fade older days
    
    return h('div', {
      key: index,
      className: `river-day ${day.type}`,
      style: {
        opacity: opacity,
        height: day.type === 'ripple' ? `${20 + day.intensity * 30}px` : '2px',
        background: day.type === 'ripple' 
          ? `linear-gradient(180deg, transparent, var(--color-primary-light), transparent)`
          : 'var(--color-whisper)'
      }
    });
  };
  
  return h('div', { className: 'reflection-view' },
    // Return button in top-left (only in reflection view)
    h('div', { 
      className: 'return-to-practice',
      onClick: () => window.dispatchEvent(new CustomEvent('navigate-to-practice')),
      title: 'Return to practice',
      'aria-label': 'Return to practice view',
      role: 'button',
      tabIndex: 0
    },
      h('span', null, '←')
    ),
    
    h('div', { className: 'reflection-container' },
      
      // Haiku section
      h('div', { className: 'haiku-section' },
        haiku.map((line, i) => 
          h('div', { 
            key: i, 
            className: `haiku-line haiku-line-${i + 1}` 
          }, line)
        )
      ),
      
      // River visualization
      h('div', { className: 'river-container' },
        h('div', { className: 'river-label' }, 'your practice flows'),
        h('div', { className: 'river-flow' },
          riverData.map((day, index) => renderRiverDay(day, index))
        ),
        h('div', { className: 'river-bed' })
      ),
      
      // About section
      h('div', { className: 'about-section' },
        h('div', { className: 'about-text' },
          'made with ',
          h('span', { className: 'heart' }, '♥'),
          ' in houston, texas'
        ),
        h('div', { className: 'about-copyright' },
          '©2025 Michelle Pellon'
        )
      )
    )
  );
}