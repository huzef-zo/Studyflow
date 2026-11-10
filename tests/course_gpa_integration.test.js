/**
 * End-to-end integration test verifying unification of Subjects into Courses
 * and seamless integration with GPA calculation, focus tracking, and backward compatibility.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser globals
global.localStorage = {
  _data: {},
  setItem(k, v) { this._data[k] = String(v); },
  getItem(k) { return this._data[k] || null; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  location: { reload: () => {} }
};

global.document = {
  addEventListener: () => {}
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {}
};

global.CustomEvent = class {
  constructor(n, d) { this.name = n; this.detail = d; }
};

const gpaUtilsCode = fs.readFileSync(path.join(__dirname, '../js/gpa-utils.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');

const GpaUtils = eval(gpaUtilsCode + '; GpaUtils;');
global.GpaUtils = GpaUtils;

const Storage = eval(storageCode + '; Storage;');
global.Storage = Storage;

console.log('--- Testing Course & GPA Unification ---');

// 1. Initial State: Subjects are available
const initialSubjects = Storage.getSubjects();
assert.ok(Array.isArray(initialSubjects) && initialSubjects.length >= 5, 'Should have default subjects');

// 2. Add course and verify GPA calculation integration
const added = Storage.addCourse({
  name: 'Artificial Intelligence',
  color: '#8B5CF6',
  creditHours: 4,
  semester: 'Semester 2',
  targetHours: 15,
  components: [
    { name: 'Midterm', max: 30, earned: 28 },
    { name: 'Final Exam', max: 60, earned: 56 },
    { name: 'Assignments', max: 10, earned: 10 }
  ]
});

assert.strictEqual(added.name, 'Artificial Intelligence');
assert.strictEqual(added.color, '#8B5CF6');
assert.strictEqual(added.creditHours, 4);

const updatedCourses = Storage.getCourses();
const aiCourse = updatedCourses.find(c => c.id === added.id);
assert.ok(aiCourse);

const status = GpaUtils.courseStatus(aiCourse);
assert.strictEqual(status.isComplete, true);
assert.strictEqual(status.earned, 94);
assert.strictEqual(status.grade.letter, 'A');
assert.strictEqual(status.grade.gp, 4.0);

// 3. GPA calculation
const cgpaRes = GpaUtils.cgpa(updatedCourses, { includeProjected: false });
assert.ok(cgpaRes.totalCredits >= 4);
assert.strictEqual(cgpaRes.gpa, 4.0);

// 4. Focus time integration by course name
Storage.saveSessions([
  {
    id: 'sess_1',
    taskId: null,
    subject: 'Artificial Intelligence',
    duration: 90,
    type: 'work',
    completedAt: new Date().toISOString()
  }
]);

const focusMinutes = Storage.getFocusMinutesBySubject(null, 'Artificial Intelligence');
assert.strictEqual(focusMinutes, 90, 'Focus minutes should match session logged for course');

// 5. Mastery stats calculation
const masteryStats = Storage.getSubjectMasteryStats();
const aiStats = masteryStats.find(s => s.name === 'Artificial Intelligence');
assert.ok(aiStats);
assert.strictEqual(aiStats.focusedMinutes, 90);
assert.strictEqual(aiStats.focusedHours, 1.5);
assert.strictEqual(aiStats.targetHours, 15);
assert.strictEqual(aiStats.percentage, 10); // 90 mins / (15 * 60) = 10%

// 6. Backward compatibility: Storage.getSubjectByName / Storage.updateSubject
const retrievedSub = Storage.getSubjectByName('Artificial Intelligence');
assert.ok(retrievedSub);
assert.strictEqual(retrievedSub.color, '#8B5CF6');

Storage.updateSubject(added.id, { color: '#EC4899', targetHours: 20 });
const updatedAi = Storage.getCourses().find(c => c.id === added.id);
assert.strictEqual(updatedAi.color, '#EC4899');
assert.strictEqual(updatedAi.targetHours, 20);

// 7. Verify addSubject syncs with courses
const newSub = Storage.addSubject('Quantum Computing', '#10B981', 12);
const qcCourse = Storage.getCourses().find(c => c.id === newSub.id || c.name === 'Quantum Computing');
assert.ok(qcCourse, 'addSubject should create a corresponding course');
assert.strictEqual(qcCourse.color, '#10B981');
assert.strictEqual(qcCourse.targetHours, 12);

console.log('--- ALL COURSE & GPA UNIFICATION INTEGRATION TESTS PASSED ---');
