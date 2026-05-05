
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
    dispatchEvent: function() {}
};

// Mock timers
let currentTime = 0;
const timeouts = [];
global.setTimeout = (fn, delay) => {
    const id = timeouts.length + 1;
    timeouts.push({ id, fn, time: currentTime + delay, active: true });
    return id;
};
global.clearTimeout = (id) => {
    const timeout = timeouts.find(t => t.id === id);
    if (timeout) timeout.active = false;
};

function advanceTime(ms) {
    currentTime += ms;
    timeouts.forEach(t => {
        if (t.active && t.time <= currentTime) {
            t.active = false;
            t.fn();
        }
    });
}

const AppMock = {
    showToast: () => {},
    formatDate: (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};
global.App = AppMock;
global.CustomEvent = class {};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Undo Completion Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // 1. stageTaskCompletion() does not call completeTask() before delay
    (function testDelay() {
        console.log('Test 1: stageTaskCompletion() does not call onCommit before delay');
        let committed = false;
        Storage.stageTaskCompletion('task1', 5000, () => { committed = true; });

        advanceTime(4999);
        if (committed) throw new Error('Task committed too early');

        advanceTime(1);
        if (!committed) throw new Error('Task not committed after delay');
        console.log('  Passed');
    })();

    // 2. stageTaskCompletion() calls the onCommit callback after delay
    (function testOnCommit() {
        console.log('Test 2: stageTaskCompletion() calls the onCommit callback after delay');
        let committed = false;
        Storage.stageTaskCompletion('task2', 5000, () => { committed = true; });

        advanceTime(5000);
        if (!committed) throw new Error('Task not committed after delay');
        console.log('  Passed');
    })();

    // 3. Cancel function prevents onCommit from firing
    (function testCancel() {
        console.log('Test 3: Cancel function prevents onCommit from firing');
        let committed = false;
        const cancelFn = Storage.stageTaskCompletion('task3', 5000, () => { committed = true; });

        advanceTime(2500);
        const cancelled = cancelFn();
        if (!cancelled) throw new Error('cancelFn should return true');

        advanceTime(3000);
        if (committed) throw new Error('Task committed after cancellation');
        console.log('  Passed');
    })();

    // 4. Second stageTaskCompletion() for same task cancels the first
    (function testOverride() {
        console.log('Test 4: Second stageTaskCompletion() for same task cancels the first');
        let committed1 = false;
        let committed2 = false;

        Storage.stageTaskCompletion('task4', 5000, () => { committed1 = true; });
        advanceTime(1000);
        Storage.stageTaskCompletion('task4', 5000, () => { committed2 = true; });

        advanceTime(4500); // 5500 from start
        if (committed1) throw new Error('First completion should have been cancelled');
        if (committed2) throw new Error('Second completion committed too early');

        advanceTime(1000); // 6500 from start
        if (!committed2) throw new Error('Second completion not committed');
        console.log('  Passed');
    })();

    // 5. hasPendingCompletion() returns true during pending window, false after
    (function testHasPending() {
        console.log('Test 5: hasPendingCompletion() returns true during pending window, false after');

        if (Storage.hasPendingCompletion('task5')) throw new Error('Should not have pending completion initially');

        Storage.stageTaskCompletion('task5', 5000, () => {});
        if (!Storage.hasPendingCompletion('task5')) throw new Error('Should have pending completion');

        advanceTime(5000);
        if (Storage.hasPendingCompletion('task5')) throw new Error('Should not have pending completion after delay');
        console.log('  Passed');
    })();

    console.log('\nAll Undo Completion tests passed!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
