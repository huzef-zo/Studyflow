
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
global.sessionStorage = localStorageMock; // good enough
global.window = {
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    addEventListener: () => {},
    dispatchEvent: () => {}
};
global.CustomEvent = class {};

// Load Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runBenchmark() {
    console.log('Benchmarking Storage.getStats()...');

    // Setup large dataset
    const numTasks = 1000;
    const numSessions = 2000;
    const tasks = [];
    const sessions = [];

    const now = new Date();
    const todayStr = Storage.formatDate(now);

    for (let i = 0; i < numTasks; i++) {
        const completed = i % 2 === 0;
        tasks.push({
            id: 'task_' + i,
            title: 'Task ' + i,
            type: i % 5 === 0 ? 'repeating' : 'one-time',
            dueDate: '2024-05-20',
            completed: completed,
            completedAt: completed ? new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : null,
            subject: 'Math',
            repeatDays: [1, 2, 3, 4, 5]
        });
    }

    for (let i = 0; i < numSessions; i++) {
        sessions.push({
            id: 'sess_' + i,
            duration: 25,
            type: 'work',
            completedAt: new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        });
    }

    Storage.saveTasks(tasks);
    Storage.saveSessions(sessions);

    // Warm up
    for (let i = 0; i < 5; i++) Storage.getStats();

    const start = Date.now();
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
        Storage.getStats();
    }
    const end = Date.now();
    const avgDuration = (end - start) / iterations;

    console.log(`Average getStats() duration: ${avgDuration.toFixed(2)}ms (over ${iterations} iterations)`);
}

runBenchmark();
