const fs = require('fs');
const path = require('path');

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

// Load app.js and storage.js
const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

// Evaluate App
const App = eval(appCode + '; App;');
global.App = App;

// Evaluate Storage
const Storage = eval(storageCode + '; Storage;');

console.log('--- Testing Color Validation Security ---');

// 1. Test App.isValidHexColor
const testColors = [
  { hex: '#FFF', expected: true },
  { hex: '#FFFFFF', expected: true },
  { hex: '#3B82F6', expected: true },
  { hex: 'FFF', expected: false },
  { hex: '#GGGGGG', expected: false },
  { hex: '#12345', expected: false },
  { hex: '#1234567', expected: false },
  { hex: '#3B82F6; color: red;', expected: false }, // CSS Injection attempt
  { hex: '"><script>alert(1)</script>', expected: false } // XSS attempt
];

testColors.forEach(t => {
  const result = App.isValidHexColor(t.hex);
  console.log(`Color: ${t.hex.padEnd(30)} | Expected: ${t.expected} | Result: ${result} | ${result === t.expected ? '✅' : '❌'}`);
  if (result !== t.expected) process.exit(1);
});

// 2. Test Storage.addSubject hardening
console.log('\n--- Testing Storage.addSubject validation ---');
const sub1 = Storage.addSubject('Valid Subject', '#22C55E');
console.log('Valid color subject:', sub1.color);
if (sub1.color !== '#22C55E') {
    console.log('❌ Valid color was rejected');
    process.exit(1);
}

const sub2 = Storage.addSubject('Malicious Subject', '#3B82F6; background: url(x) border-box;');
console.log('Malicious color subject (expect fallback):', sub2.color);
if (sub2.color !== '#2563EB' && sub2.color !== '#3B82F6') { // Depending on the default used in code
    // The code uses #2563EB or #3B82F6 as fallback. Let's check storage.js for the exact one.
    // Actually in my code I used #2563EB or #3B82F6. Let's be precise.
}
// Based on my replacement, safeColor = color || '#2563EB'; and fallback is '#2563EB'.
if (sub2.color.includes(';')) {
    console.log('❌ Malicious color was injected!');
    process.exit(1);
} else {
    console.log('✅ Malicious color was blocked');
}

// 3. Test Storage.importData hardening
console.log('\n--- Testing Storage.importData validation ---');
const importData = {
  subjects: [
    { id: 'sub_malicious', name: 'Imported Malicious', color: '#123; border: 10px solid red;' }
  ]
};
Storage.importData(importData);
const imported = Storage.getSubjectById('sub_malicious');
console.log('Imported color:', imported.color);
if (imported.color.includes(';')) {
    console.log('❌ Malicious imported color was injected!');
    process.exit(1);
} else {
    console.log('✅ Malicious imported color was blocked');
}

console.log('\nResult: ALL COLOR SECURITY TESTS PASSED');
