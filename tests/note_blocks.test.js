const assert = require('assert');

// Mock localStorage and window DOM environment for Node testing
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
const Blocks = require('../js/blocks.js');

console.log('--- Starting Note Block Migration & Storage Tests ---');

// Setup flat notes in storage
const flatNotes = [
  {
    id: 'note_1',
    title: 'Flat Note 1',
    content: 'First line\nSecond line\nThird line',
    subject: 'Math',
    updatedAt: new Date().toISOString()
  }
];

Storage.saveData(Storage.KEYS.NOTES, flatNotes);

// Run migration logic (simulated from Notes.migrateFlatNotes)
const loaded = Storage.loadData(Storage.KEYS.NOTES, []);
const migrated = loaded.map(note => {
  if (!note.blocks || !Array.isArray(note.blocks)) {
    const textContent = note.content || '';
    const lines = textContent.split('\n').filter(Boolean);
    const blocks = lines.length > 0
      ? lines.map(line => Blocks.createBlock('paragraph', line))
      : [Blocks.createBlock('paragraph', '')];

    return {
      ...note,
      blocks: blocks
    };
  }
  return note;
});

Storage.saveData(Storage.KEYS.NOTES, migrated);

const reloaded = Storage.loadData(Storage.KEYS.NOTES, []);
assert.strictEqual(reloaded.length, 1);
assert.strictEqual(reloaded[0].blocks.length, 3);
assert.strictEqual(reloaded[0].blocks[0].content, 'First line');
assert.strictEqual(reloaded[0].blocks[1].content, 'Second line');
assert.strictEqual(reloaded[0].blocks[2].content, 'Third line');

console.log('✅ Note block migration test passed successfully');
