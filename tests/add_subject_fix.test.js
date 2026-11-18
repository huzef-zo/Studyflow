/**
 * Tests for Subject creation and settings modal behavior.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage
global.localStorage = {
  _data: {},
  setItem(k, v) { this._data[k] = String(v); },
  getItem(k) { return this._data[k] || null; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

// Mock window and document for Storage module execution
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

// Load Storage
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const Storage = eval(storageCode + '; Storage;');

console.log('--- Testing Subject Creation & Modal Safety ---');

// 1. Test Storage.addSubject
const initialSubjects = Storage.getSubjects();
const newSub = Storage.addSubject('Neuroscience', '#8B5CF6', 15);
assert.strictEqual(newSub.name, 'Neuroscience');
assert.strictEqual(newSub.color, '#8B5CF6');
assert.strictEqual(newSub.targetHours, 15);

const updatedSubjects = Storage.getSubjects();
assert.strictEqual(updatedSubjects.length, initialSubjects.length + 1);
const found = updatedSubjects.find(s => s.id === newSub.id);
assert.ok(found);
assert.strictEqual(found.name, 'Neuroscience');

// 2. Test openSubjectModal template expression evaluation with existing = null
const settingsHtml = fs.readFileSync(path.join(__dirname, '../settings.html'), 'utf8');

// Test that openSubjectModal does not access `.targetHours` on `existing` directly when `existing` is null
assert.ok(!settingsHtml.includes('${existing.targetHours'), 'settings.html should not perform unsafe property access on existing');
assert.ok(settingsHtml.includes('${existing?.targetHours || 10}'), 'settings.html should use optional chaining existing?.targetHours');

// Evaluate the template string logic directly with existing = null
const existing = null;
let evalSucceeded = false;
try {
  const targetHoursValue = `${existing?.targetHours || 10}`;
  assert.strictEqual(targetHoursValue, '10');
  evalSucceeded = true;
} catch (err) {
  evalSucceeded = false;
}
assert.ok(evalSucceeded, 'Template evaluation with existing = null should succeed');

console.log('--- ALL SUBJECT CREATION & MODAL TESTS PASSED ---');
