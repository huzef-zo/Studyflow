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
  // Tracks how many Deep Work blocks have been completed in the current cycle.
  // Resets to 0 after a Deep Rest (long_break) finishes.
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

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'work') {
        // Mission Start sound (rising sine)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      } else if (type === 'short_break') {
        // Cooldown sound (falling square)
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
      } else if (type === 'long_break') {
        // Deep Rest sound (complex drone)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, now);
        oscillator.frequency.linearRampToValueAtTime(110, now + 1.5);

        // Add a second oscillator for a richer drone
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(110, now);
        osc2.frequency.linearRampToValueAtTime(55, now + 1.5);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.5);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.5);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.2, now + 0.5);
        gain2.gain.linearRampToValueAtTime(0, now + 1.5);

        oscillator.start(now);
        oscillator.stop(now + 1.5);
        osc2.start(now);
        osc2.stop(now + 1.5);
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
      activeMissionLabel: document.getElementById('active-mission-label'),
      playPauseIcon: document.getElementById('play-pause-icon'),
      sessionsToday: document.getElementById('sessions-today'),
      totalTimeToday: document.getElementById('total-time-today'),
      streakCount: document.getElementById('streak-count'),
      cycleIndicator: document.getElementById('cycle-indicator')
    };
  }

  /**
   * Initialize Timer module
   */
  function init() {
    initElements();
    setupEventListeners();
    populateTasks();

    // Initialize with duration from settings
    timeRemaining = getSessionDuration('work') * 60;

    loadTimerState();
    updateStats();
    updateDisplay();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Global listener to unlock AudioContext on first interaction
    const unlockAudio = () => {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          console.log('AudioContext resumed successfully');
        });
      }
      // Remove listeners once audio is unlocked
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    elements.startBtn?.addEventListener('click', toggleTimer);
    elements.resetBtn?.addEventListener('click', resetTimer);
    elements.taskSelect?.addEventListener('change', handleTaskChange);
    elements.subtaskSelect?.addEventListener('change', handleSubtaskChange);

    // Sync state when returning to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadTimerState();
        updateDisplay();
        updateStats();
      }
    });
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

    // Initialize/Resume Audio Context on user gesture
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch (e) {
      console.error('Failed to initialize AudioContext:', e);
    }
    
    isRunning = true;
    endTime = Date.now() + (timeRemaining * 1000);
    
    // UI Update
    elements.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    elements.playPauseIcon.style.transform = 'none';
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
    elements.playPauseIcon.innerHTML = `<polygon points="6 3 20 12 6 21 6 3"/>`;
    elements.playPauseIcon.style.transform = 'translateX(2px)';
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
      return; // completeSession handles display + auto-start; stop processing this tick
    }

    updateDisplay();
    // Periodically save state to handle page refreshes
    if (timeRemaining % 5 === 0) saveTimerState();
  }

  /**
   * Handle session completion and advance to the next phase.
   */
  function completeSession() {
    pauseTimer();

    const settings = Storage.getSettings();
    const currentState = {
      type: currentSessionType,
      sessionsInCycle: sessionsInCycle,
      selectedTaskId: selectedTaskId,
      selectedSubtaskId: selectedSubtaskId
    };

    // Use unified storage logic to determine next state
    const nextState = Storage.completeTimerSession(currentState, true);

    // Sync local state
    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;

    // ── 4. Notify user ─────────────────────────────────────────────────────
    if (settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
      const labels = {
        work: 'Deep Work — GO!',
        short_break: 'Cooldown Time',
        long_break: 'Deep Rest — Well Earned!'
      };
      const bodies = {
        work: 'Focus mode engaged. Start your deep work block.',
        short_break: 'Take a short break. You earned it.',
        long_break: 'Great cycle! Enjoy a longer rest.'
      };
      new Notification(labels[currentSessionType], { body: bodies[currentSessionType] });
    }

    // ── 5. Sound cue ───────────────────────────────────────────────────────
    playTransitionSound(currentSessionType);

    // ── 6. Refresh UI (completeTimerSession already persisted to Storage) ──
    updateSubtaskTracker();
    updateStats();
    updateDisplay();

    // ── 7. Auto-start the next phase if enabled ────────────────────────────
    if (nextState.state === 'running') {
      endTime = nextState.endTime;
      isRunning = true;

      // UI Update
      elements.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
      elements.playPauseIcon.style.transform = 'none';
      document.body.classList.add('focus-mode');
      elements.timerContainer.classList.add('active');

      timerInterval = setInterval(tick, 1000);
    }
  }

  function resetTimer() {
    pauseTimer();
    currentSessionType = 'work';
    sessionsInCycle = 0;
    timeRemaining = getSessionDuration('work') * 60;
    updateDisplay();
    saveTimerState();
  }

  function skipSession() {
    pauseTimer();

    const currentState = {
      type: currentSessionType,
      sessionsInCycle: sessionsInCycle,
      selectedTaskId: selectedTaskId,
      selectedSubtaskId: selectedSubtaskId
    };

    // Use unified storage logic (without recording session)
    const nextState = Storage.completeTimerSession(currentState, false);

    // Sync local state
    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;

    updateSubtaskTracker();
    updateDisplay();
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
    const taskName = task ? task.title : 'General';
    elements.taskDisplay.textContent = taskName.toUpperCase();
    if (elements.activeMissionLabel) {
      elements.activeMissionLabel.textContent = `Focusing on: ${taskName}`;
    }
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
    const availableSubtasks = task.subtasks.filter(s => !s.isCompleted);

    elements.subtaskSelect.innerHTML = '<option value="">SELECT SUB-MISSION</option>' +
      availableSubtasks
        .map(s => `<option value="${s.id}" ${s.id === selectedSubtaskId ? 'selected' : ''}>${App.escapeHtml(s.title)}</option>`).join('');

    // Reset selected subtask if it's no longer available (completed or not in task)
    if (selectedSubtaskId && !availableSubtasks.some(s => s.id === selectedSubtaskId)) {
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
    const uniqueTasksMap = new Map();
    tasks.forEach(t => {
      if (!uniqueTasksMap.has(t.id)) {
        uniqueTasksMap.set(t.id, t);
      }
    });

    const availableTasks = Array.from(uniqueTasksMap.values()).filter(t => !t.completed);
    
    elements.taskSelect.innerHTML = '<option value="">GENERAL FOCUS</option>' +
      availableTasks.map(t => `<option value="${t.id}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');

    // Reset selected task if it's no longer available (completed)
    if (selectedTaskId && !availableTasks.some(t => t.id === selectedTaskId)) {
      selectedTaskId = null;
      elements.taskSelect.value = '';
      elements.taskDisplay.textContent = 'GENERAL';
      if (elements.activeMissionLabel) {
        elements.activeMissionLabel.textContent = 'Focusing on: General';
      }
      populateSubtasks(null);
    }
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

    const settings = Storage.getSettings();
    const totalCycles = settings.sessions_until_long_break || 4;
    const completedCycles = Storage.getTodaySessions().length;
    const currentCycleNum = completedCycles + 1;

    // sessionInCycle: current work session number within cycle (1 to n)
    const sessionInCycle = currentSessionType === 'work' ? sessionsInCycle + 1 : sessionsInCycle;

    const labelMap = { 'work': 'Deep Work', 'short_break': 'Cooldown', 'long_break': 'Deep Rest' };
    elements.timerLabel.textContent = `${labelMap[currentSessionType]} (Session ${sessionInCycle}/${totalCycles} • Cycle ${currentCycleNum})`;

    // Progress Ring
    const totalTime = getSessionDuration(currentSessionType) * 60;
    const offset = CIRCUMFERENCE - (timeRemaining / totalTime * CIRCUMFERENCE);
    elements.timerProgress.style.strokeDashoffset = offset;

    // Cycle dots indicator
    if (elements.cycleIndicator) {
      const cycleLength = settings.sessions_until_long_break || 4;
      const dots = [];
      for (let i = 0; i < cycleLength; i++) {
        const isDone = i < sessionsInCycle;
        const isActive = currentSessionType === 'work' && i === sessionsInCycle;
        dots.push(
          `<span style="
            display:inline-block;
            width:10px;height:10px;border-radius:50%;
            background:${isDone ? 'var(--primary)' : (isActive ? 'var(--primary)' : 'rgba(255,255,255,0.15)')};
            opacity:${isActive ? '0.6' : '1'};
            border:${isActive ? '2px solid var(--primary)' : '2px solid transparent'};
            transition:background 0.3s;
          "></span>`
        );
      }
      elements.cycleIndicator.innerHTML = dots.join('');
    }
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

    // sessionsInCycle: number of completed WORK sessions in current cycle (resets after long_break)
    sessionsInCycle = state.sessionsInCycle ?? state.completedWorkInCycle ?? 0;

    if (elements.taskSelect) {
      elements.taskSelect.value = selectedTaskId || '';
      // We don't call handleTaskChange directly to avoid redundant saveTimerState
      const task = Storage.getTaskById(selectedTaskId);
      const taskName = task ? task.title : 'General';
      if (elements.taskDisplay) {
        elements.taskDisplay.textContent = taskName.toUpperCase();
      }
      if (elements.activeMissionLabel) {
        elements.activeMissionLabel.textContent = `Focusing on: ${taskName}`;
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
