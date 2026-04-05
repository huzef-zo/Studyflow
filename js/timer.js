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
  let endTime = null;
  let sessionsCompleted = 0;
  let selectedTaskId = null;
  let selectedSubtaskId = null;
  
  // Settings
  let settings = {
    workDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsUntilLongBreak: 4,
    autoStartBreak: false,
    autoStartWork: false,
    sound: true,
    notifications: true
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
      recentSessionsList: document.getElementById('recent-sessions-list'),
      taskSelect: document.getElementById('timer-task'),
      subtaskSelect: document.getElementById('timer-subtask'),
      taskSelectionContainer: document.getElementById('task-selection-container'),
      subtaskSelectionContainer: document.getElementById('subtask-selection-container'),
      subtaskTracker: document.getElementById('timer-subtask-tracker')
    };
  }

  /**
   * Populate tasks dropdown
   */
  function populateTasks() {
    if (!elements.taskSelect) return;

    const todayTasks = Storage.getTodayTasks().filter(t => !t.completed);
    const overdueTasks = Storage.getOverdueTasks().filter(t => !t.completed);

    // Combine and remove duplicates
    const allTasks = [...todayTasks, ...overdueTasks];
    const uniqueTasks = [];
    const taskIds = new Set();

    allTasks.forEach(task => {
      if (!taskIds.has(task.id)) {
        taskIds.add(task.id);
        uniqueTasks.push(task);
      }
    });

    // Keep current selection if it still exists
    const currentSelection = elements.taskSelect.value;

    let html = '<option value="">General Study</option>';
    uniqueTasks.forEach(task => {
      const isOverdue = Storage.getDaysUntil(task.dueDate) < 0 && task.type !== 'repeating';
      const label = isOverdue ? `[Overdue] ${task.title}` : task.title;
      html += `<option value="${task.id}" ${task.id === currentSelection ? 'selected' : ''}>${App.escapeHtml(label)}</option>`;
    });

    elements.taskSelect.innerHTML = html;

    // Also populate sub-tasks if a task is already selected
    if (selectedTaskId) {
      populateSubtasks(selectedTaskId);
    }
  }

  /**
   * Populate sub-tasks dropdown based on selected task
   */
  function populateSubtasks(taskId) {
    if (!elements.subtaskSelect || !elements.subtaskSelectionContainer) return;

    if (!taskId) {
      elements.subtaskSelectionContainer.classList.add('hidden');
      selectedSubtaskId = null;
      return;
    }

    const task = Storage.getTaskById(taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) {
      elements.subtaskSelectionContainer.classList.add('hidden');
      selectedSubtaskId = null;
      return;
    }

    elements.subtaskSelectionContainer.classList.remove('hidden');

    // Keep current selection if it still exists
    const currentSelection = selectedSubtaskId || elements.subtaskSelect.value;

    let html = '<option value="">Whole Task / None</option>';
    task.subtasks.forEach(subtask => {
      const cyclesInfo = `(${subtask.completedCycles || 0}/${subtask.estimatedCycles})`;
      html += `<option value="${subtask.id}" ${subtask.id === currentSelection ? 'selected' : ''}>${App.escapeHtml(subtask.title)} ${cyclesInfo}</option>`;
    });

    elements.subtaskSelect.innerHTML = html;

    // Update selectedSubtaskId if current selection is not valid anymore
    if (currentSelection && !task.subtasks.find(s => s.id === currentSelection)) {
      selectedSubtaskId = null;
    }

    updateSubtaskTracker();
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
      autoStartWork: storedSettings.auto_start_work || false,
      sound: storedSettings.sound !== false,
      notifications: storedSettings.notifications !== false
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
        if (selectedTaskId) {
          const task = Storage.getTaskById(selectedTaskId);
          return task ? task.title : 'Work Session';
        }
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
   * Update sub-task cycle tracker UI
   */
  function updateSubtaskTracker() {
    if (!elements.subtaskTracker) return;

    if (!selectedTaskId || !selectedSubtaskId) {
      elements.subtaskTracker.innerHTML = '';
      updateSubtaskTrackerVisibility();
      return;
    }

    const task = Storage.getTaskById(selectedTaskId);
    const subtask = task?.subtasks?.find(s => s.id === selectedSubtaskId);

    if (!subtask) {
      elements.subtaskTracker.innerHTML = '';
      updateSubtaskTrackerVisibility();
      return;
    }

    elements.subtaskTracker.innerHTML = `
      <div class="subtask-item">
        <span class="subtask-title" style="font-size: 0.75rem; color: var(--text-secondary);">Cycle Tracker:</span>
        <div class="subtask-cycle-tracker">
          <button class="btn-cycle-adjust dec" aria-label="Decrease cycle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span class="subtask-cycles-display">
            <span class="completed-count">${subtask.completedCycles || 0}</span> / <span class="estimated-count">${subtask.estimatedCycles}</span>
          </span>
          <button class="btn-cycle-adjust inc" aria-label="Increase cycle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
    `;

    updateSubtaskTrackerVisibility();
  }

  /**
   * Update sub-task tracker visibility based on current state
   */
  function updateSubtaskTrackerVisibility() {
    if (!elements.subtaskTracker) return;

    // Appear if a task with sub-task is selected and we are in WORK mode
    const shouldShow = type === TYPES.WORK && selectedTaskId && selectedSubtaskId;
    elements.subtaskTracker.classList.toggle('hidden', !shouldShow);
  }

  /**
   * Toggle Focus Mode
   */
  function toggleFocusMode(enabled) {
    if (enabled) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
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
    
    // Show/hide task selection based on mode and state
    if (elements.taskSelectionContainer) {
      if (type === TYPES.WORK && state === STATES.IDLE) {
        elements.taskSelectionContainer.classList.remove('hidden');
        if (selectedTaskId) {
          populateSubtasks(selectedTaskId);
        }
      } else {
        elements.taskSelectionContainer.classList.add('hidden');
      }
    }

    updateSubtaskTrackerVisibility();

    // Update progress ring
    const circumference = 2 * Math.PI * 140; // radius = 140
    const progress = totalTime > 0 ? timeRemaining / totalTime : 0;
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
      toggleFocusMode(false);
    } else if (state === STATES.RUNNING) {
      elements.startBtn.classList.add('hidden');
      elements.pauseBtn.classList.remove('hidden');
      toggleFocusMode(true);
    } else if (state === STATES.PAUSED) {
      elements.startBtn.classList.remove('hidden');
      elements.pauseBtn.classList.add('hidden');
      toggleFocusMode(false);
    }
  }

  /**
   * Update statistics display
   */
  function updateStats() {
    const todaySessions = Storage.getTodaySessions();
    const totalMinutes = Storage.getTotalMinutesToday();
    
    if (elements.sessionsToday) elements.sessionsToday.textContent = todaySessions.length;
    if (elements.totalTimeToday) elements.totalTimeToday.textContent = App.formatDuration(totalMinutes);
    if (elements.sessionCount) elements.sessionCount.textContent = sessionsCompleted;

    updateRecentSessions();
  }

  /**
   * Update recent sessions list
   */
  function updateRecentSessions() {
    if (!elements.recentSessionsList) return;

    const allSessions = Storage.getSessions();
    const recentSessions = allSessions
      .filter(s => s.type === TYPES.WORK)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5);

    if (recentSessions.length === 0) {
      elements.recentSessionsList.innerHTML = `
        <div class="empty-state" style="padding: 1rem;">
          <p class="text-secondary text-center">No sessions recorded yet</p>
        </div>
      `;
      return;
    }

    elements.recentSessionsList.innerHTML = recentSessions.map(session => {
      const task = session.taskId ? Storage.getTaskById(session.taskId) : null;
      const taskTitle = task ? task.title : 'General Study';
      const time = new Date(session.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="deadline-item">
          <span class="deadline-date">${time}</span>
          <span class="deadline-title">${App.escapeHtml(taskTitle)}</span>
          <span class="deadline-days">${session.duration}m</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Save current state to storage
   */
  function saveState() {
    Storage.saveTimerState({
      state,
      type,
      timeRemaining,
      totalTime,
      endTime,
      sessionsCompleted,
      selectedTaskId,
      selectedSubtaskId
    });
  }

  /**
   * Start the timer
   */
  function start() {
    if (state === STATES.RUNNING) return;

    // Request notification permission on user gesture if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    state = STATES.RUNNING;
    endTime = Date.now() + (timeRemaining * 1000);
    
    saveState();

    intervalId = setInterval(() => {
      timeRemaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      
      if (timeRemaining <= 0) {
        complete();
      } else {
        updateDisplay();
        // Save periodically in case of crash/close, though endTime handles most of it
        if (timeRemaining % 10 === 0) saveState();
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

    if (endTime) {
      timeRemaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
    }

    clearInterval(intervalId);
    intervalId = null;
    endTime = null;
    
    saveState();
    updateDisplay();
  }

  /**
   * Reset the timer
   */
  function reset() {
    pause();
    state = STATES.IDLE;
    endTime = null;
    timeRemaining = getDurationForType(type);
    totalTime = timeRemaining;
    
    saveState();
    updateDisplay();
  }

  /**
   * Complete the timer session
   */
  function complete() {
    const completedType = type;
    pause();
    
    // Use Storage to handle completion logic for consistency
    const newState = Storage.completeTimerSession({
      type: completedType,
      sessionsCompleted,
      selectedTaskId,
      selectedSubtaskId
    });

    // Update local state from the new state returned by storage
    type = newState.type;
    state = newState.state;
    timeRemaining = newState.timeRemaining;
    totalTime = newState.totalTime;
    sessionsCompleted = newState.sessionsCompleted;
    selectedTaskId = newState.selectedTaskId;
    selectedSubtaskId = newState.selectedSubtaskId;

    // Play notification sound
    playNotificationSound();
    
    if (completedType === TYPES.WORK) {
      App.showToast('Work session completed! Take a break.', 'success');
    } else {
      App.showToast('Break finished! Ready to work?', 'success');
    }

    // Auto-start next session (always on as requested for "focus time clock that changes automatically")
    setTimeout(start, 1000);
    
    updateStats();
    updateDisplay();
    updateSubtaskTracker();
    
    // Show browser notification if permitted
    showBrowserNotification(completedType);
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
    endTime = null;
    timeRemaining = getDurationForType(newType);
    totalTime = timeRemaining;
    
    saveState();
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
  function showBrowserNotification(completedType) {
    if (!('Notification' in window) || !settings.notifications) return;
    
    if (Notification.permission === 'granted') {
      const title = completedType === TYPES.WORK ? 'Work Session Complete!' : 'Break Finished!';
      const body = completedType === TYPES.WORK
        ? 'Great job! Time for a break.' 
        : 'Ready to get back to work?';
      
      new Notification(title, { body });
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
    
    // Task selection
    elements.taskSelect?.addEventListener('change', (e) => {
      selectedTaskId = e.target.value || null;
      selectedSubtaskId = null; // Reset subtask when task changes
      populateSubtasks(selectedTaskId);
      updateDisplay();
    });

    // Subtask selection
    elements.subtaskSelect?.addEventListener('change', (e) => {
      selectedSubtaskId = e.target.value || null;
      saveState();
      updateSubtaskTracker();
    });

    // Cycle tracker event delegation
    elements.subtaskTracker?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-cycle-adjust');
      if (!btn || !selectedTaskId || !selectedSubtaskId) return;

      const task = Storage.getTaskById(selectedTaskId);
      if (!task || !task.subtasks) return;

      const subtask = task.subtasks.find(s => s.id === selectedSubtaskId);
      if (!subtask) return;

      let completedCycles = subtask.completedCycles || 0;
      if (btn.classList.contains('inc')) {
        completedCycles++;
      } else if (btn.classList.contains('dec')) {
        completedCycles = Math.max(0, completedCycles - 1);
      }

      Storage.updateSubtask(selectedTaskId, selectedSubtaskId, { completedCycles });
      updateSubtaskTracker();

      // Update subtask select text to show new cycle count
      populateSubtasks(selectedTaskId);
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
    
    // Visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state === STATES.RUNNING && endTime) {
        // Recalculate time remaining when returning to the tab
        timeRemaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
        updateDisplay();
      }
    });
  }

  /**
   * Initialize Timer module
   */
  function init() {
    initElements();
    loadSettings();
    populateTasks();
    setupEventListeners();
    
    // Load state from storage
    const storedState = Storage.getTimerState();
    if (storedState) {
      state = storedState.state;
      type = storedState.type;
      totalTime = storedState.totalTime;
      sessionsCompleted = storedState.sessionsCompleted || 0;
      selectedTaskId = storedState.selectedTaskId;
      selectedSubtaskId = storedState.selectedSubtaskId;

      if (state === STATES.RUNNING && storedState.endTime) {
        endTime = storedState.endTime;
        timeRemaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));

        if (timeRemaining <= 0) {
          complete();
        } else {
          start(); // Resume interval
        }
      } else {
        timeRemaining = storedState.timeRemaining;
        if (state === STATES.RUNNING) state = STATES.PAUSED; // Fallback
      }

      // Update task selects if we had them
      if (selectedTaskId && elements.taskSelect) {
        elements.taskSelect.value = selectedTaskId;
        populateSubtasks(selectedTaskId);
        if (selectedSubtaskId && elements.subtaskSelect) {
          elements.subtaskSelect.value = selectedSubtaskId;
        }
      }
    } else {
      // Set initial state
      timeRemaining = getDurationForType(type);
      totalTime = timeRemaining;
    }
    
    updateDisplay();
    updateStats();
    updateSubtaskTracker();
    
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
