
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
global.window = {
    localStorage: localStorageMock,
    addEventListener: () => {},
    dispatchEvent: () => {}
};
global.document = {
    getElementById: () => ({})
};
global.CustomEvent = class {};

const AppMock = {
    escapeHtml: (text) => text,
    showToast: () => {},
    getSubjectColor: () => '#000',
    hexToRgb: () => '0,0,0',
    createEmptyStateHtml: () => ''
};
global.App = AppMock;

// Load Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

// Old Implementation (for comparison)
function getTasksForMonthOld(year, month) {
    const tasks = Storage.getTasks();
    const monthTasks = {};
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    tasks.forEach(task => {
      if (task.type === 'repeating') {
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = Storage.formatDate(d);
          if (task.repeatDays && task.repeatDays.includes(d.getDay())) {
            if (!monthTasks[dateStr]) monthTasks[dateStr] = [];
            monthTasks[dateStr].push(task);
          }
        }
      } else if (task.dueDate) {
        const startDateStr = task.startDate || task.dueDate;
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = Storage.formatDate(d);
          if (dateStr >= startDateStr && dateStr <= task.dueDate) {
            if (!monthTasks[dateStr]) monthTasks[dateStr] = [];
            monthTasks[dateStr].push(task);
          }
        }
      }
    });
    return monthTasks;
}

