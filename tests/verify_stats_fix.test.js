
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
global.window = {
    localStorage: localStorageMock,
    addEventListener: function() {}
};

// Mock App
global.App = {
    escapeHtml: (text) => text,
    formatDate: (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Stats Fix Verification Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // Test Case: todayPending calculation
    (function testTodayPending() {
        console.log('Test Case: todayPending calculation');
        Storage.clearAllData();

        const todayStr = Storage.formatDate(new Date());
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = Storage.formatDate(tomorrow);

        // Add 2 tasks for today (1 completed, 1 pending)
        Storage.addTask({ title: 'Today Task 1', dueDate: todayStr, completed: true });
        Storage.addTask({ title: 'Today Task 2', dueDate: todayStr, completed: false });

        // Add 1 task for tomorrow (pending)
        Storage.addTask({ title: 'Tomorrow Task', dueDate: tomorrowStr, completed: false });

        const stats = Storage.getStats();

        console.log('Stats:', JSON.stringify(stats.tasks, null, 2));

        if (stats.tasks.today !== 2) {
            throw new Error(`Expected today tasks to be 2, got ${stats.tasks.today}`);
        }
        if (stats.tasks.todayPending !== 1) {
            throw new Error(`Expected todayPending to be 1, got ${stats.tasks.todayPending}`);
        }
        if (stats.tasks.pending !== 2) {
            throw new Error(`Expected global pending to be 2, got ${stats.tasks.pending}`);
        }

        console.log('  Passed: todayPending correctly filters for today\'s incomplete tasks.');
    })();

    console.log('\nStats fix verification tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
