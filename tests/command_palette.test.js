const assert = require('assert');

if (typeof localStorage === 'undefined' || localStorage === null) {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

if (typeof window === 'undefined') {
  global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {}
  };
  global.CustomEvent = class CustomEvent { constructor(name, params) { this.name = name; this.params = params; } };
}

require('../js/storage.js');
const Storage = global.window.Storage;

console.log('--- Starting Command Palette Tests ---');

// Mock notes
Storage.saveData(Storage.KEYS.NOTES, [
  { id: 'p1', title: 'Algebra Notes', blocks: [{ content: 'Quadratic equation' }] }
]);

const CommandPalette = require('../js/command-palette.js');
assert(CommandPalette.open !== undefined);

console.log('✅ Command palette verified successfully');
