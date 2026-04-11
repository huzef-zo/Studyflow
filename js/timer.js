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
  let selectedSubtaskId = null;
  let sessionsInCycle = 0;
  
  // Audio Context for sounds
  let audioCtx = null;

  /**
   * Play a sci-fi transition sound
   */
  function playTransitionSound(type) {
    const settings = Storage.getSettings();
    if (settings.sound === false) return;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;

      if (type === 'work') {
        // Mission Start sound (rising sine)
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      } else if (type === 'short_break') {
        // Cooldown sound (falling square)
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      } else if (type === 'long_break') {
        // Deep Rest sound (complex drone)
        [440, 220, 110].forEach((freq, i) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = i % 2 === 0 ? 'sine' : 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq / 2, now + 1.0);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.05, now + 0.2);
          gain.gain.linearRampToValueAtTime(0, now + 1.0);
          osc.start(now);
          osc.stop(now + 1.0);
        });
      }
    } catch (e) {
      console.error('Audio feedback failed:', e);
    }
  }

  // DOM Elements
  let elements = {};

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      timerContainer: document.getElementById('timer-container'),
      timerDisplay: document.getElementById('timer-time'),
      timerLabel: document.getElementById('timer-label'),
      timerProgress: document.getElementById('timer-progress'),
      startBtn: document.getElementById('start-btn'),
      resetBtn: document.getElementById('reset-btn'),
      taskSelect: document.getElementById('timer-task'),
      subtaskSelect: document.getElementById('timer-subtask'),
      subtaskContainer: document.getElementById('subtask-select-container'),
      subtaskTracker: document.getElementById('subtask-tracker-container'),
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
    elements.taskSelect?.addEventListener('change', handleTaskChange);
    elements.subtaskSelect?.addEventListener('change', handleSubtaskChange);
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
    elements.timerContainer.classList.add('active');
    
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
    elements.timerContainer.classList.remove('active');
    
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
    
    Storage.addSession(sessionData.duration, sessionData.type, sessionData.taskId);

    // If this was a work session, increment cycle counter
    if (currentSessionType === 'work') {
      sessionsInCycle++;

      // If subtask was selected, increment its cycles
      if (selectedTaskId && selectedSubtaskId) {
        const task = Storage.getTaskById(selectedTaskId);
        const subtask = task?.subtasks?.find(s => s.id === selectedSubtaskId);
        if (subtask) {
          Storage.updateSubtask(selectedTaskId, selectedSubtaskId, {
            completedCycles: (subtask.completedCycles || 0) + 1
          });
          updateSubtaskTracker();
        }
      }
    } else if (currentSessionType === 'long_break') {
      // Reset cycle counter after deep rest
      sessionsInCycle = 0;
    }
    
    // Notify
    if (settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
      const title = currentSessionType === 'work' ? 'Phase Accomplished!' : 'Interval Terminated!';
      const body = currentSessionType === 'work' ? 'Commence cooldown protocol.' : 'Initiate next study phase.';
      new Notification(title, { body });
    }
    
    // Auto-switch to next session
    switchSessionType();
    saveTimerState(); // Persist the new state immediately

    // Play sound for the NEW session type
    playTransitionSound(currentSessionType);

    updateStats();
    updateDisplay();

    // Auto-start if enabled
    if (currentSessionType === 'work') {
      if (settings.auto_start_work) startTimer();
    } else {
      if (settings.auto_start_break) startTimer();
    }
  }

  function resetTimer() {
    pauseTimer();
    sessionsInCycle = 0;
    currentSessionType = 'work';
    timeRemaining = getSessionDuration(currentSessionType) * 60;
    updateDisplay();
    saveTimerState();
  }

  function switchSessionType() {
    const settings = Storage.getSettings();

    if (currentSessionType === 'work') {
      // After work, always Cooldown (short_break)
      currentSessionType = 'short_break';
    } else if (currentSessionType === 'short_break') {
      // After Cooldown, check if we should do Deep Rest (long_break) or return to Work
      if (sessionsInCycle > 0 && sessionsInCycle % (settings.sessions_until_long_break || 4) === 0) {
        currentSessionType = 'long_break';
      } else {
        currentSessionType = 'work';
      }
    } else {
      // After Deep Rest, always return to Work
      currentSessionType = 'work';
    }

    timeRemaining = getSessionDuration(currentSessionType) * 60;
  }

  function getSessionDuration(type) {
    const settings = Storage.getSettings();
    if (type === 'work') return settings.work_duration || 25;
    if (type === 'short_break') return settings.short_break || 5;
    return settings.long_break || 15;
  }

  function handleTaskChange() {
    selectedTaskId = elements.taskSelect.value;
    const task = Storage.getTaskById(selectedTaskId);
    elements.taskDisplay.textContent = task ? task.title.toUpperCase() : 'GENERAL FOCUS';
    populateSubtasks(selectedTaskId);
    saveTimerState();
  }

  function handleSubtaskChange() {
    selectedSubtaskId = elements.subtaskSelect.value;
    updateSubtaskTracker();
    updateDisplay();
    saveTimerState();
  }

  function populateSubtasks(taskId) {
    if (!elements.subtaskSelect || !elements.subtaskContainer) return;

    const task = Storage.getTaskById(taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) {
      elements.subtaskContainer.style.display = 'none';
      elements.subtaskSelect.innerHTML = '<option value="">SELECT SUB-MISSION</option>';
      selectedSubtaskId = null;
      updateSubtaskTracker();
      return;
    }

    elements.subtaskContainer.style.display = 'block';
    elements.subtaskSelect.innerHTML = '<option value="">SELECT SUB-MISSION</option>' +
      task.subtasks.map(s => `<option value="${s.id}" ${s.id === selectedSubtaskId ? 'selected' : ''}>${App.escapeHtml(s.title)}</option>`).join('');

    // If previously selected subtask is not in the new task, reset it
    if (selectedSubtaskId && !task.subtasks.some(s => s.id === selectedSubtaskId)) {
      selectedSubtaskId = null;
      elements.subtaskSelect.value = '';
    }

    updateSubtaskTracker();
    updateDisplay();
  }

  function updateSubtaskTracker() {
    if (!elements.subtaskTracker) return;

    if (!selectedTaskId || !selectedSubtaskId) {
      elements.subtaskTracker.innerHTML = '';
      return;
    }

    const task = Storage.getTaskById(selectedTaskId);
    const subtask = task?.subtasks?.find(s => s.id === selectedSubtaskId);

    if (!subtask) {
      elements.subtaskTracker.innerHTML = '';
      return;
    }

    elements.subtaskTracker.innerHTML = `
      <div class="subtask-cycle-tracker">
        <button class="cycle-btn" id="dec-cycle">-</button>
        <span>${subtask.completedCycles}/${subtask.estimatedCycles} Cycles</span>
        <button class="cycle-btn" id="inc-cycle">+</button>
      </div>
    `;

    // Add listeners
    document.getElementById('inc-cycle')?.addEventListener('click', () => {
      Storage.updateSubtask(selectedTaskId, selectedSubtaskId, {
        completedCycles: (subtask.completedCycles || 0) + 1
      });
      updateSubtaskTracker();
    });

    document.getElementById('dec-cycle')?.addEventListener('click', () => {
      if (subtask.completedCycles > 0) {
        Storage.updateSubtask(selectedTaskId, selectedSubtaskId, {
          completedCycles: subtask.completedCycles - 1
        });
        updateSubtaskTracker();
      }
    });
  }

  function populateTasks() {
    const tasks = Storage.getTodayTasks().concat(Storage.getOverdueTasks());
    const uniqueTasks = Array.from(new Set(tasks.map(t => t.id))).map(id => tasks.find(t => t.id === id));
    
    elements.taskSelect.innerHTML = '<option value="">GENERAL FOCUS</option>' +
      uniqueTasks.map(t => `<option value="${t.id}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');
  }

  function updateDisplay() {
    // Show tracker only during work sessions if subtask is selected
    if (elements.subtaskTracker) {
      elements.subtaskTracker.style.display = (currentSessionType === 'work' && selectedSubtaskId) ? 'flex' : 'none';
    }

    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    elements.timerDisplay.textContent = timeStr;
    document.title = `${timeStr} - StudyFlow`;

    const labelMap = { 'work': 'Deep Work', 'short_break': 'Cooldown', 'long_break': 'Deep Rest' };
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
      selectedTaskId: selectedTaskId,
      selectedSubtaskId: selectedSubtaskId,
      sessionsInCycle: sessionsInCycle
    };
    localStorage.setItem('studyflow_timer', JSON.stringify(state));
  }

  function loadTimerState() {
    const saved = localStorage.getItem('studyflow_timer');
    if (!saved) return;
    
    const state = JSON.parse(saved);
    currentSessionType = state.type || 'work';
    selectedTaskId = state.selectedTaskId;
    selectedSubtaskId = state.selectedSubtaskId;
    sessionsInCycle = state.sessionsInCycle || 0;

    if (elements.taskSelect) {
      elements.taskSelect.value = selectedTaskId || '';
      // We don't call handleTaskChange directly to avoid redundant saveTimerState
      const task = Storage.getTaskById(selectedTaskId);
      if (elements.taskDisplay) {
        elements.taskDisplay.textContent = task ? task.title.toUpperCase() : 'GENERAL FOCUS';
      }
      populateSubtasks(selectedTaskId);
      if (elements.subtaskSelect) {
        elements.subtaskSelect.value = selectedSubtaskId || '';
      }
      updateSubtaskTracker();
    }
    
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
