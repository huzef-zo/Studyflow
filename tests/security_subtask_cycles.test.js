/**
 * Security Test Suite: Subtask Cycle & Subject Color Sanitization
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock localStorage and sessionStorage
global.localStorage = {
  _data: {},
  setItem(k, v) { this._data[k] = String(v); },
  getItem(k) { return this._data[k] || null; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {}
};

// Mock window and document
global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  location: { reload: () => {} },
  localStorage: global.localStorage
};
global.document = {
  addEventListener: () => {},
  getElementById: () => null
};
global.CustomEvent = class {
  constructor(name, detail) { this.name = name; this.detail = detail; }
};

// Load Storage & App modules
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const Storage = eval(storageCode + '; Storage;');
global.Storage = Storage;

const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const App = eval(appCode + '; App;');
global.App = App;

console.log('--- Testing Subtask Cycles & Subject Color Security Hardening ---');

// Setup task
const task = Storage.addTask({
  title: 'Test Security Task',
  type: 'one-time',
  subject: 'Math',
  subtasks: [
    { id: 'sub_1', title: 'Subtask 1', estimatedCycles: 2, completedCycles: 0 }
  ]
});

// Test 1: updateSubtask with non-finite completedCycles (Infinity)
Storage.updateSubtask(task.id, 'sub_1', { completedCycles: Infinity });
let updatedTask = Storage.getTaskById(task.id);
let sub = updatedTask.subtasks.find(s => s.id === 'sub_1');
assert.strictEqual(sub.completedCycles, 0, `Expected 0 for Infinity completedCycles, got ${sub.completedCycles}`);

// Test 2: updateSubtask with negative completedCycles
Storage.updateSubtask(task.id, 'sub_1', { completedCycles: -5 });
updatedTask = Storage.getTaskById(task.id);
sub = updatedTask.subtasks.find(s => s.id === 'sub_1');
assert.strictEqual(sub.completedCycles, 0, `Expected 0 for negative completedCycles, got ${sub.completedCycles}`);

// Test 3: updateSubtask with oversized completedCycles
Storage.updateSubtask(task.id, 'sub_1', { completedCycles: 999999 });
updatedTask = Storage.getTaskById(task.id);
sub = updatedTask.subtasks.find(s => s.id === 'sub_1');
assert.strictEqual(sub.completedCycles, 1000, `Expected 1000 for oversized completedCycles, got ${sub.completedCycles}`);

// Test 4: addSubtask with non-finite values
const addedSub = Storage.addSubtask(task.id, {
  title: 'Subtask 2',
  estimatedCycles: -10,
  completedCycles: Infinity
});
updatedTask = Storage.getTaskById(task.id);
const sub2 = updatedTask.subtasks.find(s => s.title === 'Subtask 2');
assert.strictEqual(sub2.estimatedCycles, 1, `Expected 1 for negative estimatedCycles, got ${sub2.estimatedCycles}`);
assert.strictEqual(sub2.completedCycles, 0, `Expected 0 for Infinity completedCycles, got ${sub2.completedCycles}`);

// Test 5: setRepeatingSubtaskCyclesOnDate with non-finite / invalid input
const repeatingTask = Storage.addTask({
  title: 'Repeating Task',
  type: 'repeating',
  subject: 'Math',
  subtasks: [{ id: 'rep_sub_1', title: 'Rep Sub 1' }]
});

Storage.setRepeatingSubtaskCyclesOnDate(repeatingTask.id, 'rep_sub_1', '2026-10-02', Infinity);
let repTaskResolved = Storage.resolveRepeatingTaskForDate(Storage.getTaskById(repeatingTask.id), '2026-10-02');
let repSub = repTaskResolved.subtasks.find(s => s.id === 'rep_sub_1');
assert.strictEqual(repSub.completedCycles, 0, `Expected 0 for Infinity repeating cycles, got ${repSub.completedCycles}`);

Storage.setRepeatingSubtaskCyclesOnDate(repeatingTask.id, 'rep_sub_1', '2026-10-02', 5);
repTaskResolved = Storage.resolveRepeatingTaskForDate(Storage.getTaskById(repeatingTask.id), '2026-10-02');
repSub = repTaskResolved.subtasks.find(s => s.id === 'rep_sub_1');
assert.strictEqual(repSub.completedCycles, 5, `Expected 5 for valid repeating cycles, got ${repSub.completedCycles}`);

// Test 6: App.getSubjectColor validation against unvalidated / corrupted subject color in raw storage
localStorage.setItem(Storage.KEYS.SUBJECTS, JSON.stringify([
  { id: 'mal1', name: 'MaliciousSubject', color: 'red; background-image: url("javascript:alert(1)")' }
]));

const safeColor = App.getSubjectColor('MaliciousSubject');
assert.strictEqual(safeColor, '#5B9BF0', `Expected fallback '#5B9BF0' for malicious subject color, got ${safeColor}`);

console.log('✅ ALL SUBTASK CYCLES & SUBJECT COLOR SECURITY TESTS PASSED');
