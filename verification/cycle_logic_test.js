const assert = require('assert');
const fs = require('fs');

// Mock environment
const storageData = {};
global.localStorage = {
  getItem: (key) => storageData[key] || null,
  setItem: (key, value) => { storageData[key] = value; },
  removeItem: (key) => { delete storageData[key]; }
};
global.window = { location: { pathname: '/timer.html' } };

// Load storage.js
let storageContent = fs.readFileSync('js/storage.js', 'utf8');
// Replace const Storage with var Storage so it's global when evaled
storageContent = storageContent.replace('const Storage =', 'global.Storage =');
eval(storageContent);

console.log('--- Starting Cycle Logic Test ---');

const settings = Storage.getSettings();
settings.sessions_until_long_break = 2;
Storage.saveSettings(settings);

console.log('Testing Storage.completeTimerSession transitions...');

let state = {
    type: 'work',
    sessionsInCycle: 0,
    selectedTaskId: null,
    selectedSubtaskId: null
};

// 1st work session completes
state = Storage.completeTimerSession(state);
console.log('After 1st work:', state.type, 'sessionsInCycle:', state.sessionsInCycle);
assert.strictEqual(state.type, 'short_break');
assert.strictEqual(state.sessionsInCycle, 1);

// 1st short break completes
state.type = 'short_break';
state = Storage.completeTimerSession(state);
console.log('After 1st break:', state.type, 'sessionsInCycle:', state.sessionsInCycle);
assert.strictEqual(state.type, 'work');
assert.strictEqual(state.sessionsInCycle, 1);

// 2nd work session completes
state.type = 'work';
state = Storage.completeTimerSession(state);
console.log('After 2nd work:', state.type, 'sessionsInCycle:', state.sessionsInCycle);
assert.strictEqual(state.type, 'long_break');
assert.strictEqual(state.sessionsInCycle, 2);

// Long break completes
state.type = 'long_break';
state = Storage.completeTimerSession(state);
console.log('After long break:', state.type, 'sessionsInCycle:', state.sessionsInCycle);
assert.strictEqual(state.type, 'work');
assert.strictEqual(state.sessionsInCycle, 0);

console.log('Test PASSED');
