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

// Track dispatched events
let dispatchedEvents = [];

global.window = {
    localStorage: localStorageMock,
    addEventListener: function() {},
    dispatchEvent: function(event) {
        dispatchedEvents.push(event.type);
        return true;
    }
};

// Mock CustomEvent
global.CustomEvent = class CustomEvent {
    constructor(type, options) {
        this.type = type;
        this.detail = options?.detail || {};
    }
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
    console.log('Running Event Dispatch Verification Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // Test Case: Event dispatched on addTask
    (function testAddTaskEvent() {
        console.log('\nTest Case: Event dispatched on addTask');
        dispatchedEvents = [];
        Storage.clearAllData();

        Storage.addTask({ title: 'Test Task', dueDate: '2024-01-01' });

        if (!dispatchedEvents.includes('studyflow_taskDataChanged')) {
            throw new Error('Expected studyflow_taskDataChanged event to be dispatched on addTask');
        }
        console.log('  Passed: Event dispatched on addTask');
    })();

    // Test Case: Event dispatched on updateTask
    (function testUpdateTaskEvent() {
        console.log('\nTest Case: Event dispatched on updateTask');
        dispatchedEvents = [];
        const tasks = Storage.getTasks();
        if (tasks.length > 0) {
            Storage.updateTask(tasks[0].id, { title: 'Updated Title' });
            if (!dispatchedEvents.includes('studyflow_taskDataChanged')) {
                throw new Error('Expected studyflow_taskDataChanged event to be dispatched on updateTask');
            }
            console.log('  Passed: Event dispatched on updateTask');
        }
    })();

    // Test Case: Event dispatched on deleteTask
    (function testDeleteTaskEvent() {
        console.log('\nTest Case: Event dispatched on deleteTask');
        dispatchedEvents = [];
        const tasks = Storage.getTasks();
        if (tasks.length > 0) {
            Storage.deleteTask(tasks[0].id);
            if (!dispatchedEvents.includes('studyflow_taskDataChanged')) {
                throw new Error('Expected studyflow_taskDataChanged event to be dispatched on deleteTask');
            }
            console.log('  Passed: Event dispatched on deleteTask');
        }
    })();

    console.log('\nEvent dispatch verification tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
