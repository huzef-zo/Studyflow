/**
 * Unit & Security Tests - Recordings Storage & Sanitization
 */

// Mock localStorage, sessionStorage and window environment for Node execution
if (typeof localStorage === 'undefined' || localStorage === null) {
  const store = {};
  global.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

if (typeof sessionStorage === 'undefined' || sessionStorage === null) {
  const sessionStore = {};
  global.sessionStorage = {
    getItem: (key) => sessionStore[key] || null,
    setItem: (key, value) => { sessionStore[key] = value.toString(); },
    removeItem: (key) => { delete sessionStore[key]; },
    clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
  };
}

if (typeof document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => ({
      tagName: tag,
      style: {},
      appendChild: () => {},
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      id: '',
      classList: { add: () => {}, remove: () => {} }
    }),
    getElementById: () => null,
    body: { appendChild: () => {} }
  };
}

if (typeof window === 'undefined') {
  global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { pathname: '/recordings.html' }
  };
  global.CustomEvent = class CustomEvent { constructor(name, params) { this.name = name; this.params = params; } };
}

// Load Storage module & App module
require('../js/storage.js');
require('../js/app.js');
const Storage = global.window.Storage;
const App = global.window.App;

console.log('--- Testing Recordings Storage, Import Validation & Security ---');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// 1. Initial State
Storage.clearAllData();
assert(Array.isArray(Storage.getRecordings()), 'Storage.getRecordings returns an array');
assert(Storage.getRecordings().length === 0, 'Initial recordings list is empty');

// 2. Add Recording CRUD
const added = Storage.addRecording({
  title: 'Neurobiology Lecture 101',
  subject: 'Science',
  duration: 3600,
  size: 15485760,
  mimeType: 'audio/webm'
});

assert(added && added.id, 'addRecording returns new recording object with ID');
assert(added.title === 'Neurobiology Lecture 101', 'Title matches input');
assert(added.subject === 'Science', 'Subject matches input');
assert(added.duration === 3600, 'Duration matches input');
assert(added.size === 15485760, 'Size matches input');
assert(added.mimeType === 'audio/webm', 'mimeType matches input');

const list = Storage.getRecordings();
assert(list.length === 1, 'getRecordings returns 1 item');

// 3. Update Recording
const updated = Storage.updateRecording(added.id, {
  title: 'Neurobiology Lecture 101 - Final Part',
  subject: 'Biology'
});

assert(updated.title === 'Neurobiology Lecture 101 - Final Part', 'updateRecording updates title');
assert(updated.subject === 'Biology', 'updateRecording updates subject');

// 4. Delete Recording
const deleteRes = Storage.deleteRecording(added.id);
assert(deleteRes === true, 'deleteRecording returns true');
assert(Storage.getRecordings().length === 0, 'getRecordings is empty after deletion');

// 5. Title Truncation
const hugeTitle = 'A'.repeat(500);
const recTruncated = Storage.addRecording({ title: hugeTitle });
assert(recTruncated.title.length === 200, `Title truncated to 200 chars (got ${recTruncated.title.length})`);

// 6. Import Validation (Bad IDs, Bad mimeType, Oversized arrays, NaN duration)
const oversizedRecordings = [];
for (let i = 0; i < 600; i++) {
  oversizedRecordings.push({
    id: `rec_test_${i}`,
    title: `Rec ${i}`,
    duration: 100
  });
}

const maliciousBackup = {
  recordings: [
    {
      id: '<script>alert("xss")</script>',
      title: '<img src=x onerror=alert(1)>',
      subject: 'Math',
      duration: NaN,
      size: -500,
      mimeType: 'text/html'
    },
    ...oversizedRecordings
  ]
};

Storage.importData(maliciousBackup);
const importedRecordings = Storage.getRecordings();

assert(importedRecordings.length === 500, `Imported array capped at 500 items (got ${importedRecordings.length})`);

const firstImp = importedRecordings[0];
assert(!firstImp.id.includes('<script>'), `Malicious ID sanitized to safe format (got ${firstImp.id})`);
assert(firstImp.duration === 0, `NaN duration sanitized to 0 (got ${firstImp.duration})`);
assert(firstImp.size === 0, `Negative size clamped to 0 (got ${firstImp.size})`);
assert(firstImp.mimeType === 'audio/webm', `Invalid mimeType fallback to audio/webm (got ${firstImp.mimeType})`);

// 7. Export Data
const exported = Storage.exportData();
assert(Array.isArray(exported.recordings), 'Export data contains recordings array');

// 8. XSS Escaping via App.escapeHtml
const rawTitle = '<script>alert("hack")</script>';
const escapedTitle = App.escapeHtml(rawTitle);
assert(!escapedTitle.includes('<script>'), 'App.escapeHtml neutralizes script tags');
assert(escapedTitle.includes('&lt;script&gt;'), 'App.escapeHtml converts tags to HTML entities');

console.log('--- ALL RECORDINGS STORAGE & SECURITY TESTS PASSED ---');
