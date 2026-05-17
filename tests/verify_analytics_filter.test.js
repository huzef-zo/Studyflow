
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
    getElementById: (id) => ({ classList: { add: () => {} }, textContent: '', innerHTML: '' })
};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

// Load History module (we need to mock some stuff it uses)
global.App = {
    createProgressBar: () => '',
    createEmptyStateHtml: () => '',
    getSubjectColor: () => '#000',
    hexToRgb: () => '0,0,0',
    escapeHtml: (t) => t
};

const historyCode = fs.readFileSync(path.join(__dirname, '../js/history.js'), 'utf8');

// Re-evaluating History to expose getFilteredSessions for testing
let historyTestCode = historyCode.replace('return { init };', 'return { init, updateSummaryStats, getFilteredSessions, setStatsPeriod: (v) => { statsPeriodDays = v; }, setElements: (e) => { elements = e; } };');
eval(historyTestCode);
const History = global.window.History;

function runTests() {
    console.log('Running Analytics Filter Tests...');

    // Helper to add session
    function addSessionAtDate(daysAgo, duration = 30) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        const sessions = Storage.getSessions();
        sessions.push({
            id: 's_' + Math.random(),
            duration: duration,
            type: 'work',
            completedAt: date.toISOString()
        });
        Storage.saveSessions(sessions);
    }

    // 1. Sessions from 60 days ago are excluded when period = 30
    (function testExclusion() {
        console.log('Test 1: Sessions from 60 days ago are excluded when period = 30');
        Storage.clearAllData();
        addSessionAtDate(60, 60);
        addSessionAtDate(3, 30);

        History.setStatsPeriod(30);
        const filtered = History.getFilteredSessions();
        if (filtered.length !== 1) throw new Error(`Expected 1 session, got ${filtered.length}`);
        if (filtered[0].duration !== 30) throw new Error('Wrong session included');
        console.log('  Passed');
    })();

    // 2. Sessions from 3 days ago are included when period = 30
    (function testInclusion() {
        console.log('Test 2: Sessions from 3 days ago are included when period = 30');
        // already verified by test 1
        console.log('  Passed');
    })();

    // 3. All sessions included when period = null (all time)
    (function testAllTime() {
        console.log('Test 3: All sessions included when period = null (all time)');
        History.setStatsPeriod(null);
        const filtered = History.getFilteredSessions();
        if (filtered.length !== 2) throw new Error(`Expected 2 sessions, got ${filtered.length}`);
        console.log('  Passed');
    })();

    // 4. Productive day changes correctly when period changes
    (function testProductiveDay() {
        console.log('Test 4: Productive day changes correctly when period changes');
        Storage.clearAllData();

        function addSessionOnSpecificDay(daysAgo, duration) {
             const date = new Date();
             date.setDate(date.getDate() - daysAgo);
             const sessions = Storage.getSessions();
             sessions.push({
                 id: 's_' + Math.random(),
                 duration: duration,
                 type: 'work',
                 completedAt: date.toISOString()
             });
             Storage.saveSessions(sessions);
             return date.getDay();
        }

        Storage.saveSessions([]);

        // Add a long session 40 days ago
        const dayLongAgo = addSessionOnSpecificDay(40, 500);
        // Add a shorter session 2 days ago
        const dayRecently = addSessionOnSpecificDay(2, 100);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const productiveDayEl = { textContent: '' };
        History.setElements({
            productiveDay: productiveDayEl,
            totalCompletedTasks: {},
            totalStudyHours: {},
            allTimeStreak: {},
            completionRate: {}
        });

        // All time - should show formatted date with year
        History.setStatsPeriod(null);
        History.updateSummaryStats();
        const dateLongAgo = new Date();
        dateLongAgo.setDate(dateLongAgo.getDate() - 40);
        const expectedLongAgo = dateLongAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (productiveDayEl.textContent !== expectedLongAgo) {
            throw new Error(`Expected ${expectedLongAgo}, got ${productiveDayEl.textContent}`);
        }

        // Last 30 days - should show formatted date without year
        History.setStatsPeriod(30);
        History.updateSummaryStats();
        const dateRecently = new Date();
        dateRecently.setDate(dateRecently.getDate() - 2);
        const expectedRecently = dateRecently.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (productiveDayEl.textContent !== expectedRecently) {
            throw new Error(`Expected ${expectedRecently}, got ${productiveDayEl.textContent}`);
        }

        // Last 7 days - should show day name
        History.setStatsPeriod(7);
        History.updateSummaryStats();
        if (productiveDayEl.textContent !== dayNames[dayRecently]) {
            throw new Error(`Expected ${dayNames[dayRecently]}, got ${productiveDayEl.textContent}`);
        }
        console.log('  Passed');
    })();

    console.log('\nAll Analytics Filter tests passed!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
