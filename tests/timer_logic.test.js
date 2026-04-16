
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
    AudioContext: function() {},
    webkitAudioContext: function() {},
    localStorage: localStorageMock
};
global.Date.now = () => 1000000000;

const AppMock = {
    hexToRgb: (hex) => '0,0,0',
    escapeHtml: (text) => text,
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

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

function runTests() {
    console.log('Running Timer Logic Tests...');

    if (!Storage) {
        throw new Error('Storage module failed to load');
    }

    // Test Case A: N=1
    (function testN1() {
        console.log('Test Case A: N=1 case');
        Storage.clearAllData();
        Storage.updateSetting('work_duration', 25);
        Storage.updateSetting('short_break', 5);
        Storage.updateSetting('long_break', 15);
        Storage.updateSetting('sessions_until_long_break', 1);

        let state = {
            type: 'work',
            sessionsInCycle: 0,
            selectedTaskId: null,
            selectedSubtaskId: null
        };

        // Complete 1st work cycle
        state = Storage.completeTimerSession(state, true);

        if (state.type !== 'long_break') throw new Error(`Expected long_break for N=1 after 1 cycle, got ${state.type}`);
        if (state.sessionsInCycle !== 1) throw new Error(`Expected sessionsInCycle to be 1, got ${state.sessionsInCycle}`);

        const sessions = Storage.getSessions();
        const completedSessions = sessions.filter(s => s.type === 'session_complete');
        if (completedSessions.length !== 1) throw new Error(`Expected 1 completed session, got ${completedSessions.length}`);

        console.log('  Passed: N=1 transitions correctly to long_break and increments session.');
    })();

    // Test Case B: N=2
    (function testN2() {
        console.log('Test Case B: N=2 case');
        Storage.clearAllData();
        Storage.updateSetting('work_duration', 25);
        Storage.updateSetting('short_break', 5);
        Storage.updateSetting('long_break', 15);
        Storage.updateSetting('sessions_until_long_break', 2);

        let state = {
            type: 'work',
            sessionsInCycle: 0
        };

        // 1st Cycle
        state = Storage.completeTimerSession(state, true);
        if (state.type !== 'short_break') throw new Error(`Expected short_break after 1st cycle of N=2, got ${state.type}`);
        if (state.sessionsInCycle !== 1) throw new Error(`Expected sessionsInCycle 1, got ${state.sessionsInCycle}`);

        let sessions = Storage.getSessions();
        if (sessions.filter(s => s.type === 'session_complete').length !== 0) throw new Error('Session should not be complete yet');

        // Transition back to work (e.g. from break)
        state.type = 'short_break'; // simulate being in break
        state = Storage.completeTimerSession(state, false); // finish break
        if (state.type !== 'work') throw new Error(`Expected transition to work after break, got ${state.type}`);

        // 2nd Cycle
        state = Storage.completeTimerSession(state, true);
        if (state.type !== 'long_break') throw new Error(`Expected long_break after 2nd cycle of N=2, got ${state.type}`);
        if (state.sessionsInCycle !== 2) throw new Error(`Expected sessionsInCycle 2, got ${state.sessionsInCycle}`);

        sessions = Storage.getSessions();
        if (sessions.filter(s => s.type === 'session_complete').length !== 1) throw new Error('Expected 1 completed session');

        console.log('  Passed: N=2 transitions correctly and increments session only after N cycles.');
    })();

    // Test Case C: pause/skip mid-cycle
    (function testSkip() {
        console.log('Test Case C: pause/skip mid-cycle');
        Storage.clearAllData();
        Storage.updateSetting('sessions_until_long_break', 2);

        let state = {
            type: 'work',
            sessionsInCycle: 0
        };

        // Skip 1st cycle
        console.log('Skipping 1st cycle...');
        // Clear sessions before skip to be sure
        localStorage.setItem('studyflow_sessions', '[]');
        state = Storage.completeTimerSession(state, false);
        console.log('State after skip:', state);
        if (state.sessionsInCycle !== 1) throw new Error('SessionsInCycle should increment on skip');
        if (state.type !== 'short_break') throw new Error('Should go to short break');

        const sessions = Storage.getSessions();
        const workSessions = sessions.filter(s => s.type === 'work');
        if (workSessions.length !== 0) {
            console.log('Work sessions found:', workSessions);
            throw new Error('Should not record work duration on skip');
        }

        console.log('  Passed: Skip advances state without recording duration.');
    })();

    // Test Case D: mid-flow settings change
    (function testMidFlowSettingsChange() {
        console.log('Test Case D: mid-flow settings change');
        Storage.clearAllData();
        Storage.updateSetting('sessions_until_long_break', 2);

        let state = {
            type: 'work',
            sessionsInCycle: 0
        };

        // Complete 1 cycle
        state = Storage.completeTimerSession(state, true);

        // Mid-flow change N from 2 to 3
        Storage.updateSetting('sessions_until_long_break', 3);

        // Transition back to work
        state.type = 'short_break';
        state = Storage.completeTimerSession(state, false);

        // Complete 2nd cycle
        state = Storage.completeTimerSession(state, true);

        // Should be at short_break because N is now 3
        if (state.type !== 'short_break') throw new Error(`Expected short_break after 2nd cycle with new N=3, got ${state.type}`);

        console.log('  Passed: Settings changes are respected mid-flow.');
    })();

    console.log('\nAll tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
