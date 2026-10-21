/**
 * Test suite for getCompletionEvents and associated core rules:
 * - One-time task without subtasks
 * - Task with subtasks (parent complete must not add an extra event)
 * - Repeating task with and without subtasks across different dates
 * - cycles keys ignored
 * - sinceDateStr filter
 * - Completing a task awards no XP
 * - Focus session awards XP equal to minutes
 * - Mastery percentage comes from focus minutes and survives deleting the task
 * - plannedDate round-trips through export and import
 */

const fs = require('fs');
const path = require('path');

const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = value.toString(); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

global.localStorage = localStorageMock;
global.sessionStorage = localStorageMock;

global.App = {
  showToast: () => {},
  createModal: () => ({ querySelector: () => ({ onclick: null }) }),
  openModal: () => {},
  closeModal: () => {}
};

global.window = {
  localStorage: localStorageMock,
  sessionStorage: localStorageMock,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

global.CustomEvent = class {
  constructor(name, detail) {
    this.name = name;
    this.detail = detail;
  }
};

const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const subtaskUtilsCode = fs.readFileSync(path.join(__dirname, '../js/subtask-utils.js'), 'utf8');
const achievementsCode = fs.readFileSync(path.join(__dirname, '../js/achievements.js'), 'utf8');

eval(storageCode);
const Storage = global.window.Storage;

eval(subtaskUtilsCode);
const SubtaskUtils = global.window.SubtaskUtils;

eval(achievementsCode);
const Achievements = global.window.Achievements;

console.log('--- Starting verify_completion_events.test.js ---');

// Setup clean state
global.localStorage.clear();

// 1. One-time task without subtasks
const t1 = Storage.addTask({
  title: 'Read Chapter 1',
  type: 'one-time',
  completed: false,
  subject: 'Math'
});
Storage.completeTask(t1.id);

let events = Storage.getCompletionEvents();
console.assert(events.length === 1, 'Expected 1 completion event for t1, got ' + events.length);
console.assert(events[0].taskId === t1.id && events[0].subtaskId === null, 't1 event payload mismatch');

// 2. Task with subtasks (completing task or subtasks must count subtasks, parent complete must not add extra event)
const t2 = Storage.addTask({
  title: 'Build Feature X',
  type: 'one-time',
  subject: 'Science',
  subtasks: [
    { title: 'Sub 1', isCompleted: false },
    { title: 'Sub 2', isCompleted: false }
  ]
});

Storage.updateSubtask(t2.id, t2.subtasks[0].id, { isCompleted: true });
events = Storage.getCompletionEvents();
console.assert(events.length === 2, 'Expected 2 completion events after sub 1 complete, got ' + events.length);

Storage.completeTask(t2.id); // completes sub 2 as well
events = Storage.getCompletionEvents();
console.assert(events.length === 3, 'Expected 3 completion events (t1 + sub1 + sub2), got ' + events.length);
const t2Events = events.filter(e => e.taskId === t2.id);
console.assert(t2Events.length === 2, 'Expected exactly 2 subtask events for t2, parent must not add extra event');

// 3. Repeating tasks with and without subtasks across dates, ignoring cycles keys
const r1 = Storage.addTask({
  title: 'Daily Workout',
  type: 'repeating',
  subject: 'Other'
});

const r2 = Storage.addTask({
  title: 'Daily Reading',
  type: 'repeating',
  subject: 'English',
  subtasks: [
    { title: 'Read 10 pages', isCompleted: false }
  ]
});

const rc = Storage.getRepeatingCompletions();
rc[`${r1.id}_2026-10-01`] = true;
rc[`${r1.id}_2026-10-02`] = true;
rc[`${r2.id}_${r2.subtasks[0].id}_2026-10-01`] = true;
rc[`${r2.id}_${r2.subtasks[0].id}_cycles_2026-10-01`] = 3; // should be ignored
Storage.saveRepeatingCompletions(rc);

events = Storage.getCompletionEvents();
// Total expected: t1 (1), t2 subtasks (2), r1 (2 dates), r2 subtask (1 date) = 6 events
console.assert(events.length === 6, 'Expected 6 total completion events, got ' + events.length);

// test sinceDateStr filter
const filteredEvents = Storage.getCompletionEvents('2026-10-02');
const r1Oct2 = filteredEvents.filter(e => e.taskId === r1.id);
console.assert(r1Oct2.length === 1 && r1Oct2[0].date === '2026-10-02', 'sinceDateStr filtering failed for repeating event');

// 4. Completing a task awards NO XP
const xpBefore = Storage.getXPState().totalXP;
const t3 = Storage.addTask({ title: 'No XP Task', type: 'one-time' });
Storage.completeTask(t3.id);
const xpAfterTaskComplete = Storage.getXPState().totalXP;
console.assert(xpBefore === xpAfterTaskComplete, 'Completing task must award NO XP. Before: ' + xpBefore + ', After: ' + xpAfterTaskComplete);

// 5. Focus session awards XP equal to its minutes
Storage.completeTimerSession({
  type: 'work',
  sessionsInCycle: 0,
  selectedTaskId: t3.id,
  timeRemaining: 0
}, true); // 25 minute default work duration
const xpAfterTimer = Storage.getXPState().totalXP;
console.assert(xpAfterTimer === xpBefore + 25, 'Focus session of 25m must award 25 XP. Got: ' + (xpAfterTimer - xpBefore));

// 6. Mastery percentage comes from focus minutes and survives deleting the task
const mathTask = Storage.addTask({ title: 'Math Problem Set', subject: 'Math', type: 'one-time' });

// Add 30 mins work session for Math
Storage.addSession(30, 'work', mathTask.id);
let mastery = Storage.getSubjectMasteryStats().find(s => s.name === 'Math');
console.assert(mastery.focusedMinutes >= 30, 'Math focused minutes should be >= 30, got ' + mastery.focusedMinutes);

// Delete the task
Storage.deleteTask(mathTask.id);
let masteryAfterDelete = Storage.getSubjectMasteryStats().find(s => s.name === 'Math');
console.assert(masteryAfterDelete.focusedMinutes === mastery.focusedMinutes, 'Focus history/minutes must survive deleting task');

// 7. plannedDate round-trips through export and import
const taskWithPlannedDate = Storage.addTask({
  title: 'Task with Planned Subtask',
  type: 'one-time',
  subtasks: [
    { title: 'Planned Sub', isCompleted: false, plannedDate: '2026-10-25' }
  ]
});

const exported = Storage.exportData();
global.localStorage.clear();
Storage.importData(exported);

const importedTask = Storage.getTaskById(taskWithPlannedDate.id);
console.assert(importedTask.subtasks[0].plannedDate === '2026-10-25', 'plannedDate failed to round-trip export/import. Got: ' + importedTask.subtasks[0].plannedDate);

console.log('ALL VERIFY_COMPLETION_EVENTS TESTS PASSED!');
