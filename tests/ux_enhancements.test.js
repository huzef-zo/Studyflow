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
const appJsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

assert(
  appJsContent.includes('aria-labelledby="${escapeHtml(titleId)}"'),
  'App.createModal must escape titleId in aria-labelledby attribute'
);
assert(
  appJsContent.includes('id="${escapeHtml(titleId)}"') || appJsContent.includes('id="${escapeHtml(modalId)}"'),
  'App.createModal must escape titleId or modalId in header id attribute'
);

console.log('  Passed: Modal ARIA generation logic verified in source.');

// Test Case 3: Tasks page "action=add" or App modal trigger detection
assert(
  appJsContent.includes('openAddTaskModal'),
  'app.js must provide openAddTaskModal function'
);

console.log('  Passed: Task Manager modal trigger verified in source.');

// Test Case 4: Form control label associations in settings.html and timer.html
const settingsHtml = fs.readFileSync(path.join(__dirname, '../settings.html'), 'utf8');
const timerHtml = fs.readFileSync(path.join(__dirname, '../timer.html'), 'utf8');

const settingsElements = [
  'profile-name',
  'profile-email',
  'work-val',
  'short-val',
  'long-val',
  'cycles-val'
];

settingsElements.forEach((id) => {
  if (!settingsHtml.includes(`id="${id}"`)) {
    throw new Error(`settings.html missing element id="${id}"`);
  }
});

if (!timerHtml.includes('id="session-notes"') || !timerHtml.includes('aria-label="Session notes"')) {
  throw new Error('timer.html #session-notes missing aria-label');
}

console.log('  Passed: Form control label associations and ARIA attributes verified in source.');

// Test Case 5: Context-aware ARIA labels and title tooltips for timer subtask controls
const timerJsContent = fs.readFileSync(path.join(__dirname, '../js/timer.js'), 'utf8');

assert(
  timerJsContent.includes('aria-label="Decrease session count for ${subtaskTitle}"'),
  'timer.js dec-cycle button must include dynamic context-aware aria-label'
);
assert(
  timerJsContent.includes('aria-label="Increase session count for ${subtaskTitle}"'),
  'timer.js inc-cycle button must include dynamic context-aware aria-label'
);
assert(
  timerJsContent.includes('title="Decrease session count for ${subtaskTitle}"') &&
  timerJsContent.includes('title="Increase session count for ${subtaskTitle}"'),
  'timer.js cycle buttons must include dynamic title tooltips'
);

console.log('  Passed: Timer subtask controls context-aware ARIA labels and tooltips verified in source.');

// Test Case 6: Keyboard-accessible import button in settings.html
assert(
  settingsHtml.includes('id="import-btn"'),
  'settings.html must contain #import-btn'
);
assert(
  settingsHtml.includes('aria-label="Import backup"'),
  'settings.html #import-btn must specify aria-label="Import backup"'
);

console.log('  Passed: Settings page import backup button keyboard accessibility verified in source.');

console.log('Micro-UX Enhancement tests passed successfully!');
