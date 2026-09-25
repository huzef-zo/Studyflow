const fs = require('fs');
const path = require('path');

// Mock localStorage and DOM
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = value.toString(); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); }
};

global.localStorage = localStorageMock;
global.sessionStorage = {
  getItem: (key) => null,
  setItem: (key, value) => {}
};
global.window = {
  localStorage: localStorageMock,
  sessionStorage: global.sessionStorage,
  addEventListener: function() {},
  dispatchEvent: function() {}
};
global.CustomEvent = class {};
global.document = {
  querySelectorAll: () => [],
  getElementById: (id) => ({ style: {}, classList: { add: () => {} }, textContent: '', innerHTML: '' })
};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

// Load App mock
global.App = {
  createProgressBar: () => '',
  createEmptyStateHtml: () => '',
  getSubjectColor: () => '#000',
  hexToRgb: () => '0,0,0',
  escapeHtml: (t) => t
};

const historyCode = fs.readFileSync(path.join(__dirname, '../js/history.js'), 'utf8');

// Expose internal functions for verification
let historyTestCode = historyCode.replace(
  'return { init };',
  'return { init, updateSummaryStats, renderFrequencyGraph, getFilteredTasks, getCompletedTasksInPeriod, getActivityData, setStatsPeriod: (v) => { statsPeriodDays = v; }, setElements: (e) => { elements = e; } };'
);
eval(historyTestCode);
const History = global.window.History;

function runVerificationTests() {
  console.log('--- Running History Module Optimization & Correctness Tests ---');

  Storage.clearAllData();

  // Create mock user
  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - 60);
  Storage.saveUser({ name: 'Test Student', email: '', created_at: createdDate.toISOString() });

  // Add sample tasks
  const now = new Date();
  const dateStrToday = Storage.formatDate(now);

  const task1 = {
    id: 't_1',
    title: 'One-time Task Completed Today',
    type: 'one-time',
    completed: true,
    completedAt: now.toISOString(),
    dueDate: dateStrToday
  };

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  const dateStrPast = Storage.formatDate(pastDate);

  const task2 = {
    id: 't_2',
    title: 'One-time Task Completed 10 Days Ago',
    type: 'one-time',
    completed: true,
    completedAt: pastDate.toISOString(),
    dueDate: dateStrPast
  };

  const task3 = {
    id: 't_3',
    title: 'Repeating Task',
    type: 'repeating',
    completed: false,
    repeatDays: [0, 1, 2, 3, 4, 5, 6]
  };

  Storage.saveTasks([task1, task2, task3]);

  // Add repeating task completion
  const rc = {};
  rc[`t_3_${dateStrToday}`] = true;
  rc[`t_3_${dateStrPast}`] = true;
  Storage.saveRepeatingCompletions(rc);

  // Test 1: getFilteredTasks returns expanded occurrences
  History.setStatsPeriod(7); // Last 7 days
  const filtered7 = History.getFilteredTasks();
  if (!Array.isArray(filtered7)) throw new Error('getFilteredTasks must return an array');
  console.log('✅ Test 1 Passed: getFilteredTasks returned valid occurrences list');

  // Test 2: getCompletedTasksInPeriod correctness
  History.setStatsPeriod(30);
  const completed30 = History.getCompletedTasksInPeriod();
  // Expect task1, task2, and 2 repeating completions
  if (completed30.length !== 4) throw new Error(`Expected 4 completed task occurrences, got ${completed30.length}`);
  console.log('✅ Test 2 Passed: getCompletedTasksInPeriod correctly counted completions across task types');

  // Test 3: getActivityData correctness
  const activityData = History.getActivityData(30);
  if (!activityData[dateStrToday] || activityData[dateStrToday].count < 2) {
    throw new Error(`Expected activity count >= 2 for today (${dateStrToday}), got ${activityData[dateStrToday] ? activityData[dateStrToday].count : 0}`);
  }
  console.log('✅ Test 3 Passed: getActivityData correctly aggregated activity counts by date key');

  // Benchmark History performance with large dataset
  console.log('\n--- Benchmarking History Analytics Performance ---');
  const largeTasks = [];
  for (let i = 0; i < 500; i++) {
    largeTasks.push({
      id: `task_perf_${i}`,
      title: `Performance Task ${i}`,
      type: i % 3 === 0 ? 'repeating' : 'one-time',
      completed: i % 2 === 0,
      completedAt: new Date(Date.now() - (i * 3600000 * 6)).toISOString(),
      dueDate: Storage.formatDate(new Date(Date.now() - (i * 3600000 * 6))),
      repeatDays: [0, 2, 4, 6]
    });
  }
  Storage.saveTasks(largeTasks);

  const largeSessions = [];
  for (let i = 0; i < 2000; i++) {
    largeSessions.push({
      id: `sess_perf_${i}`,
      duration: 25,
      type: 'work',
      completedAt: new Date(Date.now() - (i * 3600000 * 2)).toISOString(),
      notes: i % 5 === 0 ? `Focus session note ${i}` : ''
    });
  }
  Storage.saveSessions(largeSessions);

  const iterations = 50;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    History.setStatsPeriod(30);
    History.updateSummaryStats();
    History.getActivityData(30);
  }
  const elapsed = performance.now() - start;
  const avgMs = (elapsed / iterations).toFixed(3);
  console.log(`Dataset: ${largeTasks.length} tasks, ${largeSessions.length} sessions`);
  console.log(`Average analytics rendering iteration time: ${avgMs}ms over ${iterations} runs`);

  console.log('\n--- All History Module Optimization & Correctness Tests Passed! ---');
}

try {
  runVerificationTests();
} catch (err) {
  console.error('\n❌ Test Failed:');
  console.error(err.stack || err.message);
  process.exit(1);
}
