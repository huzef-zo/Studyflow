/**
 * StudyFlow - Recorder Module
 * Handles microphone recording with high quality constraints, Web Audio gain boost,
 * live input level metering, chunking, wake lock, IndexedDB sync, and partial recovery.
 */

const Recorder = (function() {
  'use strict';

  const MAX_RECORDING_SECONDS = 3 * 3600; // Default 3 hours
  const FLUSH_INTERVAL_MS = 30000; // 30 seconds
  const ORPHAN_KEY = 'studyflow_orphaned_recording';

  // State variables
  let rawStream = null;
  let activeStream = null; // Stream being recorded (destination stream if boost enabled, else rawStream)
  let audioCtx = null;
  let sourceNode = null;
  let gainNode = null;
  let compressorNode = null;
  let destinationNode = null;
  let analyserNode = null;

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingState = 'idle'; // 'idle', 'recording', 'paused', 'testing'
  let startTimeMs = 0;
  let elapsedSeconds = 0;
  let timerInterval = null;
  let flushInterval = null;
  let testTimerTimeout = null;

  let currentMimeType = '';
  let currentBitrate = 0;
  let wakeLock = null;
  let recordingId = null;
  let currentSubject = 'General';
  let currentTitle = '';

  // Meter & ARIA live state
  let meterAnimFrame = null;
  let lastLiveAnnounceTime = 0;
  let lastLevelCategory = ''; // 'low', 'good', 'loud'

  // ── Pure Logic Helpers ───────────────────────────────────────────────────────

  function buildAudioConstraints(options = {}) {
    const denoise = Boolean(options.denoise);
    return {
      audio: {
        echoCancellation: false,
        noiseSuppression: denoise,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000
      }
    };
  }

  function pickSupportedMimeType(customSupportedCheck) {
    const isSupported = customSupportedCheck || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : () => false);
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];
    for (const type of types) {
      if (isSupported(type)) {
        return type;
      }
    }
    return '';
  }

  function buildRecorderOptions(supportedTypes) {
    let selectedMime = '';
    if (Array.isArray(supportedTypes)) {
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      selectedMime = preferred.find(t => supportedTypes.includes(t)) || supportedTypes[0] || '';
    } else if (typeof supportedTypes === 'function') {
      selectedMime = pickSupportedMimeType(supportedTypes);
    } else {
      selectedMime = pickSupportedMimeType();
    }

    return {
      mimeType: selectedMime,
      audioBitsPerSecond: 128000
    };
  }

  function formatTime(totalSecs) {
    const safeSecs = Number.isFinite(Number(totalSecs)) && Number(totalSecs) >= 0 ? Math.floor(Number(totalSecs)) : 0;
    const hours = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ── Stream Getter with Fallback ──────────────────────────────────────────────

  async function getMicStream(constraints) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported on this device.');
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      if (err.name === 'OverconstrainedError') {
        console.warn('OverconstrainedError encountered, retrying getUserMedia with { audio: true }...');
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      throw err;
    }
  }

  // ── Wake Lock ──────────────────────────────────────────────────────────────

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (wakeLock && !wakeLock.released) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      wakeLock = null;
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock || wakeLock.released) { wakeLock = null; return; }
    try {
      await wakeLock.release();
    } catch (e) {
      // ignore
    } finally {
      wakeLock = null;
    }
  }

  function stopAllStreamTracks() {
    if (rawStream) {
      rawStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      rawStream = null;
    }
    if (activeStream && activeStream !== rawStream) {
      activeStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
    }
    activeStream = null;
  }

  function cleanupAudioNodes() {
    if (meterAnimFrame) {
      cancelAnimationFrame(meterAnimFrame);
      meterAnimFrame = null;
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (e) {}
      sourceNode = null;
    }
    if (gainNode) {
      try { gainNode.disconnect(); } catch (e) {}
      gainNode = null;
    }
    if (compressorNode) {
      try { compressorNode.disconnect(); } catch (e) {}
      compressorNode = null;
    }
    if (analyserNode) {
      try { analyserNode.disconnect(); } catch (e) {}
      analyserNode = null;
    }
    if (destinationNode) {
      try { destinationNode.disconnect(); } catch (e) {}
      destinationNode = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
    }
  }

  // ── Level Meter Animation & ARIA Announcements ──────────────────────────────

  function startMeterLoop() {
    if (!analyserNode) return;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

    function updateMeter() {
      if (document.hidden) {
        meterAnimFrame = requestAnimationFrame(updateMeter);
        return;
      }

      analyserNode.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const levelPercent = Math.min(100, Math.round(rms * 300)); // Scale to 0-100%

      const meterEl = document.getElementById('rec-level-meter');
      const barEl = document.getElementById('rec-level-bar');

      if (meterEl) {
        meterEl.setAttribute('aria-valuenow', String(levelPercent));
      }
      if (barEl) {
        barEl.style.width = `${levelPercent}%`;
        if (levelPercent > 75) {
          barEl.style.backgroundColor = 'var(--color-error, #EF4444)';
        } else if (levelPercent < 15) {
          barEl.style.backgroundColor = 'var(--color-tertiary, #EAB308)';
        } else {
          barEl.style.backgroundColor = 'var(--color-primary, #5B9BF0)';
        }
      }

      // ARIA live announcements (throttled to at most once every 3s on state change)
      let currentCategory = 'good';
      if (levelPercent < 15) currentCategory = 'low';
      else if (levelPercent > 75) currentCategory = 'loud';

      const now = Date.now();
      if (currentCategory !== lastLevelCategory && (now - lastLiveAnnounceTime >= 3000)) {
        lastLevelCategory = currentCategory;
        lastLiveAnnounceTime = now;
        let announcement = 'Input level good';
        if (currentCategory === 'low') announcement = 'Input level low';
        if (currentCategory === 'loud') announcement = 'Input level too loud';
        announceAccessibilityState(announcement);
      }

      meterAnimFrame = requestAnimationFrame(updateMeter);
    }

    if (meterAnimFrame) cancelAnimationFrame(meterAnimFrame);
    meterAnimFrame = requestAnimationFrame(updateMeter);
  }

  // ── Web Audio Processing Setup ──────────────────────────────────────────────

  async function setupAudioPipeline(stream, boostLevel) {
    rawStream = stream;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      sourceNode = audioCtx.createMediaStreamSource(rawStream);
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256;

      if (boostLevel && boostLevel !== 'off') {
        const gainValue = boostLevel === 'high' ? 3.5 : (boostLevel === 'medium' ? 2 : 1);
        gainNode = audioCtx.createGain();
        gainNode.gain.value = gainValue;

        compressorNode = audioCtx.createDynamicsCompressor();
        compressorNode.threshold.value = -12;
        compressorNode.knee.value = 12;
        compressorNode.ratio.value = 6;
        compressorNode.attack.value = 0.003;
        compressorNode.release.value = 0.25;

        destinationNode = audioCtx.createMediaStreamDestination();

        sourceNode.connect(gainNode);
        gainNode.connect(compressorNode);
        compressorNode.connect(analyserNode);
        compressorNode.connect(destinationNode);

        activeStream = destinationNode.stream;
      } else {
        sourceNode.connect(analyserNode);
        activeStream = rawStream;
      }

      startMeterLoop();
    } else {
      activeStream = rawStream;
    }
  }

  // ── Diagnostics Display ──────────────────────────────────────────────────────

  function logAndDisplayDiagnostics(stream) {
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    if (!tracks || tracks.length === 0) return;

    const track = tracks[0];
    const settings = track.getSettings ? track.getSettings() : {};
    console.log('Applied mic settings:', settings);

    const channels = settings.channelCount === 1 ? 'mono' : (settings.channelCount ? `${settings.channelCount} channels` : 'mono');
    const sampleRate = settings.sampleRate ? `${Math.round(settings.sampleRate / 1000)} kHz` : '48 kHz';
    const bitrateKbps = currentBitrate ? `${Math.round(currentBitrate / 1000)} kbps` : '128 kbps';

    const diagLine = document.getElementById('rec-diagnostics-line');
    if (diagLine) {
      diagLine.textContent = `Recording: ${channels}, ${sampleRate}, ${bitrateKbps}`;
    }

    const overrideNotice = document.getElementById('rec-override-notice');
    if (overrideNotice) {
      const ignoredConstraints = settings.echoCancellation === true || settings.autoGainControl === true;
      if (ignoredConstraints) {
        overrideNotice.classList.remove('hidden');
        overrideNotice.textContent = 'Your browser applied its own audio processing.';
      } else {
        overrideNotice.classList.add('hidden');
      }
    }
  }

  // ── Recovery & Partial Flush ───────────────────────────────────────────────

  async function checkOrphanedRecording() {
    try {
      const rawOrphan = localStorage.getItem(ORPHAN_KEY);
      if (!rawOrphan) return;

      const orphan = JSON.parse(rawOrphan);
      if (!orphan || !orphan.id) {
        localStorage.removeItem(ORPHAN_KEY);
        return;
      }

      if (typeof AudioDB === 'undefined') return;

      const blob = await AudioDB.getBlob(orphan.id);
      if (blob && blob.size > 0) {
        if (typeof App !== 'undefined' && App.confirm) {
          const recover = await App.confirm({
            title: 'Unsaved Recording Found',
            message: `An interrupted recording from ${new Date(orphan.createdAt).toLocaleString()} (${formatTime(orphan.duration || 0)}) was found. Would you like to save it?`,
            confirmText: 'Recover Recording',
            cancelText: 'Discard'
          });

          if (recover) {
            Storage.addRecording({
              id: orphan.id,
              title: orphan.title || `Recovered Lecture – ${new Date(orphan.createdAt).toLocaleDateString()}`,
              subject: orphan.subject || 'General',
              duration: orphan.duration || 0,
              size: blob.size,
              bitrate: orphan.bitrate || 128000,
              mimeType: orphan.mimeType || blob.type || 'audio/webm',
              createdAt: orphan.createdAt || new Date().toISOString()
            });
            if (App.showToast) App.showToast('Recording recovered successfully!', 'success');
            window.dispatchEvent(new CustomEvent('studyflow_recordings_updated'));
          } else {
            await AudioDB.deleteBlob(orphan.id);
          }
        }
      }
      localStorage.removeItem(ORPHAN_KEY);
    } catch (err) {
      console.error('Failed to check orphaned recording:', err);
      localStorage.removeItem(ORPHAN_KEY);
    }
  }

  async function flushPartialRecording() {
    if (recordingState === 'idle' || !recordingId || recordedChunks.length === 0) return;
    if (typeof AudioDB === 'undefined') return;

    try {
      const partialBlob = new Blob(recordedChunks, { type: currentMimeType || 'audio/webm' });
      await AudioDB.saveBlob(recordingId, partialBlob);

      const orphanMeta = {
        id: recordingId,
        title: currentTitle || 'Partial Lecture',
        subject: currentSubject,
        duration: elapsedSeconds,
        bitrate: currentBitrate,
        mimeType: currentMimeType,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ORPHAN_KEY, JSON.stringify(orphanMeta));
    } catch (err) {
      console.error('Failed to flush partial recording:', err);
    }
  }

  // ── Recording Actions ────────────────────────────────────────────────────────

  async function startRecording() {
    if (recordingState !== 'idle') return;

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const denoise = settings.recorder_denoise || false;
    const boostLevel = settings.recorder_boost || 'off';

    const reqOptions = buildRecorderOptions();
    currentMimeType = reqOptions.mimeType;
    currentBitrate = reqOptions.audioBitsPerSecond;

    if (!currentMimeType && typeof MediaRecorder !== 'undefined') {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('No supported audio recording format found on this browser.', 'error');
      return;
    }

    try {
      const constraints = buildAudioConstraints({ denoise });
      const stream = await getMicStream(constraints);
      await setupAudioPipeline(stream, boostLevel);
      logAndDisplayDiagnostics(rawStream);
    } catch (err) {
      console.error('Microphone error:', err);
      let msg = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone was found on this device.';
      }
      if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, 'error');
      cleanupAudioNodes();
      stopAllStreamTracks();
      return;
    }

    try {
      recordedChunks = [];
      recordingId = Storage.generateId ? Storage.generateId() : 'rec_' + Date.now();

      let recOpts = { mimeType: currentMimeType, audioBitsPerSecond: currentBitrate };
      try {
        mediaRecorder = new MediaRecorder(activeStream, recOpts);
      } catch (e1) {
        console.warn('MediaRecorder rejected audioBitsPerSecond, retrying without bitrate option:', e1);
        currentBitrate = 0;
        recOpts = currentMimeType ? { mimeType: currentMimeType } : {};
        mediaRecorder = new MediaRecorder(activeStream, recOpts);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        if (typeof App !== 'undefined' && App.showToast) App.showToast('Recording error occurred.', 'error');
      };

      mediaRecorder.start(1000);
      recordingState = 'recording';
      elapsedSeconds = 0;
      startTimeMs = Date.now();

      const titleInput = document.getElementById('rec-title-input');
      const subjectSelect = document.getElementById('rec-subject-select');
      currentTitle = titleInput ? titleInput.value.trim() : '';
      currentSubject = subjectSelect ? subjectSelect.value : 'General';

      await acquireWakeLock();

      timerInterval = setInterval(() => {
        if (recordingState === 'recording') {
          elapsedSeconds++;
          updateTimerUI();

          if (elapsedSeconds % 15 === 0) {
            announceAccessibilityState(`Recording in progress: ${formatTime(elapsedSeconds)} elapsed`);
          }

          if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
            if (typeof App !== 'undefined' && App.showToast) App.showToast('Maximum recording length (3 hours) reached. Saving recording...', 'info');
            stopRecording();
          }
        }
      }, 1000);

      flushInterval = setInterval(flushPartialRecording, FLUSH_INTERVAL_MS);

      updateControlsUI();
      announceAccessibilityState('Recording started');

    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      if (typeof App !== 'undefined' && App.showToast) App.showToast('Failed to start audio recording.', 'error');
      cleanupAudioNodes();
      stopAllStreamTracks();
      recordingState = 'idle';
      updateControlsUI();
    }
  }

  function pauseRecording() {
    if (recordingState !== 'recording' || !mediaRecorder) return;

    try {
      mediaRecorder.pause();
      recordingState = 'paused';
      releaseWakeLock();
      flushPartialRecording();
      updateControlsUI();
      announceAccessibilityState('Recording paused');
    } catch (err) {
      console.error('Failed to pause recording:', err);
    }
  }

  function resumeRecording() {
    if (recordingState !== 'paused' || !mediaRecorder) return;

    try {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      mediaRecorder.resume();
      recordingState = 'recording';
      acquireWakeLock();
      updateControlsUI();
      announceAccessibilityState('Recording resumed');
    } catch (err) {
      console.error('Failed to resume recording:', err);
    }
  }

  async function stopRecording() {
    if (recordingState === 'idle') return;

    if (recordingState === 'testing') {
      stopMicTest();
      return;
    }

    clearInterval(timerInterval);
    clearInterval(flushInterval);
    timerInterval = null;
    flushInterval = null;

    await releaseWakeLock();

    return new Promise((resolve) => {
      if (!mediaRecorder) {
        cleanupAndReset();
        return resolve(null);
      }

      mediaRecorder.onstop = async () => {
        try {
          cleanupAudioNodes();
          stopAllStreamTracks();

          const finalBlob = new Blob(recordedChunks, { type: currentMimeType || 'audio/webm' });

          if (finalBlob.size === 0) {
            if (typeof App !== 'undefined' && App.showToast) App.showToast('Recording was empty and could not be saved.', 'warning');
            cleanupAndReset();
            return resolve(null);
          }

          if (typeof AudioDB !== 'undefined') {
            try {
              await AudioDB.saveBlob(recordingId, finalBlob);
            } catch (idbErr) {
              console.error('IndexedDB save failed:', idbErr);
              let msg = 'Failed to save audio file to local storage.';
              if (idbErr && idbErr.name === 'QuotaExceededError') {
                msg = 'Device storage full. Could not save audio file.';
              }
              if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, 'error');
              cleanupAndReset();
              return resolve(null);
            }
          }

          const now = new Date();
          const defaultTitle = `Lecture – ${now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

          const savedRec = Storage.addRecording({
            id: recordingId,
            title: currentTitle || defaultTitle,
            subject: currentSubject || 'General',
            duration: elapsedSeconds,
            size: finalBlob.size,
            bitrate: currentBitrate,
            mimeType: currentMimeType || finalBlob.type || 'audio/webm',
            createdAt: now.toISOString()
          });

          localStorage.removeItem(ORPHAN_KEY);

          if (typeof App !== 'undefined' && App.showToast) App.showToast('Lecture recording saved!', 'success');
          window.dispatchEvent(new CustomEvent('studyflow_recordings_updated'));

          cleanupAndReset();
          resolve(savedRec);

        } catch (err) {
          console.error('Error saving recording:', err);
          if (typeof App !== 'undefined' && App.showToast) App.showToast('An error occurred while saving recording.', 'error');
          cleanupAndReset();
          resolve(null);
        }
      };

      try {
        mediaRecorder.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
        cleanupAndReset();
        resolve(null);
      }
    });
  }

  // ── Test Mic Action ──────────────────────────────────────────────────────────

  async function startMicTest() {
    if (recordingState !== 'idle') return;

    const settings = Storage.getSettings ? Storage.getSettings() : {};
    const denoise = settings.recorder_denoise || false;
    const boostLevel = settings.recorder_boost || 'off';

    try {
      const constraints = buildAudioConstraints({ denoise });
      const stream = await getMicStream(constraints);
      await setupAudioPipeline(stream, boostLevel);
      logAndDisplayDiagnostics(rawStream);

      recordingState = 'testing';
      updateControlsUI();
      announceAccessibilityState('Microphone test started');

      testTimerTimeout = setTimeout(() => {
        if (recordingState === 'testing') {
          if (typeof App !== 'undefined' && App.showToast) App.showToast('Microphone test ended (30s limit)', 'info');
          stopMicTest();
        }
      }, 30000);

    } catch (err) {
      console.error('Mic test error:', err);
      let msg = 'Could not access microphone for test.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access.';
      }
      if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, 'error');
      cleanupAudioNodes();
      stopAllStreamTracks();
      recordingState = 'idle';
      updateControlsUI();
    }
  }

  function stopMicTest() {
    if (recordingState !== 'testing') return;

    if (testTimerTimeout) {
      clearTimeout(testTimerTimeout);
      testTimerTimeout = null;
    }

    cleanupAudioNodes();
    stopAllStreamTracks();
    recordingState = 'idle';
    updateControlsUI();
    announceAccessibilityState('Microphone test stopped');
  }

  function cleanupAndReset() {
    cleanupAudioNodes();
    stopAllStreamTracks();
    recordedChunks = [];
    recordingState = 'idle';
    elapsedSeconds = 0;
    recordingId = null;
    currentTitle = '';
    currentSubject = 'General';
    localStorage.removeItem(ORPHAN_KEY);
    updateControlsUI();
    updateTimerUI();
    announceAccessibilityState('Recording stopped and saved');
  }

  function announceAccessibilityState(message) {
    const liveEl = document.getElementById('rec-live-announcer');
    if (liveEl) {
      liveEl.textContent = message;
    }
  }

  function updateTimerUI() {
    const timerDisplay = document.getElementById('rec-timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = formatTime(elapsedSeconds);
    }
  }

  function updateControlsUI() {
    const startBtn = document.getElementById('rec-start-btn');
    const pauseBtn = document.getElementById('rec-pause-btn');
    const stopBtn = document.getElementById('rec-stop-btn');
    const testBtn = document.getElementById('rec-test-btn');
    const boostSelect = document.getElementById('rec-boost-select');
    const denoiseCheckbox = document.getElementById('rec-denoise-checkbox');
    const warningBanner = document.getElementById('rec-warning-banner');
    const stateBadge = document.getElementById('rec-state-badge');

    const isActive = recordingState !== 'idle';

    if (boostSelect) boostSelect.disabled = isActive;
    if (denoiseCheckbox) denoiseCheckbox.disabled = isActive;

    if (stateBadge) {
      if (recordingState === 'recording') {
        stateBadge.textContent = 'REC';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-error/20 text-error font-label-sm text-label-sm font-semibold animate-pulse flex items-center gap-1';
      } else if (recordingState === 'paused') {
        stateBadge.textContent = 'PAUSED';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm font-semibold flex items-center gap-1';
      } else if (recordingState === 'testing') {
        stateBadge.textContent = 'TESTING';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-primary-container/30 text-primary font-label-sm text-label-sm font-semibold flex items-center gap-1';
      } else {
        stateBadge.textContent = 'READY';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-surface-container-high text-text-muted font-label-sm text-label-sm flex items-center gap-1';
      }
    }

    if (warningBanner) {
      if (recordingState === 'recording' || recordingState === 'paused') {
        warningBanner.classList.remove('hidden');
      } else {
        warningBanner.classList.add('hidden');
      }
    }

    if (startBtn) {
      if (recordingState === 'idle') {
        startBtn.classList.remove('hidden');
      } else {
        startBtn.classList.add('hidden');
      }
    }

    if (testBtn) {
      if (recordingState === 'idle') {
        testBtn.classList.remove('hidden');
        testBtn.textContent = 'Test Mic';
      } else if (recordingState === 'testing') {
        testBtn.classList.remove('hidden');
        testBtn.textContent = 'Stop Test';
      } else {
        testBtn.classList.add('hidden');
      }
    }

    if (pauseBtn) {
      if (recordingState === 'recording') {
        pauseBtn.classList.remove('hidden');
        pauseBtn.setAttribute('aria-pressed', 'false');
        pauseBtn.setAttribute('aria-label', 'Pause recording');
        pauseBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">pause</span><span>Pause</span>`;
      } else if (recordingState === 'paused') {
        pauseBtn.classList.remove('hidden');
        pauseBtn.setAttribute('aria-pressed', 'true');
        pauseBtn.setAttribute('aria-label', 'Resume recording');
        pauseBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">play_arrow</span><span>Resume</span>`;
      } else {
        pauseBtn.classList.add('hidden');
      }
    }

    if (stopBtn) {
      if (recordingState === 'recording' || recordingState === 'paused') {
        stopBtn.classList.remove('hidden');
      } else {
        stopBtn.classList.add('hidden');
      }
    }
  }

  function init() {
    setupEventListeners();
    checkOrphanedRecording();
  }

  function setupEventListeners() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (recordingState === 'recording') acquireWakeLock();
      } else {
        releaseWakeLock();
      }
    });

    window.addEventListener('pagehide', () => {
      releaseWakeLock();
      if (recordingState === 'recording') {
        flushPartialRecording();
      }
    });
  }

  function getState() {
    return recordingState;
  }

  return {
    init,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    startMicTest,
    stopMicTest,
    getMicStream,
    buildAudioConstraints,
    buildRecorderOptions,
    getState,
    formatTime
  };
})();

if (typeof window !== 'undefined') {
  window.Recorder = Recorder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Recorder;
}
