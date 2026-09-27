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

console.log('--- Starting Cross-Linking & Linked Mentions Tests ---');

const pages = [
  {
    id: 'page_target',
    title: 'Target Physics Page',
    icon: '🔬',
    blocks: [{ id: 'b1', type: 'paragraph', content: 'Physics laws.' }]
  },
  {
    id: 'page_source',
    title: 'Source Math Page',
    icon: '📐',
    blocks: [
      {
        id: 'b2',
        type: 'page_link',
        content: 'Target Physics Page',
        properties: { pageId: 'page_target', pageTitle: 'Target Physics Page' }
      }
    ]
  }
];

Storage.saveData(Storage.KEYS.NOTES, pages);

const loaded = Storage.loadData(Storage.KEYS.NOTES, []);
const target = loaded.find(p => p.id === 'page_target');

// Compute linked mentions for target
const referencing = loaded.filter(p => {
  if (p.id === target.id) return false;
  return p.blocks.some(b => b.type === 'page_link' && b.properties?.pageId === target.id);
});

assert.strictEqual(referencing.length, 1);
assert.strictEqual(referencing[0].id, 'page_source');
assert.strictEqual(referencing[0].title, 'Source Math Page');

console.log('✅ Cross-linking and linked mentions test passed successfully');
