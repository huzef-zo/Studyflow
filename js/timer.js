/**
 * StudyFlow - Pomodoro Timer Module
 * Fully aligned with Stitch design system.
 */

const Timer = (function() {
  'use strict';

  const CIRCUMFERENCE = 640.88; // 2 * Math.PI * 102

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
    } catch (err) {
      wakeLock = null;
    }
    updateWakeLockIndicator();
  }

  async function releaseWakeLock() {
    if (!wakeLock || wakeLock.released) { wakeLock = null; return; }
    try {
      await wakeLock.release();
    } catch (err) {
      // ignore
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
    el.style.color = active ? '#10B981' : '#8A94A6';
  }

  // ── Audio ─────────────────────────────────────────────────────────────────────
  let audioCtx = null;
  let ambientNoise = null;
  let currentAmbientType = null;

  function playTransitionSound(type) {
    const settings = Storage.getSettings ? Storage.getSettings() : { sound: true };
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
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function toggleAmbientSound(type) {
    if (ambientNoise) {
      ambientNoise.stop();
      ambientNoise = null;
      if (currentAmbientType === type || !type) {
        currentAmbientType = null;
        return false;
      }
    }

    if (!type) {
      currentAmbientType = null;
      return false;
    }

    currentAmbientType = type;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      if (type === 'brown') {
        filter.type = 'lowpass';
        filter.frequency.value = 400;
      } else if (type === 'pink') {
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
      }

      const gain = audioCtx.createGain();
      gain.gain.value = 0.1;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      whiteNoise.start();
      ambientNoise = whiteNoise;
      return true;
    } catch (e) {
      currentAmbientType = null;
      return false;
    }
  }

  // ── DOM Elements ─────────────────────────────────────────────────────────────
  let elements = {};

  function initElements() {
    elements = {
      timerContainer: document.getElementById('timer-container'),
      timerDisplay: document.getElementById('timer-digits'),
      timerLabel: document.getElementById('timer-label'),
      timerProgress: document.getElementById('timer-progress'),
      startBtn: document.getElementById('btn-play'),
      playIcon: document.getElementById('play-icon'),
      resetBtn: document.getElementById('btn-reset'),
      skipBtn: document.getElementById('btn-skip'),
      taskSelect: document.getElementById('timer-task'),
      subtaskSelect: document.getElementById('timer-subtask'),
      subtaskContainer: document.getElementById('subtask-select-container'),
      subtaskTracker: document.getElementById('subtask-tracker-container'),
      activeMissionLabel: document.getElementById('active-mission-label'),
      cycleSessionText: document.getElementById('cycle-session-text'),
      cycleIndicator: document.getElementById('cycle-indicator'),
      sessionNotes: document.getElementById('session-notes')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    populateTasks();
    timeRemaining = getSessionDuration('work') * 60;
    loadTimerState();
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
    elements.skipBtn?.addEventListener('click', skipSession);
    elements.taskSelect?.addEventListener('change', handleTaskChange);
    elements.subtaskSelect?.addEventListener('change', handleSubtaskChange);

    window.addEventListener('studyflow_taskDataChanged', () => {
      populateTasks();
    });

    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
      else if (e.code === 'KeyR') { e.preventDefault(); resetTimer(); }
      else if (e.code === 'KeyS') { e.preventDefault(); skipSession(); }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (isRunning) requestWakeLock();
        populateTasks();
        loadTimerState();
        updateDisplay();
      } else {
        releaseWakeLock();
        document.title = 'Focus - StudyFlow';
      }
    });

    window.addEventListener('pagehide', () => {
      releaseWakeLock();
      document.title = 'Focus - StudyFlow';
    });
  }

  function toggleTimer() { isRunning ? pauseTimer() : startTimer(); }

  async function startTimer() {
    if (isRunning) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* ignore */ }

    isRunning = true;
    endTime = Date.now() + (timeRemaining * 1000);

    if (elements.playIcon) {
      elements.playIcon.textContent = 'pause';
      elements.playIcon.style.marginLeft = '0px';
    }
    if (elements.startBtn) {
      elements.startBtn.setAttribute('aria-label', 'Pause Focus');
      elements.startBtn.setAttribute('title', 'Pause Focus');
    }
    document.body.classList.add('focus-mode');
    timerInterval = setInterval(tick, 1000);
    saveTimerState();

    await requestWakeLock();

    if (typeof PWAManager !== 'undefined' && PWAManager.requestNotificationPermission) {
      PWAManager.requestNotificationPermission();
    }
  }

  async function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(timerInterval);

    if (elements.playIcon) {
      elements.playIcon.textContent = 'play_arrow';
      elements.playIcon.style.marginLeft = '2px';
    }
    if (elements.startBtn) {
      elements.startBtn.setAttribute('aria-label', 'Start Focus');
      elements.startBtn.setAttribute('title', 'Start Focus');
    }
    document.body.classList.remove('focus-mode');
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

    const notes = elements.sessionNotes?.value || '';
    const nextState = Storage.completeTimerSession({
      type: currentSessionType, sessionsInCycle, selectedTaskId, selectedSubtaskId
    }, true, notes);

    if (elements.sessionNotes) elements.sessionNotes.value = '';

    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    if (settings.notifications !== false) {
      const labels = { work: 'Deep Work — GO!', short_break: 'Cooldown Time', long_break: 'Deep Rest — Well Earned!' };
      const bodies = { work: 'Focus mode engaged.', short_break: 'Take a short break. You earned it.', long_break: 'Great cycle! Enjoy a longer rest.' };

      if (typeof PWAManager !== 'undefined' && PWAManager.sendNotification) {
        PWAManager.sendNotification(labels[currentSessionType], { body: bodies[currentSessionType] });
      }
    }

    playTransitionSound(currentSessionType);
    updateSubtaskTracker();
    updateDisplay();

    if (nextState.state === 'running') {
      endTime = nextState.endTime;
      isRunning = true;
      if (elements.playIcon) elements.playIcon.textContent = 'pause';
      document.body.classList.add('focus-mode');
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
    const notes = elements.sessionNotes?.value || '';
    const nextState = Storage.completeTimerSession({
      type: currentSessionType, sessionsInCycle, selectedTaskId, selectedSubtaskId
    }, false, notes);

    if (elements.sessionNotes) elements.sessionNotes.value = '';
    currentSessionType = nextState.type;
    sessionsInCycle = nextState.sessionsInCycle;
    timeRemaining = nextState.timeRemaining;
    updateSubtaskTracker();
    updateDisplay();
  }

  function getSessionDuration(type) {
    const settings = Storage.getSettings ? Storage.getSettings() : {};
    if (type === 'work') return settings.work_duration || 25;
    if (type === 'short_break') return settings.short_break || 5;
    return settings.long_break || 15;
  }

  function handleTaskChange() {
    if (!elements.taskSelect) return;
    selectedTaskId = elements.taskSelect.value;
    const task = Storage.getTaskById(selectedTaskId);
    const taskName = task ? task.title : 'General Focus';
    if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = taskName;
    populateSubtasks(selectedTaskId);
    saveTimerState();
  }

  function handleSubtaskChange() {
    if (!elements.subtaskSelect) return;
    selectedSubtaskId = elements.subtaskSelect.value;
    updateSubtaskTracker();
    updateDisplay();
    saveTimerState();
  }

  function populateSubtasks(taskId) {
    if (!elements.subtaskSelect || !elements.subtaskContainer) return;
    const task = Storage.getTaskById(taskId);
    if (!task || !task.subtasks || task.subtasks.length === 0) {
      elements.subtaskContainer.classList.add('hidden');
      elements.subtaskSelect.innerHTML = '<option value="">Select Subtask</option>';
      selectedSubtaskId = null;
      updateSubtaskTracker();
      return;
    }
    elements.subtaskContainer.classList.remove('hidden');
    const available = task.subtasks.filter(s => !s.isCompleted);
    elements.subtaskSelect.innerHTML = '<option value="">Select Subtask</option>' +
      available.map(s => `<option value="${App.escapeHtml(s.id)}" ${s.id === selectedSubtaskId ? 'selected' : ''}>${App.escapeHtml(s.title)}</option>`).join('');

    if (selectedSubtaskId && !available.some(s => s.id === selectedSubtaskId)) {
      selectedSubtaskId = null;
      elements.subtaskSelect.value = '';
    }
    updateSubtaskTracker();
    updateDisplay();
  }

  function updateSubtaskTracker() {
    if (!elements.subtaskTracker) return;
    if (!selectedTaskId || !selectedSubtaskId) {
      elements.subtaskTracker.classList.add('hidden');
      elements.subtaskTracker.classList.remove('flex');
      elements.subtaskTracker.innerHTML = '';
      return;
    }
    const task = Storage.getTaskById(selectedTaskId);
    const subtask = task?.subtasks?.find(s => s.id === selectedSubtaskId);
    if (!subtask) {
      elements.subtaskTracker.classList.add('hidden');
      elements.subtaskTracker.classList.remove('flex');
      elements.subtaskTracker.innerHTML = '';
      return;
    }
    elements.subtaskTracker.classList.remove('hidden');
    elements.subtaskTracker.classList.add('flex');
    const subtaskTitle = App.escapeHtml(subtask.title || 'subtask');
    elements.subtaskTracker.innerHTML = `
      <div class="flex items-center gap-2 text-body-sm text-text-secondary bg-surface-container-high px-3 py-1 rounded-full">
        <button class="px-1 font-bold text-text-muted hover:text-text-primary" id="dec-cycle" aria-label="Decrease session count for ${subtaskTitle}" title="Decrease session count for ${subtaskTitle}">-</button>
        <span>${subtask.completedCycles || 0} session(s)</span>
        <button class="px-1 font-bold text-text-muted hover:text-text-primary" id="inc-cycle" aria-label="Increase session count for ${subtaskTitle}" title="Increase session count for ${subtaskTitle}">+</button>
      </div>
    `;

    document.getElementById('inc-cycle')?.addEventListener('click', () => {
      Storage.updateSubtask(selectedTaskId, selectedSubtaskId, { completedCycles: (subtask.completedCycles || 0) + 1 });
      updateSubtaskTracker();
    });
    document.getElementById('dec-cycle')?.addEventListener('click', () => {
      if ((subtask.completedCycles || 0) > 0) {
        Storage.updateSubtask(selectedTaskId, selectedSubtaskId, { completedCycles: subtask.completedCycles - 1 });
        updateSubtaskTracker();
      }
    });
  }

  function populateTasks() {
    if (!elements.taskSelect) return;
    const tasks = (Storage.getTodayTasks ? Storage.getTodayTasks() : []).concat(Storage.getOverdueTasks ? Storage.getOverdueTasks() : []);
    const map = new Map();
    tasks.forEach(t => { if (!map.has(t.id)) map.set(t.id, t); });
    const available = Array.from(map.values()).filter(t => !t.completed);

    elements.taskSelect.innerHTML = '<option value="">General Focus</option>' +
      available.map(t => `<option value="${App.escapeHtml(t.id)}">${App.escapeHtml(t.subject)}: ${App.escapeHtml(t.title)}</option>`).join('');

    if (selectedTaskId && !available.some(t => t.id === selectedTaskId)) {
      selectedTaskId = null;
      elements.taskSelect.value = '';
      if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = 'General Focus';
      populateSubtasks(null);
    }
  }

  function updateDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (elements.timerDisplay) elements.timerDisplay.textContent = timeStr;
    if (document.visibilityState === 'visible') document.title = `${timeStr} - Focus`;

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const totalCycles = settings.sessions_until_long_break || 4;
    const sessionInCycle = currentSessionType === 'work' ? sessionsInCycle + 1 : sessionsInCycle;
    const labelMap = { work: 'Deep Work', short_break: 'Cooldown', long_break: 'Deep Rest' };

    if (elements.timerLabel) elements.timerLabel.textContent = labelMap[currentSessionType] || 'Deep Work';
    if (elements.cycleSessionText) elements.cycleSessionText.textContent = `Session ${sessionInCycle} of ${totalCycles}`;

    const totalTime = getSessionDuration(currentSessionType) * 60;
    const progress = totalTime > 0 ? timeRemaining / totalTime : 0;
    const offset = CIRCUMFERENCE * (1 - progress);

    if (elements.timerProgress) {
      elements.timerProgress.style.strokeDashoffset = offset;
    }

    if (elements.cycleIndicator) {
      elements.cycleIndicator.innerHTML = Array.from({ length: totalCycles }, (_, i) => {
        const isDone = i < sessionsInCycle;
        const isActive = currentSessionType === 'work' && i === sessionsInCycle;
        if (isDone) {
          return `<span class="w-3.5 h-3.5 rounded-full bg-primary-container shadow-[0_0_12px_rgba(91,155,240,0.85)] flex items-center justify-center"><span class="w-1.5 h-1.5 rounded-full bg-surface-base"></span></span>`;
        }
        if (isActive) {
          return `<span class="w-3.5 h-3.5 rounded-full border-2 border-primary-container bg-primary-container/20 animate-pulse"></span>`;
        }
        return `<span class="w-2.5 h-2.5 rounded-full bg-surface-container-highest/80"></span>`;
      }).join('');
    }
  }

  function saveTimerState() {
    if (Storage.saveTimerState) {
      Storage.saveTimerState({
        type: currentSessionType,
        endTime: isRunning ? endTime : null,
        state: isRunning ? 'running' : 'paused',
        timeRemaining, selectedTaskId, selectedSubtaskId, sessionsInCycle
      });
    }
  }

  function loadTimerState() {
    const state = Storage.getTimerState ? Storage.getTimerState() : null;
    const urlParams = new URLSearchParams(window.location.search);
    const urlTaskId = urlParams.get('taskId');

    if (!state) {
      if (urlTaskId) {
        selectedTaskId = urlTaskId;
        handleTaskChange();
      }
      return;
    }

    currentSessionType = state.type || 'work';
    selectedTaskId = state.selectedTaskId;
    selectedSubtaskId = state.selectedSubtaskId;
    sessionsInCycle = state.sessionsInCycle ?? 0;

    if (elements.taskSelect) {
      elements.taskSelect.value = selectedTaskId || '';
      const task = Storage.getTaskById(selectedTaskId);
      const taskName = task ? task.title : 'General Focus';
      if (elements.activeMissionLabel) elements.activeMissionLabel.textContent = taskName;
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
      if (urlTaskId && urlTaskId !== selectedTaskId) {
        selectedTaskId = urlTaskId;
        handleTaskChange();
      }
    }
  }

  return { init, toggleAmbientSound };
})();

window.Timer = Timer;
