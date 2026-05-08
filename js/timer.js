/**
 * StudyFlow - Pomodoro Timer Module
 * ADDED: Screen Wake Lock — keeps the display on while the timer is running.
 *        Automatically released when the timer is paused, reset, or the page
 *        is hidden. Re-acquired when the page becomes visible again if the
 *        timer is still running (handles phone lock/unlock mid-session).
 *
 * Browser support: Chrome 84+, Edge 84+, Safari 16.4+, Firefox (flag only).
 * Falls back silently on unsupported browsers — timer still works normally.
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

  // ── Wake Lock ────────────────────────────────────────────────────────────────
  let wakeLock = null;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock && !wakeLock.released) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; updateWakeLockIndicator(); });
      console.log('[WakeLock] Screen lock acquired');
    } catch (err) {
      console.warn('[WakeLock] Could not acquire:', err.message);
      wakeLock = null;
    }
    updateWakeLockIndicator();
  }

  async function releaseWakeLock() {
    if (!wakeLock || wakeLock.released) { wakeLock = null; return; }
    try {
      await wakeLock.release();
      console.log('[WakeLock] Screen lock released');
    } catch (err) {
      console.warn('[WakeLock] Error releasing:', err.message);
    } finally {
      wakeLock = null;
      updateWakeLockIndicator();
    }
  }

  function updateWakeLockIndicator() {
    const el = document.getElementById('wake-lock-indicator');
    if (!el) return;
    if (!('wakeLock' in navigator)) {
      el.textContent = 'Screen lock not supported';
      el.style.opacity = '0.4';
      return;
    }
    const active = !!(wakeLock && !wakeLock.released);
    el.textContent = active ? '⬤ Screen on' : '⬤ Screen auto-off';
    el.style.color = active ? 'var(--success)' : 'var(--text-muted)';
    el.style.opacity = active ? '1' : '0.5';
  }

  // ── Audio ─────────────────────────────────────────────────────────────────────
  let audioCtx = null;

  function playTransitionSound(type) {
    const settings = Storage.getSettings();
    if (settings.sound === false) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      if (type === 'work') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.6, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      } else if (type === 'short_break') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      } else if (type === 'long_break') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 1.5);
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(110, now); osc2.frequency.linearRampToValueAtTime(55, now + 1.5);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.6, now + 0.5); gain.gain.linearRampToValueAtTime(0, now + 1.5);
        gain2.gain.setValueAtTime(0, now); gain2.gain.linearRampToValueAtTime(0.2, now + 0.5); gain2.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.start(now); osc.stop(now + 1.5); osc2.start(now); osc2.stop(now + 1.5);
      }
    } catch (e) { console.error('Audio feedback failed:', e); }
  }

  // ── DOM ───────────────────────────────────────────────────────────────────────
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
    updateWakeLockIndicator();
  }

  function setupEventListeners() {
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

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
      else if (e.code === 'KeyR') { e.preventDefault(); resetTimer(); }
      else if (e.code === 'KeyS') { e.preventDefault(); skipSession(); }
    });

    // Visibility change: re-acquire wake lock when returning to the page
    // (OS releases the lock whenever the page is hidden — tab switch, phone lock, etc.)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (isRunning) requestWakeLock();   // re-acquire if still running
        loadTimerState();
        updateDisplay();
        updateStats();
      } else {
        releaseWakeLock();                  // explicit release on hide
        document.title = 'Timer - StudyFlow';
      }
    });

    window.addEventListener('pagehide', () => {
      releaseWakeLock();
      document.title = 'Timer - StudyFlow';
    });
  }

  // ── Timer controls ────────────────────────────────────────────────────────────

  function toggleTimer() { isRunning ? pauseTimer() : startTimer(); }

  async function startTimer() {
    if (isRunning) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { console.error('Failed to init AudioContext:', e); }

    isRunning = true;
    endTime = Date.now() + (timeRemaining * 1000);

    elements.playPauseIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    elements.playPauseIcon.style.transform = 'none';
    document.body.classList.add('focus-mode');
    elements.timerContainer.classList.add('active');
    timerInterval = setInterval(tick, 1000);
    saveTimerState();

    // Must be called after user gesture for the API to allow it
    await requestWakeLock();

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  async function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);

    elements.playPauseIcon.innerHTML = `<polygon points="6 3 20 12 6 21 6 3"/>`;
    elements.playPauseIcon.style.transform = 'translateX(2px)';
    document.body.classList.remove('focus-mode');
    elements.timerContainer.classList.remove('active');
    saveTimerState();

    await releaseWakeLock();
  }

  function tick() {
    timeRemaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (timeRemaining <= 0) { completeSession(); return; }
    updateDisplay();
    if (timeRemaining % 5 === 0) saveTimerState();
  }

  async function completeSession() {
    await releaseWakeLock();
    pauseTimer();

    const nextState = Storage.completeTimerSession({
      type: currentSessionType, sessionsInCycle, selectedTaskId, selectedSubtaskId
    }, true);

    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;

    const settings = Storage.getSettings();
    if (settings.notifications !== false && 'Notification' in window && Notification.permission === 'granted') {
      const labels = { work: 'Deep Work — GO!', short_break: 'Cooldown Time', long_break: 'Deep Rest — Well Earned!' };
      const bodies = { work: 'Focus mode engaged.', short_break: 'Take a short break. You earned it.', long_break: 'Great cycle! Enjoy a longer rest.' };
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
      await requestWakeLock();
    }
  }

  async function resetTimer() {
    await pauseTimer();
    currentSessionType = 'work';
    sessionsInCycle = 0;
    timeRemaining = getSessionDuration('work') * 60;
    updateDisplay();
    saveTimerState();
  }

  function skipSession() {
    pauseTimer();
    const nextState = Storage.completeTimerSession({
      type: currentSessionType, sessionsInCycle, selectedTaskId, selectedSubtaskId
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
      updateSubtaskTracker(); return;
    }
    elements.subtaskContainer.style.display = 'block';
    const available = task.subtasks.filter(s => !s.isCompleted);
    elements.subtaskSelect.innerHTML = '<option value="">SELECT SUB-MISSION</option>' +
      available.map(s => `<option value="${App.escapeHtml(s.id)}" ${s.id === selectedSubtaskId ? 'selected' : ''}>${App.escapeHtml(s.title)}</option>`).join('');
    if (selectedSubtaskId && !available.some(s => s.id === selectedSubtaskId)) {
      selectedSubtaskId = null; elements.subtaskSelect.value = '';
    }
    updateSubtaskTracker(); updateDisplay();
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
      </div>`;
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
    const map = new Map();
    tasks.forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
    const available = Array.from(map.values()).filter(t => !t.completed);
    elements.taskSelect.innerHTML = '<option value="">GENERAL FOCUS</option>' +
      available.map(t => `<option value="${App.escapeHtml(t.id)}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');
    if (selectedTaskId && !available.some(t => t.id === selectedTaskId)) {
      selectedTaskId = null; elements.taskSelect.value = '';
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
    const timeStr = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    elements.timerDisplay.textContent = timeStr;
    if (document.visibilityState === 'visible') document.title = `${timeStr} - StudyFlow`;

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
        return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isDone?'var(--primary)':(isActive?'var(--primary)':'rgba(255,255,255,0.15)')};opacity:${isActive?'0.6':'1'};border:${isActive?'2px solid var(--primary)':'2px solid transparent'};transition:background 0.3s;"></span>`;
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
      timeRemaining, selectedTaskId, selectedSubtaskId, sessionsInCycle
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
