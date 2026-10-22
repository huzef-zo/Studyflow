/**
 * Verification Test: Task and Configuration Editing Persistence
 */

const fs = require('fs');
const path = require('path');

// Mock localStorage and window
const storageStore = {};
global.localStorage = {
  getItem: (key) => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: (key) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {}
};

// Load Storage module
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
eval(storageCode);
const Storage = global.window.Storage;

console.log('--- Starting Task and Configuration Editing Persistence Tests ---');

// Test 1: Task creation and editing via Storage.updateTask(id, updates)
const task1 = Storage.addTask({
  title: 'Original Task Title',
  priority: 'low',
  subject: 'Math',
  type: 'one-time',
  dueDate: '2026-11-01'
});

console.log('Test 1: Editing task using Storage.updateTask(id, updates)...');
const updated1 = Storage.updateTask(task1.id, {
  title: 'Updated Task Title 1',
  priority: 'critical',
  subject: 'Science'
});

if (updated1 && updated1.title === 'Updated Task Title 1' && updated1.priority === 'critical' && updated1.subject === 'Science') {
  console.log('  Passed: updateTask(id, updates) returned updated task object');
} else {
  console.error('  Failed: updateTask(id, updates) failed', updated1);
  process.exit(1);
}

// Check persistence via getTaskById and getTasks
const loaded1 = Storage.getTaskById(task1.id);
if (loaded1 && loaded1.title === 'Updated Task Title 1' && loaded1.priority === 'critical' && loaded1.subject === 'Science') {
  console.log('  Passed: Storage.getTaskById loaded updated task from storage');
} else {
  console.error('  Failed: Storage.getTaskById loaded incorrect task data', loaded1);
  process.exit(1);
}

// Test 2: Task editing via single-argument Storage.updateTask(taskData)
console.log('Test 2: Editing task using Storage.updateTask(taskData)...');
const taskDataObj = {
  id: task1.id,
  title: 'Updated Task Title 2 via Single Arg',
  priority: 'high',
  subject: 'History',
  subtasks: [
    { title: 'Subtask A', isCompleted: false },
    { title: 'Subtask B', isCompleted: true }
  ]
};

const updated2 = Storage.updateTask(taskDataObj);
if (updated2 && updated2.title === 'Updated Task Title 2 via Single Arg' && updated2.priority === 'high' && updated2.subtasks.length === 2) {
  console.log('  Passed: updateTask(taskData) single-argument handled correctly');
} else {
  console.error('  Failed: updateTask(taskData) single-argument failed', updated2);
  process.exit(1);
}

const loaded2 = Storage.getTaskById(task1.id);
if (loaded2 && loaded2.title === 'Updated Task Title 2 via Single Arg' && loaded2.subtasks.length === 2) {
  console.log('  Passed: Single-argument update persisted to storage');
} else {
  console.error('  Failed: Storage.getTaskById did not persist single-argument update', loaded2);
  process.exit(1);
}

// Test 3: Updating settings
console.log('Test 3: Testing Storage.updateSetting...');
Storage.updateSetting('work_duration', 45);
Storage.updateSetting('notifications', false);
const settings = Storage.getSettings();

if (settings.work_duration === 45 && settings.notifications === false) {
  console.log('  Passed: Settings updated and saved successfully');
} else {
  console.error('  Failed: Settings update failed', settings);
  process.exit(1);
}

// Test 4: Updating goals
console.log('Test 4: Testing Storage.updateGoals...');
Storage.updateGoals({ weekly_tasks: 25, daily_hours: 5 });
const goals = Storage.getGoals();

if (goals.weekly_tasks === 25 && goals.daily_hours === 5) {
  console.log('  Passed: Goals updated and saved successfully');
} else {
  console.error('  Failed: Goals update failed', goals);
  process.exit(1);
}

// Test 5: Updating subjects
console.log('Test 5: Testing Storage.updateSubject...');
const newSub = Storage.addSubject('Physics', '#2563EB', 15);
Storage.updateSubject(newSub.id, { name: 'Advanced Physics', color: '#10B981', targetHours: 20 });
const loadedSub = Storage.getSubjectById(newSub.id);

if (loadedSub && loadedSub.name === 'Advanced Physics' && loadedSub.color === '#10B981' && loadedSub.targetHours === 20) {
  console.log('  Passed: Subject updated and saved successfully');
} else {
  console.error('  Failed: Subject update failed', loadedSub);
  process.exit(1);
}

// Test 6: Updating profile
console.log('Test 6: Testing Storage.updateUserName and Storage.updateUserEmail...');
Storage.updateUserName('Jane Scholar');
Storage.updateUserEmail('jane@studyflow.app');
const user = Storage.getUser();

if (user.name === 'Jane Scholar' && user.email === 'jane@studyflow.app') {
  console.log('  Passed: User profile updated and saved successfully');
} else {
  console.error('  Failed: User profile update failed', user);
  process.exit(1);
}

console.log('--- ALL TASK AND CONFIGURATION EDITING PERSISTENCE TESTS PASSED ---');
