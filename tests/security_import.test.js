const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock localStorage
global.localStorage = {
  _data: {},
  setItem(k, v) { this._data[k] = v; },
  getItem(k) { return this._data[k] || null; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

// Mock window and document
global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  location: { reload: () => {} }
};
global.document = {
  addEventListener: () => {}
};
global.CustomEvent = class {
  constructor(name, detail) { this.name = name; this.detail = detail; }
};
global.sessionStorage = {
    getItem: () => null,
    setItem: () => {}
};

// Load storage.js
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const Storage = eval(storageCode + '; Storage;');

console.log('--- Testing importData Hardening ---');

// Test 1: Property Injection Blocking (existing test)
const maliciousData = {
  user: {
    name: 'Normal Name',
    maliciousProperty: 'should be blocked'
  }
};

Storage.importData(maliciousData);
const user = Storage.getUser();
console.log('Imported User:', JSON.stringify(user, null, 2));

const isHardened = !user.hasOwnProperty('maliciousProperty');
assert.ok(isHardened, 'Malicious property should be blocked');
console.log('Result: SECURE - Malicious property was blocked.');

// Test 2: Input Length Truncation (DoS prevention)
console.log('\n--- Test 2: Text Length Truncation ---');
const extremelyLongName = 'A'.repeat(500);
const extremelyLongTitle = 'B'.repeat(500);
const extremelyLongContent = 'C'.repeat(20000);

const longTextFieldsData = {
  user: {
    name: extremelyLongName,
    email: 'test@example.com'
  },
  notes: [
    {
      id: 'note_long_test',
      title: extremelyLongTitle,
      content: extremelyLongContent,
      subject: 'Other'
    }
  ]
};

Storage.importData(longTextFieldsData);
const updatedUser = Storage.getUser();
const importedNotes = Storage.getNotes();
const note = importedNotes.find(n => n.id === 'note_long_test');

assert.strictEqual(updatedUser.name.length, 100, 'User name should be truncated to 100 chars');
assert.ok(note, 'Note should be imported');
assert.strictEqual(note.title.length, 200, 'Note title should be truncated to 200 chars');
assert.strictEqual(note.content.length, 10000, 'Note content should be truncated to 10000 chars');
console.log('✅ Test 2 Passed: Extremely long text inputs were truncated.');

// Test 3: Array Size Bounds (DoS prevention)
console.log('\n--- Test 3: Array Size Bounds Capping ---');
const oversizedTasks = [];
for (let i = 0; i < 1500; i++) {
  oversizedTasks.push({
    id: `task_${i}`,
    title: `Task ${i}`,
    type: 'one-time'
  });
}

const oversizedImportData = {
  tasks: oversizedTasks
};

Storage.importData(oversizedImportData);
const importedTasks = Storage.getTasks();
assert.strictEqual(importedTasks.length, 1000, 'Tasks array should be capped/sliced to max 1000 items');
console.log('✅ Test 3 Passed: Oversized task array was capped at 1000.');

// Test 4: Theme Whitelist Validation
console.log('\n--- Test 4: Theme Validation ---');
const originalTheme = Storage.getTheme();

// Import with invalid theme
const invalidThemeData = {
  theme: 'malicious-theme-injection'
};
Storage.importData(invalidThemeData);
assert.strictEqual(Storage.getTheme(), originalTheme, 'Invalid theme should be rejected and original theme preserved');

// Import with valid theme
const validThemeData = {
  theme: 'emerald'
};
Storage.importData(validThemeData);
assert.strictEqual(Storage.getTheme(), 'emerald', 'Valid theme "emerald" should be successfully imported');
console.log('✅ Test 4 Passed: Only whitelisted themes are accepted.');

console.log('\nResult: ALL IMPORT SECURITY TESTS PASSED');
