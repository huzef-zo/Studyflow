
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

// Mock DOM
const elementMocks = {};
function createMockElement(id) {
    return {
        id: id,
        textContent: '',
        style: {},
        setAttribute: function(name, value) {
            this[name] = value;
        },
        classList: {
            remove: () => {},
            add: () => {}
        },
        addEventListener: () => {}
    };
}

global.document = {
    getElementById: (id) => {
        if (!elementMocks[id]) {
            elementMocks[id] = createMockElement(id);
        }
        return elementMocks[id];
    }
};

global.window = {
    localStorage: localStorageMock,
    document: global.document
};

// Mock Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;
global.Storage = Storage;

// Mock App
global.App = {
    escapeHtml: (text) => text,
    createProgressBar: () => '',
    createEmptyStateHtml: () => '',
    createModal: () => ({ querySelector: () => ({ addEventListener: () => {} }), addEventListener: () => {} }),
    openModal: () => {},
    closeModal: () => {},
    showToast: () => {},
    getFormData: () => ({})
};

// Load Goals module
const goalsCode = fs.readFileSync(path.join(__dirname, '../js/goals.js'), 'utf8');
eval(goalsCode);
const Goals = global.window.Goals;

function runTests() {
    console.log('Running Goals Logic Verification Tests...');

    if (!Goals) {
        throw new Error('Goals module failed to load');
    }

    // Test Case: Donut update
    (function testDonutUpdate() {
        console.log('Test Case: Donut chart update');

        Storage.clearAllData();

        // Mock data in storage
        const mockGoals = {
            weekly_tasks: 10,
            weekly_hours: 20,
            daily_tasks: 2,
            daily_hours: 3,
            week_start: Storage.getWeekStart(new Date()).toISOString()
        };
        Storage.saveData(Storage.KEYS.GOALS, mockGoals);

        const mockTasks = [
            { id: '1', completed: true, completedAt: new Date().toISOString() },
            { id: '2', completed: true, completedAt: new Date().toISOString() },
            { id: '3', completed: true, completedAt: new Date().toISOString() }
        ];
        Storage.saveTasks(mockTasks);

        const mockSessions = [
            { type: 'work', duration: 60, completedAt: new Date().toISOString() }, // 1h
            { type: 'work', duration: 120, completedAt: new Date().toISOString() }, // 2h
            { type: 'work', duration: 96, completedAt: new Date().toISOString() }  // 1.6h
            // Total 4.6h
        ];
        Storage.saveSessions(mockSessions);

        Goals.init();
        Goals.updateGoalsDisplay();

        const tasksDonut = elementMocks['tasks-donut-fill'];
        const hoursDonut = elementMocks['hours-donut-fill'];

        // 3/10 = 30%
        if (tasksDonut['stroke-dasharray'] !== '30, 100') {
            throw new Error(`Expected tasks donut stroke-dasharray to be '30, 100', got ${tasksDonut['stroke-dasharray']}`);
        }

        // 4.6/20 = 23%
        if (hoursDonut['stroke-dasharray'] !== '23, 100') {
            throw new Error(`Expected hours donut stroke-dasharray to be '23, 100', got ${hoursDonut['stroke-dasharray']}`);
        }

        console.log('  Passed: Donut charts updated with correct stroke-dasharray values.');
    })();

    console.log('\nGoals verification tests passed successfully!');
}

try {
    runTests();
} catch (e) {
    console.error('\nTest failed!');
    console.error(e.stack || e.message);
    process.exit(1);
}
