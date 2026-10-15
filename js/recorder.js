/**
 * StudyFlow - Recorder Module
 * Handles microphone recording, chunking, wake lock, IndexedDB sync, and partial recovery.
 */

const Recorder = (function() {
  'use strict';

  const MAX_RECORDING_SECONDS = 3 * 3600; // Default 3 hours
  const FLUSH_INTERVAL_MS = 30000; // 30 seconds
  const ORPHAN_KEY = 'studyflow_orphaned_recording';

  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordingState = 'idle'; // 'idle', 'recording', 'paused'
  let startTimeMs = 0;
  let elapsedSeconds = 0;
  let timerInterval = null;
  let flushInterval = null;
  let currentMimeType = '';
  let wakeLock = null;
  let recordingId = null;
  let currentSubject = 'General';
  let currentTitle = '';

  function pickSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
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

  function stopStreamTracks() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      mediaStream = null;
    }
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
        mimeType: currentMimeType,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ORPHAN_KEY, JSON.stringify(orphanMeta));
    } catch (err) {
      console.error('Failed to flush partial recording:', err);
    }
  }

  async function startRecording() {
    if (recordingState !== 'idle') return;

    currentMimeType = pickSupportedMimeType();
    if (!currentMimeType && typeof MediaRecorder !== 'undefined') {
      if (typeof App !== 'undefined' && App.showToast) App.showToast('No supported audio recording format found on this browser.', 'error');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone error:', err);
      let msg = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone was found on this device.';
      }
      if (typeof App !== 'undefined' && App.showToast) App.showToast(msg, 'error');
      stopStreamTracks();
      return;
    }

    try {
      recordedChunks = [];
      recordingId = Storage.generateId ? Storage.generateId() : 'rec_' + Date.now();

      const options = currentMimeType ? { mimeType: currentMimeType } : {};
      mediaRecorder = new MediaRecorder(mediaStream, options);

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
      stopStreamTracks();
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
          stopStreamTracks();

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

  function cleanupAndReset() {
    stopStreamTracks();
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
    const warningBanner = document.getElementById('rec-warning-banner');
    const stateBadge = document.getElementById('rec-state-badge');

    if (stateBadge) {
      if (recordingState === 'recording') {
        stateBadge.textContent = 'REC';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-error/20 text-error font-label-sm text-label-sm font-semibold animate-pulse flex items-center gap-1';
      } else if (recordingState === 'paused') {
        stateBadge.textContent = 'PAUSED';
        stateBadge.className = 'px-2.5 py-0.5 rounded-full bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm font-semibold flex items-center gap-1';
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
      if (recordingState !== 'idle') {
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
