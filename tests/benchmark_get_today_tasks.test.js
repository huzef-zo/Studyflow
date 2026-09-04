const fs = require('fs');
const path = require('path');

// Mock environment
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = value.toString(); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); }
};
global.localStorage = localStorageMock;
global.sessionStorage = localStorageMock;
global.window = {
  localStorage: localStorageMock,
  sessionStorage: localStorageMock,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

// Load Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function precisionNow() {
  const hrTime = process.hrtime();
  return hrTime[0] * 1000 + hrTime[1] / 1000000;
}

function runTestsAndBenchmark() {
  console.log('--- Running getTodayTasks Correctness Tests ---');

  const now = new Date();
  const todayStr = Storage.formatDate(now);

  const testTasks = [
    { id: '1', title: 'Overdue 1', dueDate: '2026-01-01', completed: false },
    { id: '2', title: 'Overdue 2 completed', dueDate: '2026-01-01', completed: true },
    { id: '3', title: 'Today task', dueDate: todayStr, completed: false },
    { id: '4', title: 'Today task completed', dueDate: todayStr, completed: true },
    { id: '5', title: 'Range task', startDate: '2026-01-01', dueDate: '2029-12-31', completed: false },
    { id: '6', title: 'Future task', dueDate: '2029-12-31', completed: false },
    { id: '7', title: 'Repeating today', type: 'repeating', repeatDays: [0, 1, 2, 3, 4, 5, 6] }
  ];

  Storage.saveTasks(testTasks);
  const todayTasks = Storage.getTodayTasks();

  // Verify task count and task IDs
  console.log(`Retrieved ${todayTasks.length} tasks for today.`);
  const taskIds = todayTasks.map(t => t.id);

  if (!taskIds.includes('3')) throw new Error('Expected today task (id 3) to be present');
  if (!taskIds.includes('5')) throw new Error('Expected range task (id 5) to be present');
  if (!taskIds.includes('7')) throw new Error('Expected repeating task (id 7) to be present');
  if (!taskIds.includes('1')) throw new Error('Expected overdue task (id 1) to be present');

  if (taskIds.includes('2')) throw new Error('Completed overdue task (id 2) should NOT be present');
  if (taskIds.includes('4')) throw new Error('Completed today task (id 4) should NOT be present');
  if (taskIds.includes('6')) throw new Error('Future task (id 6) should NOT be present');

  const overdueTask = todayTasks.find(t => t.id === '1');
  if (!overdueTask._isOverdue) throw new Error('Overdue task (id 1) must have _isOverdue flag set');

  console.log('✅ Correctness test passed successfully!');

  console.log('\n--- Benchmarking Storage.getTodayTasks() ---');

  const numTasks = 2000;
  const benchmarkTasks = [];

  for (let i = 0; i < numTasks; i++) {
    const isOverdue = i % 10 === 0;
    const isRepeating = i % 5 === 0;
    let dueDate = todayStr;
    if (isOverdue) {
      dueDate = '2026-01-01';
    }
    benchmarkTasks.push({
      id: 'task_' + i,
      title: 'Task ' + i,
      type: isRepeating ? 'repeating' : 'one-time',
      dueDate: dueDate,
      completed: false,
      repeatDays: [0, 1, 2, 3, 4, 5, 6]
    });
  }

  Storage.saveTasks(benchmarkTasks);

  // Warmup
  for (let i = 0; i < 10; i++) Storage.getTodayTasks();

  const iterations = 100;
  const start = precisionNow();
  for (let i = 0; i < iterations; i++) {
    Storage.getTodayTasks();
  }
  const end = precisionNow();
  const avgDuration = (end - start) / iterations;

  console.log(`Dataset: ${numTasks} tasks`);
  console.log(`Average getTodayTasks() duration: ${avgDuration.toFixed(4)}ms (over ${iterations} iterations)`);
}

runTestsAndBenchmark();