// Load New Implementation from js/calendar.js
let calendarCode = fs.readFileSync(path.join(__dirname, '../js/calendar.js'), 'utf8');
// Replace the IIFE with a named function or just extract the body.
// The file starts with const Calendar = (function() { and ends with })(); window.Calendar = Calendar;
calendarCode = calendarCode.replace('const Calendar = (function() {', 'const Calendar = (function() { global.getTasksForMonthNew = getTasksForMonth;');
eval(calendarCode);
const getTasksForMonthNew = global.getTasksForMonthNew;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runTests() {
    console.log('Running Calendar Performance & Correctness Tests...');

    if (!getTasksForMonthNew) {
        throw new Error('Failed to extract getTasksForMonthNew from js/calendar.js');
    }

    // 1. Performance Test
    (function testPerformance() {
        console.log('Test 1: Performance with 500 tasks');
        Storage.clearAllData();
        const tasks = [];
        for (let i = 0; i < 500; i++) {
            const type = i % 3 === 0 ? 'repeating' : (i % 3 === 1 ? 'one-time' : 'date-range');
            tasks.push({
                id: 'task_' + i,
                title: 'Task ' + i,
                type: type,
                startDate: '2024-01-01',
                dueDate: '2024-12-31',
                repeatDays: [1, 3, 5],
                subject: 'Math',
                priority: 'medium'
            });
        }
        Storage.saveTasks(tasks);

        const start = Date.now();
        getTasksForMonthNew(2024, 4); // May 2024
        const end = Date.now();
        const duration = end - start;
        console.log(`  Duration: ${duration}ms`);
        assert(duration < 50, `Performance too slow: ${duration}ms`);
    })();

    // 2. Correctness: Comparison with Old Implementation
    (function testCorrectness() {
        console.log('Test 2: Correctness vs Old Implementation');
        Storage.clearAllData();
        const tasks = [
            { id: '1', title: 'Repeating Mon', type: 'repeating', repeatDays: [1] },
            { id: '2', title: 'One-time', type: 'one-time', dueDate: '2024-05-15' },
            { id: '3', title: 'Date Range', type: 'date-range', startDate: '2024-05-10', dueDate: '2024-05-20' },
            { id: '4', title: 'Across Months', type: 'date-range', startDate: '2024-04-25', dueDate: '2024-05-05' }
        ];
        Storage.saveTasks(tasks);

        const oldResult = getTasksForMonthOld(2024, 4);
        const newResult = getTasksForMonthNew(2024, 4);

        // Normalize old result to have empty arrays for all days (like new implementation)
        const monthEndDate = new Date(2024, 5, 0);
        for (let day = 1; day <= monthEndDate.getDate(); day++) {
            const dateStr = `2024-05-${String(day).padStart(2, '0')}`;
            if (!oldResult[dateStr]) oldResult[dateStr] = [];
        }

        const oldKeys = Object.keys(oldResult).sort();
        const newKeys = Object.keys(newResult).sort();

        assert(oldKeys.length === newKeys.length, 'Key length mismatch');
        oldKeys.forEach(key => {
            assert(newResult[key] !== undefined, `Missing key ${key} in new result`);
            assert(oldResult[key].length === newResult[key].length, `Length mismatch for ${key}: expected ${oldResult[key].length}, got ${newResult[key].length}`);
            const oldIds = oldResult[key].map(t => t.id).sort();
            const newIds = newResult[key].map(t => t.id).sort();
            assert(JSON.stringify(oldIds) === JSON.stringify(newIds), `Content mismatch for ${key}`);
        });
        console.log('  Passed: Results match old implementation.');
    })();

    // 3. Edge Case: February 2024 (Leap Year)
    (function testFebruaryLeapYear() {
        console.log('Test 3: February 2024 (Leap Year)');
        Storage.clearAllData();
        const tasks = [
            { id: 'leap', title: 'Leap Day Task', type: 'one-time', dueDate: '2024-02-29' }
        ];
        Storage.saveTasks(tasks);
        const result = getTasksForMonthNew(2024, 1);
        assert(result['2024-02-29'] && result['2024-02-29'].length === 1, 'Leap day task missing');
        assert(Object.keys(result).length === 29, 'February 2024 should have 29 days');
        console.log('  Passed: Leap year handled correctly.');
    })();

    // 4. Edge Case: Repeating task on Mondays
    (function testRepeatingMondays() {
        console.log('Test 4: Repeating Mondays');
        Storage.clearAllData();
        const tasks = [
            { id: 'mon', title: 'Monday Task', type: 'repeating', repeatDays: [1] }
        ];
        Storage.saveTasks(tasks);
        const result = getTasksForMonthNew(2024, 4); // May 2024. Mondays: 6, 13, 20, 27
        const mondays = ['2024-05-06', '2024-05-13', '2024-05-20', '2024-05-27'];
        mondays.forEach(d => {
            assert(result[d] && result[d].length === 1, `Missing repeating task on ${d}`);
        });
        let totalCount = 0;
        Object.values(result).forEach(arr => totalCount += arr.length);
        assert(totalCount === 4, 'Should only have 4 occurrences of Monday task in May 2024');
        console.log('  Passed: Repeating Mondays handled correctly.');
    })();

    // 5. Edge Case: Date range spanning two months
    (function testDateRangeSpanningMonths() {
        console.log('Test 5: Date range spanning months');
        Storage.clearAllData();
        const tasks = [
            { id: 'span', title: 'Span Task', type: 'date-range', startDate: '2024-04-30', dueDate: '2024-05-02' }
        ];
        Storage.saveTasks(tasks);
        const result = getTasksForMonthNew(2024, 4); // May 2024
        assert(result['2024-05-01'] && result['2024-05-01'].length === 1, 'Span task missing on May 1st');
        assert(result['2024-05-02'] && result['2024-05-02'].length === 1, 'Span task missing on May 2nd');
        assert(!result['2024-05-03'] || result['2024-05-03'].length === 0, 'Span task should not be on May 3rd');
        console.log('  Passed: Date range spanning months handled correctly.');
    })();

    // 6. Data Corruption Guard: startDate > dueDate
    (function testDataCorruption() {
        console.log('Test 6: Data corruption guard (startDate > dueDate)');
        Storage.clearAllData();
        const tasks = [
            { id: 'corrupt', title: 'Corrupt Task', type: 'date-range', startDate: '2024-05-20', dueDate: '2024-05-10' }
        ];
        Storage.saveTasks(tasks);
        const result = getTasksForMonthNew(2024, 4);
        let totalCount = 0;
        Object.values(result).forEach(arr => totalCount += arr.length);
        assert(totalCount === 0, 'Corrupt task should be skipped');
        console.log('  Passed: Corrupt task skipped.');
    })();

    console.log('\nAll performance and correctness tests passed!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
