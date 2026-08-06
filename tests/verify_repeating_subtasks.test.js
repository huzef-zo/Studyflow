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

// Load SubtaskUtils and Storage module
const subtaskUtilsCode = fs.readFileSync(path.join(__dirname, '../js/subtask-utils.js'), 'utf8');
eval(subtaskUtilsCode.replace('const SubtaskUtils =', 'global.SubtaskUtils ='));

const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Repeating Subtasks Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // Test 1: Resolve subtask completion on different dates
    (function testDateSpecificSubtaskCompletion() {
        console.log('Test 1: Date-specific subtask completion');
        Storage.clearAllData();

        const task = Storage.addTask({
            title: 'Daily Exercises',
            type: 'repeating',
            repeatDays: [1, 2, 3, 4, 5], // Weekdays
            subtasks: [
                { id: 'sub_1', title: 'Stretch', isCompleted: false },
                { id: 'sub_2', title: 'Push-ups', isCompleted: false }
            ]
        });

        const day1 = '2026-06-01'; // Monday
        const day2 = '2026-06-02'; // Tuesday

        // Complete first subtask on day1
        Storage.updateSubtask(task.id, 'sub_1', { isCompleted: true }, day1);

        // Verify day1 has sub_1 completed but sub_2 incomplete
        const taskOnDay1 = Storage.getTasksByDate(day1).find(t => t.id === task.id);
        if (!taskOnDay1) throw new Error('Task not found on Day 1');
        const s1_day1 = taskOnDay1.subtasks.find(s => s.id === 'sub_1');
        const s2_day1 = taskOnDay1.subtasks.find(s => s.id === 'sub_2');
        if (!s1_day1.isCompleted) throw new Error('Subtask 1 should be completed on Day 1');
        if (s2_day1.isCompleted) throw new Error('Subtask 2 should be incomplete on Day 1');
        if (taskOnDay1.progress !== 50) throw new Error(`Expected progress 50 on Day 1, got ${taskOnDay1.progress}`);

        // Verify day2 has both subtasks incomplete (returns again on the next cycle/day!)
        const taskOnDay2 = Storage.getTasksByDate(day2).find(t => t.id === task.id);
        if (!taskOnDay2) throw new Error('Task not found on Day 2');
        const s1_day2 = taskOnDay2.subtasks.find(s => s.id === 'sub_1');
        const s2_day2 = taskOnDay2.subtasks.find(s => s.id === 'sub_2');
        if (s1_day2.isCompleted) throw new Error('Subtask 1 should be incomplete on Day 2');
        if (s2_day2.isCompleted) throw new Error('Subtask 2 should be incomplete on Day 2');
        if (taskOnDay2.progress !== 0) throw new Error(`Expected progress 0 on Day 2, got ${taskOnDay2.progress}`);

        console.log('  Passed: Subtask completion states are fully date-specific.');
    })();

    // Test 2: Auto-completion of parent repeating task upon completing all subtasks on a specific date
    (function testSubtasksAutoCompleteParent() {
        console.log('Test 2: Subtasks auto-completion of parent repeating task');
        Storage.clearAllData();

        const task = Storage.addTask({
            title: 'Daily Exercises',
            type: 'repeating',
            repeatDays: [1, 2, 3, 4, 5],
            subtasks: [
                { id: 'sub_1', title: 'Stretch', isCompleted: false },
                { id: 'sub_2', title: 'Push-ups', isCompleted: false }
            ]
        });

        const day1 = '2026-06-01';
        const day2 = '2026-06-02';

        // Complete both subtasks on day1
        Storage.updateSubtask(task.id, 'sub_1', { isCompleted: true }, day1);
        Storage.updateSubtask(task.id, 'sub_2', { isCompleted: true }, day1);

        // Verify task is completed on day1
        if (!Storage.isRepeatingTaskCompletedOnDate(task.id, day1)) {
            throw new Error('Repeating task should auto-complete on Day 1 when all subtasks are complete');
        }

        // Verify task is NOT completed on day2
        if (Storage.isRepeatingTaskCompletedOnDate(task.id, day2)) {
            throw new Error('Repeating task should remain incomplete on Day 2');
        }

        console.log('  Passed: Completing all subtasks auto-completes parent repeating task for that date only.');
    })();

    // Test 3: completeTask and uncompleteTask on repeating tasks
    (function testCompleteUncompleteRepeatingTask() {
        console.log('Test 3: completeTask/uncompleteTask on repeating tasks');
        Storage.clearAllData();

        const task = Storage.addTask({
            title: 'Daily exercises',
            type: 'repeating',
            repeatDays: [1, 2, 3, 4, 5],
            subtasks: [
                { id: 'sub_1', title: 'Stretch', isCompleted: false }
            ]
        });

        // completeTask should complete the repeating task for today
        const completedTask = Storage.completeTask(task.id);
        const todayStr = Storage.formatDate(new Date());

        if (!Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr)) {
            throw new Error('Task should be completed on todayStr after completeTask');
        }

        // It should also complete its subtasks for todayStr
        const resolvedToday = Storage.resolveRepeatingTaskForDate(task, todayStr);
        if (!resolvedToday.subtasks[0].isCompleted) {
            throw new Error('Subtask should be completed for todayStr after completeTask');
        }

        // uncompleteTask should uncomplete the repeating task for today
        Storage.uncompleteTask(task.id);
        if (Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr)) {
            throw new Error('Task should be incomplete on todayStr after uncompleteTask');
        }

        const resolvedToday2 = Storage.resolveRepeatingTaskForDate(task, todayStr);
        if (resolvedToday2.subtasks[0].isCompleted) {
            throw new Error('Subtask should be incomplete on todayStr after uncompleteTask');
        }

        console.log('  Passed: completeTask and uncompleteTask work per-date for repeating tasks.');
    })();

    // Test 4: Database clean save guard
    (function testDatabaseCleanSave() {
        console.log('Test 4: Database clean save guard');
        Storage.clearAllData();

        const task = Storage.addTask({
            title: 'Daily Math',
            type: 'repeating',
            repeatDays: [1, 2, 3, 4, 5],
            subtasks: [
                { id: 'sub_1', title: 'Algebra', isCompleted: false }
            ]
        });

        const todayStr = Storage.formatDate(new Date());

        // Complete the subtask and task for today
        Storage.updateSubtask(task.id, 'sub_1', { isCompleted: true }, todayStr);

        // Directly load from localStorage to ensure saved task remains clean/incomplete
        const rawTasks = JSON.parse(global.localStorage.getItem('studyflow_tasks'));
        const rawTask = rawTasks.find(t => t.id === task.id);

        if (rawTask.completed !== false) {
            throw new Error('In localStorage, repeating task completed state should be false');
        }
        if (rawTask.subtasks[0].isCompleted !== false) {
            throw new Error('In localStorage, repeating subtask isCompleted state should be false');
        }

        console.log('  Passed: Repeating tasks are saved clean to localStorage so they return on next cycle.');
    })();

    console.log('\nAll Repeating Subtasks tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
