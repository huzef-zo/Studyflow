
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

// Test 6: Storage direct APIs enforce length limits (DoS / Local Storage Exhaustion Prevention)
console.log('Test 6: Storage APIs enforce length limits');
const longText = 'A'.repeat(500);

Storage.updateUserName(longText);
assert.strictEqual(Storage.getUser().name.length, 100, 'User name should be truncated to 100 characters');

Storage.updateUserEmail(longText);
assert.strictEqual(Storage.getUser().email.length, 100, 'User email should be truncated to 100 characters');

const newSub = Storage.addSubject(longText, '#3B82F6');
assert.strictEqual(newSub.name.length, 200, 'Subject name should be truncated to 200 characters');

const newTask = Storage.addTask({
  title: longText,
  subtasks: [{ title: longText }]
});
assert.strictEqual(newTask.title.length, 200, 'Task title should be truncated to 200 characters');
assert.strictEqual(newTask.subtasks[0].title.length, 200, 'Subtask title should be truncated to 200 characters');
console.log('✅ Test 6 Passed');

// Test 7: Storage new APIs and centralized saveData enforce length limits on session notes, reflections, study windows, and time blocks
console.log('Test 7: Storage centralized saveData enforces length limits on sessions notes, reflections, study windows, and time blocks');
const extremeText = 'S'.repeat(3000);

// Test Session notes truncation via addSession
const sessionWithLongNotes = Storage.addSession(25, 'work', null, extremeText);
assert.strictEqual(sessionWithLongNotes.notes.length, 2000, 'Session notes should be truncated to 2000 characters');

// Test Reflections truncation on save
Storage.saveData(Storage.KEYS.REFLECTIONS, [{ text: extremeText, date: '2026-07-31' }]);
const reflections = Storage.loadData(Storage.KEYS.REFLECTIONS);
assert.strictEqual(reflections[0].text.length, 2000, 'Reflection text should be truncated to 2000 characters');

// Test Study Windows truncation on save
Storage.saveData(Storage.KEYS.STUDY_WINDOWS, [{ label: extremeText, dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }]);
const studyWindows = Storage.loadData(Storage.KEYS.STUDY_WINDOWS);
assert.strictEqual(studyWindows[0].label.length, 200, 'Study window label should be truncated to 200 characters');

// Test Time Blocks truncation on save
Storage.saveData(Storage.KEYS.TIME_BLOCKS, [{ label: extremeText, date: '2026-07-31', startTime: '09:00', endTime: '10:00' }]);
const timeBlocks = Storage.loadData(Storage.KEYS.TIME_BLOCKS);
assert.strictEqual(timeBlocks[0].label.length, 200, 'Time block label should be truncated to 200 characters');

// Test Notes truncation on save
const ultraText = 'S'.repeat(15000);
Storage.saveData(Storage.KEYS.NOTES, [{ title: ultraText, content: ultraText, subject: ultraText }]);
const notes = Storage.loadData(Storage.KEYS.NOTES);
assert.strictEqual(notes[0].title.length, 200, 'Note title should be truncated to 200 characters');
assert.strictEqual(notes[0].content.length, 10000, 'Note content should be truncated to 10000 characters');
assert.strictEqual(notes[0].subject.length, 100, 'Note subject should be truncated to 100 characters');

// Test Tasks truncation on save
Storage.saveData(Storage.KEYS.TASKS, [{ title: ultraText, subject: ultraText, priority: ultraText, subtasks: [{ title: ultraText }] }]);
const savedTasks = Storage.loadData(Storage.KEYS.TASKS);
assert.strictEqual(savedTasks[0].title.length, 200, 'Saved task title should be truncated to 200 characters');
assert.strictEqual(savedTasks[0].subject.length, 100, 'Saved task subject should be truncated to 100 characters');
assert.strictEqual(savedTasks[0].priority.length, 50, 'Saved task priority should be truncated to 50 characters');
assert.strictEqual(savedTasks[0].subtasks[0].title.length, 200, 'Saved subtask title should be truncated to 200 characters');

// Test Subjects truncation and color validation on save
Storage.saveData(Storage.KEYS.SUBJECTS, [{ name: ultraText, color: 'invalid-color' }]);
const savedSubjects = Storage.loadData(Storage.KEYS.SUBJECTS);
assert.strictEqual(savedSubjects[0].name.length, 200, 'Subject name should be truncated to 200 characters');
assert.strictEqual(savedSubjects[0].color, '#2563EB', 'Invalid subject color should fallback to default hex color');

// Test Study Blocks truncation on save
Storage.saveData(Storage.KEYS.STUDY_BLOCKS, [{ title: ultraText, subject: ultraText }]);
const savedStudyBlocks = Storage.loadData(Storage.KEYS.STUDY_BLOCKS);
assert.strictEqual(savedStudyBlocks[0].title.length, 200, 'Study block title should be truncated to 200 characters');
assert.strictEqual(savedStudyBlocks[0].subject.length, 100, 'Study block subject should be truncated to 100 characters');

console.log('✅ Test 7 Passed');

// Test 8: Storage numeric settings bounds and finite validation (DoS / Thread Crash Prevention)
console.log('Test 8: Storage numeric settings validate bounds and finite numbers');

// Test updateSetting with non-finite and out-of-bounds numbers
assert.strictEqual(Storage.updateSetting('sessions_until_long_break', Infinity), false, 'Infinity should be rejected');
assert.strictEqual(Storage.updateSetting('sessions_until_long_break', -Infinity), false, '-Infinity should be rejected');

Storage.updateSetting('sessions_until_long_break', 1e9);
assert.strictEqual(Storage.getSettings().sessions_until_long_break, 20, 'Oversized sessions_until_long_break should be clamped to 20');

Storage.updateSetting('sessions_until_long_break', -10);
assert.strictEqual(Storage.getSettings().sessions_until_long_break, 1, 'Negative sessions_until_long_break should be clamped to 1');

Storage.updateSetting('work_duration', 1000);
assert.strictEqual(Storage.getSettings().work_duration, 180, 'Oversized work_duration should be clamped to 180');

// Test importData with non-finite and out-of-bounds numbers
Storage.importData({
    settings: {
        sessions_until_long_break: 100,
        work_duration: -5,
        short_break: Infinity
    }
});
const importedBoundSettings = Storage.getSettings();
assert.strictEqual(importedBoundSettings.sessions_until_long_break, 20, 'Imported oversized setting should be clamped');
assert.strictEqual(importedBoundSettings.work_duration, 1, 'Imported negative setting should be clamped');
assert.strictEqual(importedBoundSettings.short_break, 5, 'Imported non-finite setting should fallback to default');

console.log('✅ Test 8 Passed');

// Test 9: App.showToast HTML escaping
console.log('Test 9: App.showToast escapes raw input');
const toastPayload = 'Objective "<script>alert(1)</script> & test"';
let createdToastHtml = '';
context.document.getElementById = (id) => null;
context.document.body.appendChild = (el) => {
    if (el.id === 'toast-container') {
        el.appendChild = (child) => { createdToastHtml = child.innerHTML; };
    }
};

App.showToast(toastPayload, 'info', 1000);
assert.ok(!createdToastHtml.includes('<script>'), 'Raw script tags should be HTML escaped');
assert.ok(createdToastHtml.includes('&quot;&lt;script&gt;alert(1)&lt;/script&gt; &amp; test&quot;'), 'HTML special characters should be correctly escaped once');
console.log('✅ Test 9 Passed');

console.log('--- All Security Hardening Tests Passed ---');
