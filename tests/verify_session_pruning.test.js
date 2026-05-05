
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

// Mock sessionStorage
const sessionStorageStore = {};
const sessionStorageMock = {
    getItem: (key) => sessionStorageStore[key] || null,
    setItem: (key, value) => { sessionStorageStore[key] = value.toString(); },
    removeItem: (key) => { delete sessionStorageStore[key]; },
    clear: () => { Object.keys(sessionStorageStore).forEach(key => delete sessionStorageStore[key]); }
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

const AppMock = {
    escapeHtml: (text) => text,
    showToast: () => {}
};
global.App = AppMock;

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Session Pruning Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0); // Noon today
    const todayStr = Storage.formatDate(today);

    // Test Case 1: Basic Pruning
    (function testPruning() {
        console.log('Test Case 1: Basic Pruning (500 sessions over 400 days)');
        Storage.clearAllData();
        sessionStorage.clear();

        const sessions = [];
        // Add 500 sessions, one every 19.2 hours (~400 days total)
        for (let i = 0; i < 500; i++) {
            const date = new Date(today);
            date.setHours(today.getHours() - (i * 19));
            sessions.push({
                id: 's_' + i,
                duration: 25,
                type: 'work',
                completedAt: date.toISOString()
            });
        }
        Storage.saveSessions(sessions);

        const initialCount = Storage.getSessions().length;
        if (initialCount !== 500) throw new Error(`Expected 500 sessions, got ${initialCount}`);

        const removed = Storage.pruneSessions(365);
        const remaining = Storage.getSessions();

        console.log(`  Removed: ${removed}, Remaining: ${remaining.length}`);

        if (removed === 0) throw new Error('Expected some sessions to be removed');

        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - 365);
        cutoff.setHours(0, 0, 0, 0);

        remaining.forEach(s => {
            if (new Date(s.completedAt) < cutoff) {
                throw new Error(`Session ${s.id} at ${s.completedAt} should have been pruned (cutoff: ${cutoff.toISOString()})`);
            }
        });

        console.log('  Passed: Pruned old sessions correctly.');
    })();

    // Test Case 2: sessionStorage Guard
    (function testGuard() {
        console.log('Test Case 2: sessionStorage Guard');
        // Sessions were already pruned in previous test, but let's add an old one and try to prune again
        const sessions = Storage.getSessions();
        const oldDate = new Date(today);
        oldDate.setDate(oldDate.getDate() - 400);
        sessions.push({ id: 'old_1', duration: 25, type: 'work', completedAt: oldDate.toISOString() });
        Storage.saveSessions(sessions);

        const countBefore = Storage.getSessions().length;
        const removed = Storage.pruneSessions(365);
        const countAfter = Storage.getSessions().length;

        if (removed !== 0 || countBefore !== countAfter) {
            throw new Error(`Expected no pruning due to guard, but removed ${removed}`);
        }
        console.log('  Passed: sessionStorage guard prevented double pruning.');
    })();

    // Test Case 3: Malformed Data
    (function testMalformed() {
        console.log('Test Case 3: Malformed Data');
        Storage.clearAllData();
        sessionStorage.clear();

        const sessions = [
            { id: 'good_1', duration: 25, type: 'work', completedAt: today.toISOString() },
            { id: 'bad_1', duration: 25, type: 'work' }, // missing completedAt
            { id: 'bad_2', duration: 25, type: 'work', completedAt: null },
            { id: 'bad_3', duration: 25, type: 'work', completedAt: '' }
        ];
        Storage.saveSessions(sessions);

        const removed = Storage.pruneSessions(365);
        const remaining = Storage.getSessions();

        if (remaining.length !== 1 || remaining[0].id !== 'good_1') {
            throw new Error(`Expected 1 good session, got ${remaining.length}`);
        }
        if (removed !== 3) throw new Error(`Expected 3 removed malformed sessions, got ${removed}`);

        console.log('  Passed: Malformed sessions were correctly pruned.');
    })();

    // Test Case 4: Stats Impact
    (function testStats() {
        console.log('Test Case 4: Stats Impact');
        Storage.clearAllData();
        sessionStorage.clear();

        // Add 10 sessions today
        for (let i = 0; i < 10; i++) {
            Storage.addSession(25, 'work');
        }
        // Add 1 session yesterday (should be in same week if today is not Monday)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const sessions = Storage.getSessions();
        sessions.push({ id: 'old_work', duration: 25, type: 'work', completedAt: yesterday.toISOString() });
        Storage.saveSessions(sessions);

        const stats = Storage.getStats();
        if (stats.sessions.today !== 10) throw new Error(`Expected 10 today sessions, got ${stats.sessions.today}`);
        if (stats.sessions.minutesToday !== 250) throw new Error(`Expected 250 today minutes, got ${stats.sessions.minutesToday}`);

        // Total minutes today helper
        const minsToday = Storage.getTotalMinutesToday();
        if (minsToday !== 250) throw new Error(`getTotalMinutesToday: Expected 250, got ${minsToday}`);

        // Total minutes week helper (includes the one from 2 days ago)
        const minsWeek = Storage.getTotalMinutesWeek();
        if (minsWeek !== 275) throw new Error(`getTotalMinutesWeek: Expected 275, got ${minsWeek}`);

        console.log('  Passed: Stats remain accurate with the new getSessionsSince optimization.');
    })();

    console.log('\nAll Session Pruning tests passed!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
