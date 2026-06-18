
const fs = require('fs');
const path = require('path');

// Mock localStorage
const localStorageStore = {};
const localStorageMock = {
    getItem: (key) => localStorageStore[key] || null,
    setItem: (key, value) => { localStorageStore[key] = value.toString(); },
    removeItem: (key) => { delete localStorageStore[key]; },
    clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); }
};

const sessionStorageMock = {
    getItem: (key) => null,
    setItem: (key, value) => {}
};

global.localStorage = localStorageMock;
global.sessionStorage = sessionStorageMock;
global.window = {
    sessionStorage: sessionStorageMock,
    localStorage: localStorageMock,
    addEventListener: function() {},
    dispatchEvent: function() {},
    CustomEvent: function() {}
};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Repeating Completions Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // Test 1: Complete and uncomplete on specific dates
    (function testBasicCompletion() {
        console.log('Test 1: Basic Completion');
        Storage.clearAllData();
        const taskId = 'task_1';
        const dayA = '2023-10-01';
        const dayB = '2023-10-02';

        Storage.setRepeatingTaskCompletedOnDate(taskId, dayA, true);
        if (!Storage.isRepeatingTaskCompletedOnDate(taskId, dayA)) throw new Error('Task should be completed on dayA');
        if (Storage.isRepeatingTaskCompletedOnDate(taskId, dayB)) throw new Error('Task should NOT be completed on dayB');

        Storage.setRepeatingTaskCompletedOnDate(taskId, dayA, false);
        if (Storage.isRepeatingTaskCompletedOnDate(taskId, dayA)) throw new Error('Task should be uncompleted on dayA');
        console.log('  Passed: Basic completion/uncompletion works per date.');
    })();

    // Test 2: getTasksByDate annotation
    (function testGetTasksByDate() {
        console.log('Test 2: getTasksByDate annotation');
        Storage.clearAllData();
        const task = Storage.addTask({
            title: 'Daily Math',
            type: 'repeating',
            repeatDays: [0, 1, 2, 3, 4, 5, 6] // Every day
        });
        const today = '2023-10-01'; // A Sunday (0)

        Storage.setRepeatingTaskCompletedOnDate(task.id, today, true);

        const tasks = Storage.getTasksByDate(today);
        const found = tasks.find(t => t.id === task.id);

        if (!found) throw new Error('Task not found in getTasksByDate');
        if (found.completedOnDate !== true) throw new Error('Task should have completedOnDate: true');
        if (found._dateContext !== today) throw new Error('_dateContext mismatch');
        if (found.completed === true) throw new Error('task.completed should remain false for repeating tasks');

        console.log('  Passed: getTasksByDate correctly annotates repeating tasks.');
    })();

    // Test 3: Statistics counting
    (function testStats() {
        console.log('Test 3: Statistics counting');
        Storage.clearAllData();
        const todayStr = Storage.formatDate(new Date());

        // Add a repeating task and complete it for today
        const task = Storage.addTask({ title: 'Daily', type: 'repeating', repeatDays: [new Date().getDay()] });
        Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, true);

        const stats = Storage.getStats();
        if (stats.tasks.todayCompleted !== 1) throw new Error(`Expected 1 todayCompleted, got ${stats.tasks.todayCompleted}`);
        if (stats.tasks.weekCompleted !== 1) throw new Error(`Expected 1 weekCompleted, got ${stats.tasks.weekCompleted}`);
        if (stats.tasks.completed !== 1) throw new Error(`Expected 1 total completed, got ${stats.tasks.completed}`);

        const goals = Storage.getGoals();
        if (goals.current_tasks !== 1) throw new Error(`Expected 1 current_tasks in goals, got ${goals.current_tasks}`);

        console.log('  Passed: Stats and Goals correctly count repeating task completions.');
    })();

    // Test 4: Pruning
    (function testPruning() {
        console.log('Test 4: Pruning');
        Storage.clearAllData();
        const taskId = 'task_1';

        const today = new Date();
        const oldDate = new Date();
        oldDate.setDate(today.getDate() - 95);
        const oldDateStr = Storage.formatDate(oldDate);
        const recentDate = new Date();
        recentDate.setDate(today.getDate() - 50);
        const recentDateStr = Storage.formatDate(recentDate);

        Storage.setRepeatingTaskCompletedOnDate(taskId, oldDateStr, true);
        Storage.setRepeatingTaskCompletedOnDate(taskId, recentDateStr, true);

        Storage.pruneRepeatingCompletions();

        if (Storage.isRepeatingTaskCompletedOnDate(taskId, oldDateStr)) throw new Error('Old record should have been pruned');
        if (!Storage.isRepeatingTaskCompletedOnDate(taskId, recentDateStr)) throw new Error('Recent record should NOT have been pruned');

        console.log('  Passed: Pruning removes records older than 90 days.');
    })();

    // Test 5: Export/Import
    (function testExportImport() {
        console.log('Test 5: Export/Import');
        Storage.clearAllData();
        const recentDate = Storage.formatDate(new Date());
        Storage.setRepeatingTaskCompletedOnDate('task_1', recentDate, true);

        const exported = Storage.exportData();
        if (!exported.repeatingCompletions || !exported.repeatingCompletions[`task_1_${recentDate}`]) {
            throw new Error('Export missing repeating completions');
        }

        Storage.clearAllData();
        Storage.importData(exported);

        if (!Storage.isRepeatingTaskCompletedOnDate('task_1', recentDate)) {
            throw new Error('Import failed to restore repeating completions');
        }

        console.log('  Passed: Export/Import correctly handles repeating completions.');
    })();

    console.log('\nAll Repeating Completions tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
