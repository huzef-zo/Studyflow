/**
 * Unit Tests - Recorder Settings, Metadata Bitrate & Pure Helper Logic
 */

const assert = require('assert');

// Mock localStorage, sessionStorage and window environment
if (typeof localStorage === 'undefined' || localStorage === null) {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

if (typeof sessionStorage === 'undefined' || sessionStorage === null) {
  const sessionStore = {};
  global.sessionStorage = {
    getItem: (key) => sessionStore[key] || null,
    setItem: (key, value) => { sessionStore[key] = value.toString(); },
    removeItem: (key) => { delete sessionStore[key]; },
    clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
  };
}

if (typeof document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => ({
      tagName: tag,
      style: {},
      appendChild: () => {},
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      id: '',
      classList: { add: () => {}, remove: () => {} }
    }),
    getElementById: () => null,
    body: { appendChild: () => {} }
  };
}

if (typeof window === 'undefined') {
  global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { pathname: '/recordings.html' }
  };
  global.CustomEvent = class CustomEvent { constructor(name, params) { this.name = name; this.params = params; } };
}

// Load Storage & Recorder modules
require('../js/storage.js');
require('../js/recorder.js');

const Storage = global.window.Storage;
const Recorder = global.window.Recorder;

console.log('--- Testing Recorder Settings, Metadata Bitrate & Pure Logic ---');

// 1. Settings Defaults
Storage.clearAllData();
const settings = Storage.getSettings();
assert.strictEqual(settings.recorder_boost, 'off', 'recorder_boost default is "off"');
assert.strictEqual(settings.recorder_denoise, false, 'recorder_denoise default is false');

// 2. updateSetting Validation & Rejection
assert.strictEqual(Storage.updateSetting('recorder_boost', 'invalid_val'), false, 'invalid recorder_boost value rejected');
assert.strictEqual(Storage.getSettings().recorder_boost, 'off', 'recorder_boost remains "off" after invalid update');

Storage.updateSetting('recorder_boost', 'medium');
assert.strictEqual(Storage.getSettings().recorder_boost, 'medium', 'valid recorder_boost "medium" accepted');

Storage.updateSetting('recorder_boost', 'high');
assert.strictEqual(Storage.getSettings().recorder_boost, 'high', 'valid recorder_boost "high" accepted');

Storage.updateSetting('recorder_denoise', true);
assert.strictEqual(Storage.getSettings().recorder_denoise, true, 'valid recorder_denoise boolean accepted');

// 3. importData Settings & Recording Bitrate Sanitization
const testBackup = {
  settings: {
    recorder_boost: 'malicious_boost',
    recorder_denoise: 'truthy_string'
  },
  recordings: [
    {
      id: 'rec_test_1',
      title: 'Test Lecture',
      duration: 100,
      bitrate: 128000,
      mimeType: 'audio/webm'
    },
    {
      id: 'rec_test_2',
      title: 'Bad Bitrate Lecture',
      duration: 100,
      bitrate: NaN,
      mimeType: 'audio/webm'
    },
    {
      id: 'rec_test_3',
      title: 'Oversized Bitrate Lecture',
      duration: 100,
      bitrate: 9999999,
      mimeType: 'audio/webm'
    }
  ]
};

Storage.importData(testBackup);
const importedSettings = Storage.getSettings();
assert.strictEqual(importedSettings.recorder_boost, 'off', 'invalid boost in import falls back to default "off"');
assert.strictEqual(importedSettings.recorder_denoise, true, 'denoise in import safely cast to boolean');

const importedRecordings = Storage.getRecordings();
assert.strictEqual(importedRecordings.length, 3, 'Imported 3 recordings');
assert.strictEqual(importedRecordings[0].bitrate, 128000, 'Valid bitrate preserved');
assert.strictEqual(importedRecordings[1].bitrate, 0, 'NaN bitrate sanitized to 0');
assert.strictEqual(importedRecordings[2].bitrate, 512000, 'Oversized bitrate clamped to 512000');

// 4. Pure Logic Helpers
const constraintsOff = Recorder.buildAudioConstraints({ denoise: false });
assert.deepStrictEqual(constraintsOff, {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 48000
  }
}, 'buildAudioConstraints with denoise=false turns off echoCancellation, noiseSuppression, autoGainControl');

const constraintsOn = Recorder.buildAudioConstraints({ denoise: true });
assert.strictEqual(constraintsOn.audio.noiseSuppression, true, 'buildAudioConstraints with denoise=true sets noiseSuppression=true');
assert.strictEqual(constraintsOn.audio.echoCancellation, false, 'echoCancellation stays false when denoise=true');
assert.strictEqual(constraintsOn.audio.autoGainControl, false, 'autoGainControl stays false when denoise=true');

const recorderOptsArray = Recorder.buildRecorderOptions(['audio/webm', 'audio/mp4']);
assert.strictEqual(recorderOptsArray.mimeType, 'audio/webm', 'buildRecorderOptions chooses preferred mimeType from array');
assert.strictEqual(recorderOptsArray.audioBitsPerSecond, 128000, 'buildRecorderOptions sets audioBitsPerSecond to 128000');

const recorderOptsFunc = Recorder.buildRecorderOptions((type) => type === 'audio/mp4');
assert.strictEqual(recorderOptsFunc.mimeType, 'audio/mp4', 'buildRecorderOptions uses fallback checker function');

console.log('--- ALL RECORDER SETTINGS, BITRATE & PURE LOGIC TESTS PASSED ---');
