
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
global.CustomEvent = class {};

// Load Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runBenchmark() {
    console.log('--- Bolt Benchmark: Storage.getStats() ---');

    const numTasks = 1000;
    const numSessions = 20000; // Increased to see more impact
    const tasks = [];
    const sessions = [];

    const now = new Date();
    now.setHours(12, 0, 0, 0); // Noon to avoid midnight edge cases in randomization
    const todayStr = Storage.formatDate(now);

    for (let i = 0; i < numTasks; i++) {
        const completed = i % 2 === 0;
        const timeOffset = Math.random() * 400 * 24 * 60 * 60 * 1000; // Some older than 1 year
        tasks.push({
            id: 'task_' + i,
            title: 'Task ' + i,
            type: i % 5 === 0 ? 'repeating' : 'one-time',
            dueDate: Storage.formatDate(new Date(now.getTime() - timeOffset)),
            completed: completed,
            completedAt: completed ? new Date(now.getTime() - timeOffset).toISOString() : null,
            subject: 'Math',
            repeatDays: [1, 2, 3, 4, 5]
        });
    }

    // Sessions MUST be chronological for realistic app behavior
    for (let i = 0; i < numSessions; i++) {
        // Spread 20000 sessions over 500 days, chronologically
        const timeOffset = (numSessions - i) * (500 / numSessions) * 24 * 60 * 60 * 1000;
        sessions.push({
            id: 'sess_' + i,
            duration: 25,
            type: 'work',
            completedAt: new Date(now.getTime() - timeOffset).toISOString()
        });
    }

    Storage.saveTasks(tasks);
    Storage.saveSessions(sessions);

    console.log(`Dataset: ${numTasks} tasks, ${numSessions} sessions (chronological)`);

    // Warm up
    for (let i = 0; i < 10; i++) Storage.getStats();

    const iterations = 100;
    const start = precisionNow();
    for (let i = 0; i < iterations; i++) {
        Storage.getStats();
    }
    const end = precisionNow();
    const totalDuration = end - start;
    const avgDuration = totalDuration / iterations;

    console.log(`Average getStats() duration: ${avgDuration.toFixed(4)}ms`);
}

function precisionNow() {
    const hrTime = process.hrtime();
    return hrTime[0] * 1000 + hrTime[1] / 1000000;
}

runBenchmark();
