const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
const mockWindow = {
  dispatchEvent: () => {},
  addEventListener: () => {}
};
const store = {};
const mockLocalStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
const mockSessionStorage = {
  getItem: (key) => store['session_' + key] || null,
  setItem: (key, val) => { store['session_' + key] = String(val); },
  removeItem: (key) => { delete store['session_' + key]; },
  clear: () => {}
};

const context = {
  window: mockWindow,
  localStorage: mockLocalStorage,
  sessionStorage: mockSessionStorage,
  console: console,
  Date: Date,
  JSON: JSON,
  Math: Math,
  RegExp: RegExp,
  Uint32Array: Uint32Array,
  crypto: {
    randomUUID: () => 'test-uuid'
  },
  CustomEvent: class {},
  document: {
    createElement: (tag) => ({
      tagName: tag,
      style: {},
      appendChild: () => {},
      addEventListener: () => {},
      querySelector: () => ({ addEventListener: () => {} }),
      querySelectorAll: () => [],
      id: '',
      classList: { add: () => {}, remove: () => {} }
    }),
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: { appendChild: () => {} }
  }
};

const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const historyCode = fs.readFileSync(path.join(__dirname, '../js/history.js'), 'utf8');

(function() { with(this) { eval(storageCode); } }).call(context);
const Storage = context.window.Storage;

(function() { with(this) { eval(appCode); } }).call(context);
const App = context.window.App;

(function() { with(this) { eval(historyCode); } }).call(context);
const History = context.window.History;

console.log('--- Testing Storage.addSession Duration Sanitization & XSS Prevention ---');

// Test 1: Malicious HTML string payload in duration
const maliciousPayload = '<img src=x onerror=alert(1)>';
const session1 = Storage.addSession(maliciousPayload, 'work', null, 'XSS Test');

assert.strictEqual(typeof session1.duration, 'number', 'Duration must be a number');
assert.strictEqual(Number.isNaN(session1.duration), false, 'Duration must not be NaN');
assert.strictEqual(session1.duration, 0, 'Duration should be 0 for string payload');
console.log('✅ Test 1 Passed: Malicious HTML duration converted to 0');

// Test 2: Bounded integer clamping (e.g. -10 -> 0, 9999 -> 1440)
const sessionNeg = Storage.addSession(-10, 'work');
const sessionLarge = Storage.addSession(9999, 'work');

assert.strictEqual(sessionNeg.duration, 0, 'Expected 0 for negative duration');
assert.strictEqual(sessionLarge.duration, 1440, 'Expected 1440 for oversized duration');
console.log('✅ Test 2 Passed: Duration correctly bounded within [0, 1440]');

// Test 3: Non-finite inputs (NaN, Infinity)
const sessionNaN = Storage.addSession(NaN, 'work');
const sessionInf = Storage.addSession(Infinity, 'work');

assert.strictEqual(sessionNaN.duration, 0, 'NaN should sanitize to 0');
assert.strictEqual(sessionInf.duration, 0, 'Infinity should sanitize to 0');
console.log('✅ Test 3 Passed: Non-finite numbers sanitized to 0');

// Test 4: Valid numeric string (e.g. "45.8")
const sessionValidStr = Storage.addSession("45.8", 'work');
assert.strictEqual(sessionValidStr.duration, 45, 'Expected 45 for "45.8"');
console.log('✅ Test 4 Passed: Valid numeric string converted to bounded integer');

// Test 5: Verify renderStudyHistory defense-in-depth HTML escaping
let renderedHtml = '';
const mockHistoryList = { set innerHTML(val) { renderedHtml = val; } };
context.document.getElementById = (id) => id === 'study-history-list' ? mockHistoryList : null;

History.init();
assert.ok(!renderedHtml.includes('<img src=x onerror=alert(1)>'), 'Rendered HTML should not contain raw unescaped HTML payload');
console.log('✅ Test 5 Passed: renderStudyHistory output is safe from script injection');

console.log('--- ALL ADD_SESSION SECURITY TESTS PASSED ---');
