// Background Service Worker for Moment
// Handles timer management, alarms, and notifications

// Timer state
let timerState = {
  isActive: false,
  startTime: null,
  duration: 0,
  endTime: null,
  type: 'zazen'
};

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  chrome.storage.local.set({
    settings: {
      defaultDuration: 20,
      theme: 'light'
    },
    sessions: [],
    timerState: timerState
  });
});

// Restore timer state on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['timerState'], (data) => {
    if (data.timerState && data.timerState.isActive) {
      const now = Date.now();
      // Check if timer should still be active
      if (data.timerState.endTime > now) {
        timerState = data.timerState;
        updateBadge();
        startBadgeUpdater();
      } else {
        // Timer expired while browser was closed
        stopTimer();
      }
    }
  });
});

// Message handler for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'START_TIMER':
      startTimer(request.duration, request.type);
      sendResponse({ success: true });
      break;
      
    case 'STOP_TIMER':
      stopTimer();
      sendResponse({ success: true });
      break;
      
    case 'GET_STATE':
      // Calculate remaining time if timer is active
      if (timerState.isActive && timerState.endTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((timerState.endTime - now) / 60000));
        sendResponse({ 
          isActive: timerState.isActive,
          remaining: remaining,
          endTime: timerState.endTime,
          duration: timerState.duration
        });
      } else {
        sendResponse({ 
          isActive: false,
          remaining: 0,
          endTime: null,
          duration: 0
        });
      }
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open for async response
});

// Start timer function
function startTimer(duration, type = 'zazen') {
  const now = Date.now();
  timerState = {
    isActive: true,
    startTime: now,
    duration: duration,
    endTime: now + (duration * 60000), // Convert minutes to milliseconds
    type: type
  };
  
  // Save state
  chrome.storage.local.set({ timerState });
  
  // Create alarm
  chrome.alarms.create('meditation-timer', {
    when: timerState.endTime
  });
  
  // Start updating badge
  updateBadge();
  startBadgeUpdater();
}

// Stop timer function
function stopTimer() {
  timerState = {
    isActive: false,
    startTime: null,
    duration: 0,
    endTime: null
  };
  
  // Save state
  chrome.storage.local.set({ timerState });
  
  // Clear alarm
  chrome.alarms.clear('meditation-timer');
  
  // Clear badge
  chrome.action.setBadgeText({ text: '' });
  
  // Stop badge updater
  chrome.alarms.clear('badge-updater');
}

// Update badge with remaining time
function updateBadge() {
  if (!timerState.isActive || !timerState.endTime) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((timerState.endTime - now) / 60000));
  
  if (remaining > 0) {
    chrome.action.setBadgeText({ text: String(remaining) });
    chrome.action.setBadgeBackgroundColor({ color: '#4A4A4A' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Start badge updater alarm
function startBadgeUpdater() {
  // Update badge every 30 seconds
  chrome.alarms.create('badge-updater', {
    periodInMinutes: 0.5
  });
}

// Listen for badge updater alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'badge-updater') {
    updateBadge();
    
    // Stop updater if timer is no longer active
    if (!timerState.isActive) {
      chrome.alarms.clear('badge-updater');
    }
  }
});

// Handle timer completion
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'meditation-timer') {
    // Save session to history
    const completedDuration = timerState.duration;
    const completedType = timerState.type;
    const now = new Date();
    
    chrome.storage.local.get(['sessions'], (data) => {
      const sessions = data.sessions || [];
      
      sessions.push({
        date: now.toISOString(),
        duration: completedDuration,
        type: completedType
      });
      
      chrome.storage.local.set({ 
        sessions
      });
    });
    
    // Reset timer state
    stopTimer();
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Meditation Complete',
      message: `Your ${timerState.duration} minute session has finished.`,
      priority: 2,
      silent: false
    });
    
    // Send message to popup if it's open to play three bells
    chrome.runtime.sendMessage({ 
      action: 'PLAY_BELLS',
      type: 'completion',
      count: 3
    }).catch(() => {
      // Popup not open, that's ok
    });
  }
});