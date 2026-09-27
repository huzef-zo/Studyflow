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

console.log('--- Starting Page Hierarchy & Metadata Verification Tests ---');

const pages = [
  {
    id: 'page_1',
    parentId: null,
    title: 'Root Page',
    icon: '📚',
    coverColor: 'linear-gradient(135deg, #3B82F6, #1E40AF)',
    isExpanded: true
  },
  {
    id: 'page_2',
    parentId: 'page_1',
    title: 'Sub Page 1',
    icon: '📝',
    coverColor: 'linear-gradient(135deg, #10B981, #065F46)',
    isExpanded: true
  }
];

Storage.saveData(Storage.KEYS.NOTES, pages);

const loadedPages = Storage.loadData(Storage.KEYS.NOTES, []);
assert.strictEqual(loadedPages.length, 2);

const root = loadedPages.find(p => p.id === 'page_1');
const sub = loadedPages.find(p => p.id === 'page_2');

assert.strictEqual(root.parentId, null);
assert.strictEqual(sub.parentId, 'page_1');
assert.strictEqual(root.icon, '📚');
assert.strictEqual(sub.icon, '📝');
assert(sub.coverColor.includes('#10B981'));

console.log('✅ Page hierarchy and metadata verification test passed successfully');
