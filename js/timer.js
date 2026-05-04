/**
 * StudyFlow - Pomodoro Timer Module
 * FIXES:
 * 1. Keyboard shortcuts: Space = start/pause, R = reset, S = skip (was documented, never coded)
 * 2. document.title reset on pagehide/visibilitychange so the countdown doesn't
 *    persist as the tab title when the user navigates away.
 */

const Timer = (function() {
  'use strict';

  const CIRCUMFERENCE = 2 * Math.PI * 140;

  let timerInterval = null;
  let timeRemaining = 1500;
  let currentSessionType = 'work';
  let isRunning = false;
  let endTime = null;
  let selectedTaskId = null;
  let selectedSubtaskId = null;
  let sessionsInCycle = 0;

  let audioCtx = null;

  function playTransitionSound(type) {
    const settings = Storage.getSettings();
    if (settings.sound === false) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      if (type === 'work') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now); oscillator.stop(now + 0.5);
      } else if (type === 'short_break') {
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.5);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        oscillator.start(now); oscillator.stop(now + 0.5);
      } else if (type === 'long_break') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, now);
        oscillator.frequency.linearRampToValueAtTime(110, now + 1.5);
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(110, now);
        osc2.frequency.linearRampToValueAtTime(55, now + 1.5);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.6, now + 0.5);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.5);
        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.2, now + 0.5);
        gain2.gain.linearRampToValueAtTime(0, now + 1.5);
        oscillator.start(now); oscillator.stop(now + 1.5);
        osc2.start(now); osc2.stop(now + 1.5);
      }
    } catch (e) { console.error('Audio feedback failed:', e); }
  }

  let elements = {};

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

  function init() {
    initElements();
    setupEventListeners();
    populateTasks();
    timeRemaining = getSessionDuration('work') * 60;
    loadTimerState();
    updateStats();
    updateDisplay();
  }

  function setupEventListeners() {
    // Unlock AudioContext on first interaction
    const unlockAudio = () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    elements.startBtn?.addEventListener('click', toggleTimer);
    elements.resetBtn?.addEventListener('click', resetTimer);
    elements.taskSelect?.addEventListener('change', handleTaskChange);
    elements.subtaskSelect?.addEventListener('change', handleSubtaskChange);

    // FIX: Keyboard shortcuts — Space, R, S (documented in README but never implemented)
    document.addEventListener('keydown', (e) => {
      // Don't fire when user is typing in an input/select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleTimer();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        resetTimer();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        skipSession();
      }
    });

    // FIX: Reset document.title when leaving the timer page
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Restore page title so other tabs don't show the countdown
        document.title = 'Timer - StudyFlow';
      } else {
        // Back on the page — sync state from storage (in case timer ran in background)
        loadTimerState();
        updateDisplay();
        updateStats();
      }
    });

    // Also reset on actual page navigation
    window.addEventListener('pagehide', () => {
      document.title = 'Timer - StudyFlow';
    });
  }

  function toggleTimer() { isRunning ? pauseTimer() : startTimer(); }

  function startTimer() {
    if (isRunning) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { console.error('Failed to initialize AudioContext:', e); }

    isRunning = true;
    endTime = Date.now() + (timeRemaining * 1000);
    elements.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    elements.playPauseIcon.style.transform = 'none';
    document.body.classList.add('focus-mode');
    elements.timerContainer.classList.add('active');
    timerInterval = setInterval(tick, 1000);
    saveTimerState();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);
    elements.playPauseIcon.innerHTML = `<polygon points="6 3 20 12 6 21 6 3"/>`;
    elements.playPauseIcon.style.transform = 'translateX(2px)';
    document.body.classList.remove('focus-mode');
    elements.timerContainer.classList.remove('active');
    saveTimerState();
  }

  function tick() {
    timeRemaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (timeRemaining <= 0) { completeSession(); return; }
    updateDisplay();
    if (timeRemaining % 5 === 0) saveTimerState();
  }

  function completeSession() {
    pauseTimer();
    const nextState = Storage.completeTimerSession({
      type: currentSessionType,
      sessionsInCycle,
      selectedTaskId,
      selectedSubtaskId
    }, true);

    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;

    const settings = Storage.getSettings();
    if (settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
      const labels = { work: 'Deep Work — GO!', short_break: 'Cooldown Time', long_break: 'Deep Rest — Well Earned!' };
      const bodies = { work: 'Focus mode engaged. Start your deep work block.', short_break: 'Take a short break. You earned it.', long_break: 'Great cycle! Enjoy a longer rest.' };
      new Notification(labels[currentSessionType], { body: bodies[currentSessionType] });
    }

    playTransitionSound(currentSessionType);
    updateSubtaskTracker();
    updateStats();
    updateDisplay();

    if (nextState.state === 'running') {
      endTime = nextState.endTime;
      isRunning = true;
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
    const nextState = Storage.completeTimerSession({
      type: currentSessionType,
      sessionsInCycle,
      selectedTaskId,
      selectedSubtaskId
    }, false);
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
    if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = `Focusing on: ${taskName}`;
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
      availableSubtasks.map(s => `<option value="${s.id}" ${s.id === selectedSubtaskId ? 'selected' : ''}>${App.escapeHtml(s.title)}</option>`).join('');
    if (selectedSubtaskId && !availableSubtasks.some(s => s.id === selectedSubtaskId)) {
      selectedSubtaskId = null;
      elements.subtaskSelect.value = '';
    }
    updateSubtaskTracker();
    updateDisplay();
  }

  function updateSubtaskTracker() {
    if (!elements.subtaskTracker) return;
    if (!selectedTaskId || !selectedSubtaskId) { elements.subtaskTracker.innerHTML = ''; return; }
    const task = Storage.getTaskById(selectedTaskId);
    const subtask = task?.subtasks?.find(s => s.id === selectedSubtaskId);
    if (!subtask) { elements.subtaskTracker.innerHTML = ''; return; }
    elements.subtaskTracker.innerHTML = `
      <div class="subtask-cycle-tracker">
        <button class="cycle-btn" id="dec-cycle">-</button>
        <span>${subtask.completedCycles}/${subtask.estimatedCycles} Cycles</span>
        <button class="cycle-btn" id="inc-cycle">+</button>
      </div>
    `;
    document.getElementById('inc-cycle')?.addEventListener('click', () => {
      Storage.updateSubtask(selectedTaskId, selectedSubtaskId, { completedCycles: (subtask.completedCycles || 0) + 1 });
      updateSubtaskTracker();
    });
    document.getElementById('dec-cycle')?.addEventListener('click', () => {
      if (subtask.completedCycles > 0) {
        Storage.updateSubtask(selectedTaskId, selectedSubtaskId, { completedCycles: subtask.completedCycles - 1 });
        updateSubtaskTracker();
      }
    });
  }

  function populateTasks() {
    const tasks = Storage.getTodayTasks().concat(Storage.getOverdueTasks());
    const uniqueTasksMap = new Map();
    tasks.forEach(t => { if (!uniqueTasksMap.has(t.id)) uniqueTasksMap.set(t.id, t); });
    const availableTasks = Array.from(uniqueTasksMap.values()).filter(t => !t.completed);
    elements.taskSelect.innerHTML = '<option value="">GENERAL FOCUS</option>' +
      availableTasks.map(t => `<option value="${t.id}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');
    if (selectedTaskId && !availableTasks.some(t => t.id === selectedTaskId)) {
      selectedTaskId = null;
      elements.taskSelect.value = '';
      elements.taskDisplay.textContent = 'GENERAL';
      if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = 'Focusing on: General';
      populateSubtasks(null);
    }
  }

  function updateDisplay() {
    if (elements.subtaskTracker) {
      elements.subtaskTracker.style.display = (currentSessionType === 'work' && selectedSubtaskId) ? 'flex' : 'none';
    }
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    elements.timerDisplay.textContent = timeStr;
    // FIX: Only update document.title if the page is visible — avoids stale tab titles
    if (document.visibilityState === 'visible') {
      document.title = `${timeStr} - StudyFlow`;
    }

    const settings = Storage.getSettings();
    const totalCycles = settings.sessions_until_long_break || 4;
    const completedCycles = Storage.getTodaySessions().length;
    const sessionInCycle = currentSessionType === 'work' ? sessionsInCycle + 1 : sessionsInCycle;
    const labelMap = { work: 'Deep Work', short_break: 'Cooldown', long_break: 'Deep Rest' };
    elements.timerLabel.textContent = `${labelMap[currentSessionType]} (Session ${sessionInCycle}/${totalCycles} • Cycle ${completedCycles + 1})`;

    const totalTime = getSessionDuration(currentSessionType) * 60;
    elements.timerProgress.style.strokeDashoffset = CIRCUMFERENCE - (timeRemaining / totalTime * CIRCUMFERENCE);

    if (elements.cycleIndicator) {
      const cycleLength = settings.sessions_until_long_break || 4;
      elements.cycleIndicator.innerHTML = Array.from({ length: cycleLength }, (_, i) => {
        const isDone = i < sessionsInCycle;
        const isActive = currentSessionType === 'work' && i === sessionsInCycle;
        return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isDone ? 'var(--primary)' : (isActive ? 'var(--primary)' : 'rgba(255,255,255,0.15)')};opacity:${isActive ? '0.6' : '1'};border:${isActive ? '2px solid var(--primary)' : '2px solid transparent'};transition:background 0.3s;"></span>`;
      }).join('');
    }
  }

  function updateStats() {
    const stats = Storage.getStats();
    elements.sessionsToday.textContent = stats.sessions.today;
    elements.totalTimeToday.textContent = `${stats.sessions.minutesToday}m`;
    elements.streakCount.textContent = stats.streak;
  }

  function saveTimerState() {
    Storage.saveTimerState({
      type: currentSessionType,
      endTime: isRunning ? endTime : null,
      state: isRunning ? 'running' : 'paused',
      timeRemaining,
      selectedTaskId,
      selectedSubtaskId,
      sessionsInCycle
    });
  }

  function loadTimerState() {
    const state = Storage.getTimerState();
    if (!state) return;
    currentSessionType = state.type || 'work';
    selectedTaskId = state.selectedTaskId;
    selectedSubtaskId = state.selectedSubtaskId;
    sessionsInCycle = state.sessionsInCycle ?? 0;
    if (elements.taskSelect) {
      elements.taskSelect.value = selectedTaskId || '';
      const task = Storage.getTaskById(selectedTaskId);
      const taskName = task ? task.title : 'General';
      if (elements.taskDisplay) elements.taskDisplay.textContent = taskName.toUpperCase();
      if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = `Focusing on: ${taskName}`;
      populateSubtasks(selectedTaskId);
      if (elements.subtaskSelect) elements.subtaskSelect.value = selectedSubtaskId || '';
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
