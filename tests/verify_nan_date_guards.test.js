/**
 * Test suite verifying NaN, non-finite values, and Invalid Date safety guards.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock localStorage and window environment for Node execution
if (typeof window === 'undefined') {
  global.window = {
    location: { href: '', search: '', pathname: '/' },
    addEventListener: () => {},
    dispatchEvent: () => {}
  };
}

const localStorageMap = {};
global.localStorage = {
  getItem: (key) => localStorageMap[key] || null,
  setItem: (key, val) => { localStorageMap[key] = String(val); },
  removeItem: (key) => { delete localStorageMap[key]; },
  clear: () => { Object.keys(localStorageMap).forEach(k => delete localStorageMap[k]); }
};

global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Evaluate storage.js and app.js into context
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
eval(appCode);

const Storage = global.Storage || window.Storage;
const App = global.App || window.App;

console.log('Running NaN & Date Guards Verification Tests...');

// --- Test 1: App.formatDuration ---
console.log('Test 1: App.formatDuration handles NaN, null, undefined, negative, and non-finite values');
assert.strictEqual(App.formatDuration(0), '0m');
assert.strictEqual(App.formatDuration(NaN), '0m');
assert.strictEqual(App.formatDuration(null), '0m');
assert.strictEqual(App.formatDuration(undefined), '0m');
assert.strictEqual(App.formatDuration(-15), '0m');
assert.strictEqual(App.formatDuration(25), '25m');
assert.strictEqual(App.formatDuration(60), '1h');
assert.strictEqual(App.formatDuration(90), '1h 30m');
console.log('  Passed: App.formatDuration verified.');

// --- Test 2: Storage.formatDisplayDate ---
console.log('Test 2: Storage.formatDisplayDate handles invalid/empty date strings safely');
assert.strictEqual(Storage.formatDisplayDate(null), 'No date');
assert.strictEqual(Storage.formatDisplayDate(''), 'No date');
assert.strictEqual(Storage.formatDisplayDate('invalid-date-string'), 'No date');
assert.strictEqual(Storage.formatDisplayDate('2026-09-29'), 'Tue, Sep 29');
console.log('  Passed: Storage.formatDisplayDate verified.');

// --- Test 3: App.createProgressBar ---
console.log('Test 3: App.createProgressBar handles zero max, NaN, and negative values');
const pb1 = App.createProgressBar(0, 0, 'Test');
assert.ok(pb1.includes('0 / 0'), 'Should render 0 / 0');
assert.ok(pb1.includes('(0%)'), 'Should render (0%)');

const pb2 = App.createProgressBar(NaN, NaN, 'Test');
assert.ok(pb2.includes('0 / 0'), 'Should fallback NaN to 0 / 0');

const pb3 = App.createProgressBar(5, 10, 'Test');
assert.ok(pb3.includes('5 / 10 (50%)'), 'Should compute 50% correctly');
console.log('  Passed: App.createProgressBar verified.');

console.log('All NaN & Date Safety Guard Tests Passed!');
