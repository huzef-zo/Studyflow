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

// Load storage.js
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
// Evaluate in a function to extract Storage
const Storage = eval(storageCode + '; Storage;');

// Test malicious import
const maliciousData = {
  user: {
    name: 'Normal Name',
    maliciousProperty: 'should be blocked'
  }
};

console.log('--- Testing importData Hardening ---');
Storage.importData(maliciousData);

const user = Storage.getUser();

console.log('Imported User:', JSON.stringify(user, null, 2));

const isHardened = !user.hasOwnProperty('maliciousProperty');
if (isHardened) {
  console.log('Result: SECURE - Malicious property was blocked.');
} else {
  console.log('Result: VULNERABLE - Malicious property was injected.');
}
