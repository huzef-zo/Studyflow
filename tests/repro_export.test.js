
const fs = require('fs');
const path = require('path');

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: function(key) {
      return store[key] || null;
    },
    setItem: function(key, value) {
      store[key] = value.toString();
    },
    clear: function() {
      store = {};
    },
    removeItem: function(key) {
      delete store[key];
    },
    hasOwnProperty: function(key) {
        return key in store;
    }
  };
})();

global.localStorage = localStorageMock;
global.window = {
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { reload: () => {} }
};
global.CustomEvent = class {};
global.sessionStorage = {
    getItem: () => null,
    setItem: () => {}
};

// Load storage.js
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

// Set up some data
const testHabit = {
    id: 'habit_1',
    title: 'Test Habit',
    completions: { '2023-10-01': true }
};
Storage.saveData(Storage.KEYS.HABITS, [testHabit]);
Storage.saveData(Storage.KEYS.THEME, 'emerald');

try {
    const exported = Storage.exportData();
    console.log('Exported keys:', Object.keys(exported).length);

    // Check key keys
    const expectedKeys = ['habits', 'theme', 'flashcards', 'achievements', 'xpState'];
    expectedKeys.forEach(k => {
        if (!(k in exported)) throw new Error(`Missing key in export: ${k}`);
    });

    if (exported.theme !== 'emerald') throw new Error('Theme not exported correctly');
    if (exported.habits[0].completions['2023-10-01'] !== true) throw new Error('Habit completions not exported correctly');

    // Test Import
    localStorageMock.clear();
    const importResult = Storage.importData(exported);
    if (!importResult) throw new Error('Import failed');

    const importedHabits = Storage.getHabits();
    if (importedHabits[0].completions['2023-10-01'] !== true) throw new Error('Habit completions not imported correctly');

    const importedTheme = Storage.getTheme();
    if (importedTheme !== 'emerald') throw new Error('Theme not imported correctly');

    console.log('Verification successful!');
} catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
}
