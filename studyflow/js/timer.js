/**
 * StudyFlow - Timer Module
 * Handles Pomodoro timer functionality
 */

const Timer = (function() {
  'use strict';

  // Timer states
  const STATES = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused'
  };

  // Timer types
  const TYPES = {
    WORK: 'work',
    SHORT_BREAK: 'short_break',
    LONG_BREAK: 'long_break'
  };

  // State
  let state = STATES.IDLE;
  let type = TYPES.WORK;
  let timeRemaining = 25 * 60; // seconds
  let totalTime = 25 * 60;
  let intervalId = null;
  let sessionsCompleted = 0;
  
  // Settings
  let settings = {
    workDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreak: false,
    sound: true
  };

  // DOM Elements
  let elements = {};

  // Audio context for notifications
  let audioContext = null;

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      timerRing: document.getElementById('timer-ring'),
      timerProgress: document.getElementById('timer-progress'),
      timerTime: document.getElementById('timer-time'),
      timerLabel: document.getElementById('timer-label'),
      startBtn: document.getElementById('start-btn'),
      pauseBtn: document.getElementById('pause-btn'),
      resetBtn: document.getElementById('reset-btn'),
      skipBtn: document.getElementById('skip-btn'),
      sessionsToday: document.getElementById('sessions-today'),
      totalTimeToday: document.getElementById('total-time-today'),
      sessionCount: document.getElementById('session-count'),
      modeTabs: document.querySelectorAll('.tab[data-mode]')
    };
  }

  /**
   * Load settings from storage
   */
  function loadSettings() {
    const storedSettings = Storage.getSettings();
    settings = {
      workDuration: storedSettings.work_duration || 25,
      shortBreak: storedSettings.short_break || 5,
      longBreak: storedSettings.long_break || 15,
      sessionsUntilLongBreak: storedSettings.sessions_until_long_break || 4,
      autoStartBreak: storedSettings.auto_start_break || false,
      sound: storedSettings.sound !== false
    };
  }

  /**
   * Format time as MM:SS
   */
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get duration for current timer type
   */
  function getDurationForType(timerType) {
    switch (timerType) {
      case TYPES.WORK:
        return settings.workDuration * 60;
      case TYPES.SHORT_BREAK:
        return settings.shortBreak * 60;
      case TYPES.LONG_BREAK:
        return settings.longBreak * 60;
      default:
        return settings.workDuration * 60;
    }
  }

  /**
   * Get label for current timer type
   */
  function getLabelForType(timerType) {
    switch (timerType) {
      case TYPES.WORK:
        return 'Work Session';
      case TYPES.SHORT_BREAK:
        return 'Short Break';
      case TYPES.LONG_BREAK:
        return 'Long Break';
      default:
        return 'Work Session';
    }
  }

  /**
   * Update timer display
   */
  function updateDisplay() {
    // Update time
    elements.timerTime.textContent = formatTime(timeRemaining);
    
    // Update label
    elements.timerLabel.textContent = getLabelForType(type);
    
    // Update progress ring
    const circumference = 2 * Math.PI * 140; // radius = 140
    const progress = timeRemaining / totalTime;
    const offset = circumference * (1 - progress);
    
    elements.timerProgress.style.strokeDasharray = circumference;
    elements.timerProgress.style.strokeDashoffset = offset;
    
    // Update progress ring color
    if (type === TYPES.WORK) {
      elements.timerProgress.classList.remove('break');
    } else {
      elements.timerProgress.classList.add('break');
    }
    
    // Update document title
    document.title = `${formatTime(timeRemaining)} - ${getLabelForType(type)} - StudyFlow`;
    
    // Update buttons visibility
    if (state === STATES.IDLE) {
      elements.startBtn.classList.remove('hidden');
      elements.pauseBtn.classList.add('hidden');
    } else if (state === STATES.RUNNING) {
      elements.startBtn.classList.add('hidden');
      elements.pauseBtn.classList.remove('hidden');
    } else if (state === STATES.PAUSED) {
      elements.startBtn.classList.remove('hidden');
      elements.pauseBtn.classList.add('hidden');
    }
  }

  /**
   * Update statistics display
   */
  function updateStats() {
    const todaySessions = Storage.getTodaySessions();
    const totalMinutes = Storage.getTotalMinutesToday();
    
    elements.sessionsToday.textContent = todaySessions.length;
    elements.totalTimeToday.textContent = App.formatDuration(totalMinutes);
    elements.sessionCount.textContent = sessionsCompleted;
  }

  /**
   * Start the timer
   */
  function start() {
    if (state === STATES.RUNNING) return;
    
    state = STATES.RUNNING;
    
    intervalId = setInterval(() => {
      timeRemaining--;
      
      if (timeRemaining <= 0) {
        complete();
      } else {
        updateDisplay();
      }
    }, 1000);
    
    updateDisplay();
  }

  /**
   * Pause the timer
   */
  function pause() {
    if (state !== STATES.RUNNING) return;
    
    state = STATES.PAUSED;
    clearInterval(intervalId);
    intervalId = null;
    
    updateDisplay();
  }

  /**
   * Reset the timer
   */
  function reset() {
    pause();
    state = STATES.IDLE;
    timeRemaining = getDurationForType(type);
    totalTime = timeRemaining;
    
    updateDisplay();
  }

  /**
   * Complete the timer session
   */
  function complete() {
    pause();
    
    // Play notification sound
    playNotificationSound();
    
    // Save session if it was a work session
    if (type === TYPES.WORK) {
      Storage.addSession(settings.workDuration, 'work');
      Storage.addStudyMinutes(settings.workDuration);
      sessionsCompleted++;
      App.showToast('Work session completed! Take a break.', 'success');
    } else {
      App.showToast('Break finished! Ready to work?', 'success');
    }
    
    // Determine next session type
    let nextType;
    if (type === TYPES.WORK) {
      // Check if it's time for a long break
      if (sessionsCompleted % settings.sessionsUntilLongBreak === 0) {
        nextType = TYPES.LONG_BREAK;
      } else {
        nextType = TYPES.SHORT_BREAK;
      }
    } else {
      nextType = TYPES.WORK;
    }
    
    // Switch to next type
    setTimerType(nextType);
    
    // Auto-start break if enabled
    if (settings.autoStartBreak && nextType !== TYPES.WORK) {
      setTimeout(start, 1000);
    }
    
    updateStats();
    
    // Show browser notification if permitted
    showBrowserNotification();
  }

  /**
   * Skip to next session
   */
  function skip() {
    let nextType;
    if (type === TYPES.WORK) {
      if (sessionsCompleted % settings.sessionsUntilLongBreak === 0 && sessionsCompleted > 0) {
        nextType = TYPES.LONG_BREAK;
      } else {
        nextType = TYPES.SHORT_BREAK;
      }
    } else {
      nextType = TYPES.WORK;
    }
    
    setTimerType(nextType);
  }

  /**
   * Set timer type
   */
  function setTimerType(newType) {
    type = newType;
    state = STATES.IDLE;
    timeRemaining = getDurationForType(newType);
    totalTime = timeRemaining;
    
    // Update active tab
    elements.modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === newType);
    });
    
    updateDisplay();
  }

  /**
   * Play notification sound
   */
  function playNotificationSound() {
    if (!settings.sound) return;
    
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // Create a simple beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // Play second beep
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.5);
      }, 200);
      
    } catch (e) {
      console.log('Audio not supported');
    }
  }

  /**
   * Show browser notification
   */
  function showBrowserNotification() {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      const title = type === TYPES.WORK ? 'Work Session Complete!' : 'Break Finished!';
      const body = type === TYPES.WORK 
        ? 'Great job! Time for a break.' 
        : 'Ready to get back to work?';
      
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    }
  }

  /**
   * Request notification permission
   */
  function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    elements.startBtn?.addEventListener('click', start);
    elements.pauseBtn?.addEventListener('click', pause);
    elements.resetBtn?.addEventListener('click', reset);
    elements.skipBtn?.addEventListener('click', skip);
    
    // Mode tabs
    elements.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (state === STATES.RUNNING) {
          App.showToast('Pause the timer first to change mode', 'warning');
          return;
        }
        setTimerType(tab.dataset.mode);
      });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (state === STATES.RUNNING) {
            pause();
          } else {
            start();
          }
          break;
        case 'KeyR':
          if (e.ctrlKey || e.metaKey) return;
          reset();
          break;
        case 'KeyS':
          if (e.ctrlKey || e.metaKey) return;
          skip();
          break;
      }
    });
    
    // Visibility change - pause when tab is hidden (optional)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state === STATES.RUNNING) {
        // Timer continues in background
        // Could optionally pause here
      }
    });
  }

  /**
   * Initialize Timer module
   */
  function init() {
    initElements();
    loadSettings();
    setupEventListeners();
    
    // Set initial state
    timeRemaining = getDurationForType(type);
    totalTime = timeRemaining;
    
    updateDisplay();
    updateStats();
    
    // Request notification permission
    requestNotificationPermission();
  }

  // Public API
  return {
    init,
    start,
    pause,
    reset,
    skip,
    setTimerType,
    updateDisplay,
    updateStats
  };
})();

// Make Timer available globally
window.Timer = Timer;
