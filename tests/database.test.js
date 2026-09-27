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
global.Storage = global.window.Storage;
const Database = require('../js/database.js');

console.log('--- Starting Database Engine & Task Adapter Unit Tests ---');

// Mock task data in Storage
Storage.saveTasks([
  { id: 't1', title: 'Math Homework', subject: 'Math', priority: 'high', dueDate: '2026-10-01', completed: false },
  { id: 't2', title: 'Biology Lab Report', subject: 'Science', priority: 'medium', dueDate: '2026-09-28', completed: true }
]);

// Test 1: Task database retrieval
console.log('Test 1: getTaskDatabaseItems');
const items = Database.getTaskDatabaseItems();
assert.strictEqual(items.length, 2);
assert.strictEqual(items[0].title, 'Math Homework');
assert.strictEqual(items[1].status, 'Completed');
console.log('✅ Test 1 Passed');

// Test 2: Filtering and Sorting
console.log('Test 2: applyFilterAndSort');
const filtered = Database.applyFilterAndSort(items);
assert.strictEqual(filtered.length, 2);
console.log('✅ Test 2 Passed');

// Test 3: Table, Board, Calendar View Renderers
console.log('Test 3: View Renderers');
const tableHtml = Database.renderTableView(items);
assert(tableHtml.includes('Math Homework'));
assert(tableHtml.includes('Biology Lab Report'));

const boardHtml = Database.renderBoardView(items);
assert(boardHtml.includes('Math'));
assert(boardHtml.includes('Science'));

const calendarHtml = Database.renderCalendarView(items);
assert(calendarHtml.includes('2026-10-01'));
assert(calendarHtml.includes('2026-09-28'));
console.log('✅ Test 3 Passed');

console.log('--- All Database Unit Tests Passed ---');
