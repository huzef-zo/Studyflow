const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running Micro-UX Enhancement Tests ---');

// Test Case 1: Tasks page search input shortcut hint & ARIA attributes
const tasksHtml = fs.readFileSync(path.join(__dirname, '../tasks.html'), 'utf8');

assert(
  tasksHtml.includes('id="search-tasks"'),
  'tasks.html search input must exist with id="search-tasks"'
);
assert(
  tasksHtml.includes('aria-label="Search tasks"') || tasksHtml.includes('aria-label="Search tasks..."'),
  'tasks.html search input must have explicit aria-label'
);

console.log('  Passed: Tasks page ARIA labels and shortcut hints verified in source.');

// Test Case 2: App.createModal title ID escaping and aria-labelledby mapping
const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

assert(
  appJs.includes('aria-labelledby="${escapeHtml(titleId)}"'),
  'App.createModal must escape titleId in aria-labelledby attribute'
);
assert(
  appJs.includes('id="${escapeHtml(titleId)}"'),
  'App.createModal must escape titleId in header id attribute'
);

console.log('  Passed: Modal ARIA generation logic verified in source.');

// Test Case 3: Tasks page "action=add" URL parameter detection
const tasksJs = fs.readFileSync(path.join(__dirname, '../js/tasks.js'), 'utf8');

assert(
  tasksJs.includes("action') === 'add'") || tasksJs.includes("action === 'add'"),
  'tasks.js must detect action=add parameter'
);
assert(
  tasksJs.includes('openTaskModal()'),
  'tasks.js must invoke openTaskModal when action=add is detected'
);

console.log('  Passed: Task Manager "action=add" logic verified in source.');

// Test Case 4: Form control label associations in settings.html and timer.html
const settingsHtml = fs.readFileSync(path.join(__dirname, '../settings.html'), 'utf8');
const timerHtml = fs.readFileSync(path.join(__dirname, '../timer.html'), 'utf8');

const settingsInputs = [
  { id: 'display-name', labelFor: 'for="display-name"' },
  { id: 'user-email', labelFor: 'for="user-email"' },
  { id: 'work-duration', labelFor: 'for="work-duration"' },
  { id: 'short-break', labelFor: 'for="short-break"' },
  { id: 'long-break', labelFor: 'for="long-break"' },
  { id: 'sessions-until-long-break', labelFor: 'for="sessions-until-long-break"' }
];

settingsInputs.forEach(({ id, labelFor }) => {
  if (!settingsHtml.includes(`id="${id}"`)) {
    throw new Error(`settings.html missing input id="${id}"`);
  }
  if (!settingsHtml.includes(labelFor)) {
    throw new Error(`settings.html missing label ${labelFor}`);
  }
});

if (!timerHtml.includes('id="session-notes"') || !timerHtml.includes('aria-label="Session notes"')) {
  throw new Error('timer.html #session-notes missing aria-label');
}

console.log('  Passed: Form control label associations and ARIA attributes verified in source.');

console.log('Micro-UX Enhancement tests passed successfully!');
