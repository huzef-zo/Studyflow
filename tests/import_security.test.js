/**
 * Security Unit Tests - Storage.importData Numeric Sanitization & Bounds
 */

// Mock localStorage and window environment for Node execution
if (typeof localStorage === 'undefined' || localStorage === null) {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

if (typeof window === 'undefined') {
  global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {}
  };
  global.CustomEvent = class CustomEvent { constructor(name, params) { this.name = name; this.params = params; } };
}

// Load Storage module
require('../js/storage.js');
const Storage = global.window.Storage;

console.log('--- Testing Storage.importData Numeric Sanitization & Bounding ---');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// 1. Test Session Duration Sanitization (Infinity, NaN, negative, huge)
const maliciousSessionsBackup = {
  sessions: [
    { id: 'sess_1', duration: Infinity, type: 'work' },
    { id: 'sess_2', duration: -500, type: 'work' },
    { id: 'sess_3', duration: 99999, type: 'work' },
    { id: 'sess_4', duration: 'invalid', type: 'work' }
  ]
};

Storage.importData(maliciousSessionsBackup);
const importedSessions = Storage.getSessions();

assert(importedSessions.length === 4, 'All 4 sessions imported');
const sess1 = importedSessions.find(s => s.id === 'sess_1');
const sess2 = importedSessions.find(s => s.id === 'sess_2');
const sess3 = importedSessions.find(s => s.id === 'sess_3');
const sess4 = importedSessions.find(s => s.id === 'sess_4');

assert(sess1.duration === 0, `Infinity duration sanitized to 0 (got ${sess1.duration})`);
assert(sess2.duration === 0, `Negative duration clamped to 0 (got ${sess2.duration})`);
assert(sess3.duration === 1440, `Ultra-large duration clamped to 1440 (got ${sess3.duration})`);
assert(sess4.duration === 0, `Non-numeric duration sanitized to 0 (got ${sess4.duration})`);

// 2. Test Task Progress, SortOrder, and Subtask Cycles
const maliciousTasksBackup = {
  tasks: [
    {
      id: 'task_1',
      title: 'Malicious Task',
      progress: Infinity,
      sortOrder: -100,
      subtasks: [
        { id: 'sub_1', title: 'Sub 1', estimatedCycles: Infinity, completedCycles: -10 },
        { id: 'sub_2', title: 'Sub 2', estimatedCycles: -5, completedCycles: 99999 }
      ]
    }
  ]
};

Storage.importData(maliciousTasksBackup);
const importedTasks = Storage.getTasks();
const task1 = importedTasks.find(t => t.id === 'task_1');

assert(task1.progress === 0, `Infinity task progress sanitized to 0 (got ${task1.progress})`);
assert(task1.sortOrder === 0, `Negative sortOrder clamped to 0 (got ${task1.sortOrder})`);
assert(task1.subtasks[0].estimatedCycles === 1, `Infinity estimatedCycles sanitized to default 1 (got ${task1.subtasks[0].estimatedCycles})`);
assert(task1.subtasks[0].completedCycles === 0, `Negative completedCycles clamped to 0 (got ${task1.subtasks[0].completedCycles})`);
assert(task1.subtasks[1].estimatedCycles === 1, `Negative estimatedCycles clamped to min 1 (got ${task1.subtasks[1].estimatedCycles})`);
assert(task1.subtasks[1].completedCycles === 1000, `Ultra-large completedCycles clamped to max 1000 (got ${task1.subtasks[1].completedCycles})`);

// 3. Test XP State Sanitization
const maliciousXPBackup = {
  xpState: {
    totalXP: Infinity,
    currentLevel: -5,
    history: [
      { date: '2026-09-25', xpGained: Infinity, source: 'Hack' }
    ]
  }
};

Storage.importData(maliciousXPBackup);
const xpState = Storage.getXPState();

assert(xpState.totalXP === 0, `Infinity totalXP sanitized to 0 (got ${xpState.totalXP})`);
assert(xpState.currentLevel === 1, `Negative currentLevel clamped to min 1 (got ${xpState.currentLevel})`);
assert(xpState.history[0].xpGained === 0, `Infinity xpGained in history sanitized to 0 (got ${xpState.history[0].xpGained})`);

console.log('--- ALL IMPORT SECURITY TESTS PASSED ---');
