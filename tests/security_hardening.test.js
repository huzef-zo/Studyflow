
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
const mockWindow = {
    dispatchEvent: () => {},
    addEventListener: () => {}
};
const mockLocalStorage = {
    getItem: (key) => mockLocalStorage.data[key] || null,
    setItem: (key, val) => { mockLocalStorage.data[key] = val; },
    removeItem: (key) => { delete mockLocalStorage.data[key]; },
    data: {}
};
const mockSessionStorage = {
    getItem: () => null,
    setItem: () => {}
};

const context = {
    window: mockWindow,
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    console: {
        error: () => {},
        log: () => {},
        warn: () => {}
    },
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
        addEventListener: () => {},
        body: { appendChild: () => {} }
    }
};

const storageCode = fs.readFileSync('./js/storage.js', 'utf8');
const appCode = fs.readFileSync('./js/app.js', 'utf8');

// Load Storage
(function() { with(this) { eval(storageCode); } }).call(context);
const Storage = context.window.Storage;

// Load App
(function() { with(this) { eval(appCode); } }).call(context);
const App = context.window.App;

console.log('--- Starting Security Hardening Tests ---');

// Test 1: App.createModal XSS prevention
console.log('Test 1: App.createModal escapes titleId');
const xssPayload = '"><script>alert(1)</script>';
const modal = App.createModal({ title: 'Test', id: xssPayload, content: '' });
assert.ok(!modal.innerHTML.includes(xssPayload), 'XSS payload should be escaped in innerHTML');
assert.ok(modal.innerHTML.includes('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;-title'), 'Payload should be escaped');
console.log('✅ Test 1 Passed');

// Test 2: Storage.updateSetting Prototype Pollution
console.log('Test 2: Storage.updateSetting blocks prototype pollution');
Storage.updateSetting('__proto__', { polluted: true });
assert.strictEqual({}.polluted, undefined, 'Prototype should not be polluted');
console.log('✅ Test 2 Passed');

// Test 3: Storage.updateSetting Key Whitelisting
console.log('Test 3: Storage.updateSetting blocks unknown keys');
Storage.updateSetting('unknown_key', 'some value');
const settings = Storage.getSettings();
assert.strictEqual(settings.unknown_key, undefined, 'Unknown key should not be added to settings');
console.log('✅ Test 3 Passed');

// Test 4: Storage.updateSetting pinned_nav_items validation
console.log('Test 4: Storage.updateSetting validates pinned_nav_items');
Storage.updateSetting('pinned_nav_items', ['timer', 'invalid', 'calendar', 'notes']);
const settingsAfter = Storage.getSettings();
assert.deepStrictEqual(settingsAfter.pinned_nav_items, ['timer', 'calendar'], 'Should only allow 2 valid nav items');
console.log('✅ Test 4 Passed');

// Test 5: Storage.importData validation
console.log('Test 5: Storage.importData validates settings');
const malformedData = {
    settings: {
        pinned_nav_items: ['history', 'settings', 'timer'],
        work_duration: 'not-a-number'
    }
};
Storage.importData(malformedData);
const importedSettings = Storage.getSettings();
assert.deepStrictEqual(importedSettings.pinned_nav_items, ['history', 'settings'], 'Imported nav items should be capped at 2');
assert.ok(!isNaN(importedSettings.work_duration), 'Imported numeric settings should be numbers');
console.log('✅ Test 5 Passed');

console.log('--- All Security Hardening Tests Passed ---');
