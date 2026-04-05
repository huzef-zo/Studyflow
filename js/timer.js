/**
 * StudyFlow - Pomodoro Timer Module
 * Handles session logic and display with Premium UX
 */

const Timer = (function() {
  'use strict';

  // Constants
  const CIRCUMFERENCE = 2 * Math.PI * 140;

  // State
  let timerInterval = null;
  let timeRemaining = 1500;
  let currentSessionType = 'work';
  let isRunning = false;
  let endTime = null;
  let selectedTaskId = null;
  
  // DOM Elements
  let elements = {};

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      timerDisplay: document.getElementById('timer-time'),
      timerLabel: document.getElementById('timer-label'),
      timerProgress: document.getElementById('timer-progress'),
      startBtn: document.getElementById('start-btn'),
      resetBtn: document.getElementById('reset-btn'),
      skipBtn: document.getElementById('skip-btn'),
      taskSelect: document.getElementById('timer-task'),
      taskDisplay: document.getElementById('selected-task-display'),
      playPauseIcon: document.getElementById('play-pause-icon'),
      sessionsToday: document.getElementById('sessions-today'),
      totalTimeToday: document.getElementById('total-time-today'),
      streakCount: document.getElementById('streak-count')
    };
  }

  /**
   * Initialize Timer module
   */
  function init() {
    initElements();
    setupEventListeners();
    populateTasks();
    loadTimerState();
    updateStats();
    updateDisplay();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    elements.startBtn?.addEventListener('click', toggleTimer);
    elements.resetBtn?.addEventListener('click', resetTimer);
    elements.skipBtn?.addEventListener('click', skipSession);
    elements.taskSelect?.addEventListener('change', handleTaskChange);
  }

  /**
   * Toggle between running and paused
   */
  function toggleTimer() {
    isRunning ? pauseTimer() : startTimer();
  }

  /**
   * Start the timer
   */
  function startTimer() {
    if (isRunning) return;
    
    isRunning = true;
    endTime = Date.now() + (timeRemaining * 1000);
    
    // UI Update
    elements.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    document.body.classList.add('focus-mode');
    
    timerInterval = setInterval(tick, 1000);
    saveTimerState();
    
    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Pause the timer
   */
  function pauseTimer() {
    if (!isRunning) return;
    
    isRunning = false;
    clearInterval(timerInterval);
    
    // UI Update
    elements.playPauseIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    document.body.classList.remove('focus-mode');
    
    saveTimerState();
  }

  /**
   * Tick the timer
   */
  function tick() {
    const now = Date.now();
    timeRemaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    
    if (timeRemaining <= 0) {
      completeSession();
    }
    
    updateDisplay();
    // Periodically save state to handle page refreshes
    if (timeRemaining % 5 === 0) saveTimerState();
  }

  /**
   * Handle session completion
   */
  function completeSession() {
    pauseTimer();
    
    const settings = Storage.getSettings();
    const sessionData = {
      type: currentSessionType,
      duration: getSessionDuration(currentSessionType),
      taskId: selectedTaskId
    };
    
    Storage.addSession(sessionData.type, sessionData.duration, sessionData.taskId);
    
    // Notify
    if (settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
      const title = currentSessionType === 'work' ? 'Phase Accomplished!' : 'Cooldown Terminated!';
      const body = currentSessionType === 'work' ? 'Commence cooldown protocol.' : 'Initiate next study phase.';
      new Notification(title, { body });
    }
    
    // Auto-switch to next session
    switchSessionType();
    updateStats();
    updateDisplay();
  }

  function resetTimer() {
    pauseTimer();
    timeRemaining = getSessionDuration(currentSessionType) * 60;
    updateDisplay();
    saveTimerState();
  }

  function skipSession() {
    pauseTimer();
    switchSessionType();
    updateDisplay();
    saveTimerState();
  }

  function switchSessionType() {
    if (currentSessionType === 'work') {
      const stats = Storage.getStats();
      const settings = Storage.getSettings();
      currentSessionType = (stats.sessions.today % settings.sessions_until_long_break === 0) ? 'long-break' : 'short-break';
    } else {
      currentSessionType = 'work';
    }
    timeRemaining = getSessionDuration(currentSessionType) * 60;
  }

  function getSessionDuration(type) {
    const settings = Storage.getSettings();
    if (type === 'work') return settings.work_duration || 25;
    if (type === 'short-break') return settings.short_break || 5;
    return settings.long_break || 15;
  }

  function handleTaskChange() {
    selectedTaskId = elements.taskSelect.value;
    const task = Storage.getTaskById(selectedTaskId);
    elements.taskDisplay.textContent = task ? task.title.toUpperCase() : 'GENERAL FOCUS';
    saveTimerState();
  }

  function populateTasks() {
    const tasks = Storage.getTodayTasks().concat(Storage.getOverdueTasks());
    const uniqueTasks = Array.from(new Set(tasks.map(t => t.id))).map(id => tasks.find(t => t.id === id));
    
    elements.taskSelect.innerHTML = '<option value="">GENERAL FOCUS</option>' +
      uniqueTasks.map(t => `<option value="${t.id}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');
  }

  function updateDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    elements.timerDisplay.textContent = timeStr;
    document.title = `${timeStr} - StudyFlow`;

    const labelMap = { 'work': 'Deep Work', 'short-break': 'Cooldown', 'long-break': 'Deep Rest' };
    elements.timerLabel.textContent = labelMap[currentSessionType];

    // Progress Ring
    const totalTime = getSessionDuration(currentSessionType) * 60;
    const offset = CIRCUMFERENCE - (timeRemaining / totalTime * CIRCUMFERENCE);
    elements.timerProgress.style.strokeDashoffset = offset;
  }

  function updateStats() {
    const stats = Storage.getStats();
    elements.sessionsToday.textContent = stats.sessions.today;
    elements.totalTimeToday.textContent = `${stats.sessions.minutesToday}m`;
    elements.streakCount.textContent = stats.streak;
  }

  function saveTimerState() {
    const state = {
      type: currentSessionType,
      endTime: isRunning ? endTime : null,
      state: isRunning ? 'running' : 'paused',
      timeRemaining: timeRemaining,
      selectedTaskId: selectedTaskId
    };
    localStorage.setItem('studyflow_timer', JSON.stringify(state));
  }

  function loadTimerState() {
    const saved = localStorage.getItem('studyflow_timer');
    if (!saved) return;
    
    const state = JSON.parse(saved);
    currentSessionType = state.type || 'work';
    selectedTaskId = state.selectedTaskId;
    elements.taskSelect.value = selectedTaskId || '';
    handleTaskChange();
    
    if (state.state === 'running' && state.endTime > Date.now()) {
      endTime = state.endTime;
      timeRemaining = Math.ceil((endTime - Date.now()) / 1000);
      startTimer();
    } else {
      timeRemaining = state.timeRemaining || (getSessionDuration(currentSessionType) * 60);
    }
  }

  return { init };
})();

window.Timer = Timer;
