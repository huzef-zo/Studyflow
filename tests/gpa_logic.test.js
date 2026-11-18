/**
 * Test Suite: GPA Engine, Storage, XP Anti-Farming, and Security Hardening
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Setup mock browser environment
let storageStore = {};
const mockLocalStorage = {
  getItem: (key) => storageStore[key] || null,
  setItem: (key, val) => { storageStore[key] = String(val); },
  removeItem: (key) => { delete storageStore[key]; },
  clear: () => { storageStore = {}; }
};

const sandbox = {
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  document: { querySelectorAll: () => [] },
  CustomEvent: class {
    constructor(type, detail) {
      this.type = type;
      this.detail = detail;
    }
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  App: {
    showToast: () => {},
    escapeHtml: (s) => String(s || ''),
    createModal: () => ({ querySelector: () => ({ onclick: null }) }),
    openModal: () => {},
    closeModal: () => {}
  },
  console: console
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
sandbox.window.dispatchEvent = () => {};

const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const gpaUtilsCode = fs.readFileSync(path.join(__dirname, '../js/gpa-utils.js'), 'utf8');
const achievementsCode = fs.readFileSync(path.join(__dirname, '../js/achievements.js'), 'utf8');

vm.createContext(sandbox);
vm.runInContext(storageCode, sandbox);
vm.runInContext(gpaUtilsCode, sandbox);
vm.runInContext(achievementsCode, sandbox);

const { Storage, GpaUtils, Achievements } = sandbox;

test('Grading scale: boundary marks and rounding', () => {
  // Boundary tests:
  // 93-100 -> 4.00 A
  assert.strictEqual(GpaUtils.rawToGrade(100).letter, 'A');
  assert.strictEqual(GpaUtils.rawToGrade(100).gp, 4.00);
  assert.strictEqual(GpaUtils.rawToGrade(93).letter, 'A');
  assert.strictEqual(GpaUtils.rawToGrade(93).gp, 4.00);

  // 92.5 rounds to 93 -> A
  assert.strictEqual(GpaUtils.rawToGrade(92.5).letter, 'A');
  assert.strictEqual(GpaUtils.rawToGrade(92.5).gp, 4.00);

  // 92.4 rounds to 92 -> A-
  assert.strictEqual(GpaUtils.rawToGrade(92.4).letter, 'A-');
  assert.strictEqual(GpaUtils.rawToGrade(92).letter, 'A-');
  assert.strictEqual(GpaUtils.rawToGrade(90).letter, 'A-');
  assert.strictEqual(GpaUtils.rawToGrade(90).gp, 3.70);

  // 89/90 boundary
  assert.strictEqual(GpaUtils.rawToGrade(89).letter, 'B+');
  assert.strictEqual(GpaUtils.rawToGrade(89).gp, 3.30);
  assert.strictEqual(GpaUtils.rawToGrade(87).letter, 'B+');

  // 86/87 boundary
  assert.strictEqual(GpaUtils.rawToGrade(86).letter, 'B');
  assert.strictEqual(GpaUtils.rawToGrade(86).gp, 3.00);
  assert.strictEqual(GpaUtils.rawToGrade(83).letter, 'B');

  // 82/83 boundary
  assert.strictEqual(GpaUtils.rawToGrade(82).letter, 'B-');
  assert.strictEqual(GpaUtils.rawToGrade(82).gp, 2.70);
  assert.strictEqual(GpaUtils.rawToGrade(80).letter, 'B-');

  // 79/80 boundary
  assert.strictEqual(GpaUtils.rawToGrade(79).letter, 'C+');
  assert.strictEqual(GpaUtils.rawToGrade(79).gp, 2.30);
  assert.strictEqual(GpaUtils.rawToGrade(77).letter, 'C+');

  // 76/77 boundary
  assert.strictEqual(GpaUtils.rawToGrade(76).letter, 'C');
  assert.strictEqual(GpaUtils.rawToGrade(76).gp, 2.00);
  assert.strictEqual(GpaUtils.rawToGrade(73).letter, 'C');

  // 72/73 boundary
  assert.strictEqual(GpaUtils.rawToGrade(72).letter, 'C-');
  assert.strictEqual(GpaUtils.rawToGrade(72).gp, 1.70);
  assert.strictEqual(GpaUtils.rawToGrade(70).letter, 'C-');

  // 69/70 boundary
  assert.strictEqual(GpaUtils.rawToGrade(69).letter, 'D+');
  assert.strictEqual(GpaUtils.rawToGrade(69).gp, 1.30);
  assert.strictEqual(GpaUtils.rawToGrade(67).letter, 'D+');

  // 66/67 boundary
  assert.strictEqual(GpaUtils.rawToGrade(66).letter, 'D');
  assert.strictEqual(GpaUtils.rawToGrade(66).gp, 1.00);
  assert.strictEqual(GpaUtils.rawToGrade(63).letter, 'D');

  // 62/63 boundary
  assert.strictEqual(GpaUtils.rawToGrade(62).letter, 'D-');
  assert.strictEqual(GpaUtils.rawToGrade(62).gp, 0.70);
  assert.strictEqual(GpaUtils.rawToGrade(60).letter, 'D-');

  // 59/60 boundary
  assert.strictEqual(GpaUtils.rawToGrade(59).letter, 'F');
  assert.strictEqual(GpaUtils.rawToGrade(59).gp, 0.00);
  assert.strictEqual(GpaUtils.rawToGrade(0).letter, 'F');
  assert.strictEqual(GpaUtils.rawToGrade(0).gp, 0.00);
});

test('Default course components (30/60/10) and course status', () => {
  Storage.clearAllData();
  const c = Storage.addCourse({ name: 'Calculus I', creditHours: 4, semester: 'Fall 2026' });

  assert.strictEqual(c.name, 'Calculus I');
  assert.strictEqual(c.creditHours, 4);
  assert.strictEqual(c.components.length, 3);
  assert.strictEqual(c.components[0].name, 'Mid Exam');
  assert.strictEqual(c.components[0].max, 30);
  assert.strictEqual(c.components[1].name, 'Final Exam');
  assert.strictEqual(c.components[1].max, 60);
  assert.strictEqual(c.components[2].name, 'Class Assessment');
  assert.strictEqual(c.components[2].max, 10);

  // Status with no grades entered
  let status = GpaUtils.courseStatus(c);
  assert.strictEqual(status.earned, 0);
  assert.strictEqual(status.gradedMax, 0);
  assert.strictEqual(status.ungradedMax, 100);
  assert.strictEqual(status.isComplete, false);
  assert.strictEqual(status.grade.isProjected, true);

  // Partial grade: Mid = 27/30 (90%)
  Storage.setComponentScore(c.id, c.components[0].id, 27);
  const updatedCourse = Storage.getCourses().find(item => item.id === c.id);
  status = GpaUtils.courseStatus(updatedCourse);
  assert.strictEqual(status.earned, 27);
  assert.strictEqual(status.gradedMax, 30);
  assert.strictEqual(status.ungradedMax, 70);
  assert.strictEqual(status.bestCaseMark, 97);
  assert.strictEqual(status.worstCaseMark, 27);
  assert.strictEqual(status.projectedMark, 90);
  assert.strictEqual(status.grade.letter, 'A-');
  assert.strictEqual(status.grade.isProjected, true);
});

test('Required on remaining calculation: secured, reachable, unreachable', () => {
  const course = {
    id: 'c1',
    creditHours: 3,
    components: [
      { id: '1', name: 'Mid', max: 30, earned: 28 },
      { id: '2', name: 'Final', max: 60, earned: null },
      { id: '3', name: 'Lab', max: 10, earned: 10 }
    ]
  };

  // Earned so far: 38 out of 40 graded. Remaining: 60 pts.
  // Best case: 38 + 60 = 98.
  // Target 38 (already earned): secured
  const reqSecured = GpaUtils.requiredOnRemaining(course, 38);
  assert.strictEqual(reqSecured.status, 'secured');
  assert.strictEqual(reqSecured.pointsNeeded, 0);

  // Target 93 (A): needs 93 - 38 = 55 points on remaining 60 (91.7%)
  const reqA = GpaUtils.requiredOnRemaining(course, 93);
  assert.strictEqual(reqA.status, 'reachable');
  assert.strictEqual(reqA.pointsNeeded, 55);
  assert.strictEqual(reqA.percentNeeded, 91.7);

  // Target 99: best case is 98 -> unreachable
  const reqUnreachable = GpaUtils.requiredOnRemaining(course, 99);
  assert.strictEqual(reqUnreachable.status, 'unreachable');
  assert.strictEqual(reqUnreachable.pointsNeeded, 61);
  assert.strictEqual(reqUnreachable.percentNeeded, null);
});

test('Weighted semester and cumulative GPA calculation', () => {
  const courses = [
    // Course 1: 4 credits, Grade A (4.0)
    {
      id: 'c1',
      name: 'Algorithms',
      creditHours: 4,
      semester: 'Sem 1',
      finalized: true,
      components: [{ id: '1', max: 100, earned: 95 }]
    },
    // Course 2: 3 credits, Grade B (3.0)
    {
      id: 'c2',
      name: 'Databases',
      creditHours: 3,
      semester: 'Sem 1',
      finalized: true,
      components: [{ id: '1', max: 100, earned: 84 }]
    },
    // Course 3: 3 credits, in progress (Projected A 4.0)
    {
      id: 'c3',
      name: 'AI',
      creditHours: 3,
      semester: 'Sem 2',
      finalized: false,
      components: [
        { id: '1', max: 50, earned: 48 }, // 96%
        { id: '2', max: 50, earned: null }
      ]
    }
  ];

  // Default: only finalized or complete courses count
  // c1: 4 * 4.0 = 16. c2: 3 * 3.0 = 9. Total quality = 25, credits = 7.
  // GPA = 25 / 7 = 3.5714 -> 3.57
  const defaultRes = GpaUtils.cgpa(courses, { includeProjected: false });
  assert.strictEqual(defaultRes.totalCredits, 7);
  assert.strictEqual(defaultRes.gpa, 3.57);

  // With includeProjected: true
  // c3 counts: 3 * 4.0 = 12 quality points, 3 credits.
  // Total quality = 37, total credits = 10. GPA = 3.70
  const projRes = GpaUtils.cgpa(courses, { includeProjected: true });
  assert.strictEqual(projRes.totalCredits, 10);
  assert.strictEqual(projRes.gpa, 3.70);

  // Empty list returns 0 safely without NaN
  const emptyRes = GpaUtils.cgpa([]);
  assert.strictEqual(emptyRes.gpa, 0);
  assert.strictEqual(emptyRes.totalCredits, 0);
  assert.strictEqual(isNaN(emptyRes.gpa), false);

  // F courses lower GPA
  const coursesWithF = [
    {
      id: 'c1',
      creditHours: 3,
      finalized: true,
      components: [{ id: '1', max: 100, earned: 95 }] // A = 4.0
    },
    {
      id: 'c2',
      creditHours: 3,
      finalized: true,
      components: [{ id: '1', max: 100, earned: 50 }] // F = 0.0
    }
  ];
  const fRes = GpaUtils.cgpa(coursesWithF);
  // (3 * 4 + 3 * 0) / 6 = 2.00
  assert.strictEqual(fRes.gpa, 2.00);
});

test('XP anti-farming & semester bonus', () => {
  Storage.clearAllData();

  const c = Storage.addCourse({
    name: 'Operating Systems',
    creditHours: 3,
    semester: 'Year 1 - Sem 1',
    components: [
      { id: '1', name: 'Final', max: 100, earned: 85 } // B (90 XP)
    ]
  });

  // Complete course awarded B (90 XP) + Semester completion bonus (GPA 3.0 -> +250 XP)
  const xpFirst = Achievements.awardGpaXP(c, null);
  assert.strictEqual(xpFirst, 340); // 90 + 250

  const storedCourse = Storage.getCourses().find(item => item.id === c.id);
  assert.strictEqual(storedCourse.xpAwarded, 90);

  // Editing course downward (B to C): should award 0 XP
  Storage.setComponentScore(c.id, '1', 75); // C (45 XP)
  const downgradedCourse = Storage.getCourses().find(item => item.id === c.id);
  const xpDown = Achievements.awardGpaXP(downgradedCourse, 3.0);
  assert.strictEqual(xpDown, 0);

  // Editing course upward (to A = 150 XP): should award only difference (150 - 90 = 60 XP)
  Storage.setComponentScore(c.id, '1', 95); // A (150 XP)
  const upgradedCourse = Storage.getCourses().find(item => item.id === c.id);
  const xpUp = Achievements.awardGpaXP(upgradedCourse, 2.0);
  // Also upgrades semester GPA to 4.0 (>= 3.7), triggering the +400 semester bonus
  assert.strictEqual(xpUp, 460); // 60 + 400
  const finalizedOS = Storage.getCourses().find(item => item.id === c.id);
  assert.strictEqual(finalizedOS.xpAwarded, 150);

  // Re-awarding same course again: 0 XP
  const xpAgain = Achievements.awardGpaXP(finalizedOS, 4.0);
  assert.strictEqual(xpAgain, 0);
});

test('Security & importData validation', () => {
  Storage.clearAllData();

  const maliciousData = {
    goals: {
      target_gpa: 9999, // Should clamp to 4.0
      __proto__: { polluted: true }
    },
    settings: {
      pinned_nav_items: ['gpa', '<script>alert(1)</script>', 'malicious']
    },
    courses: [
      {
        id: 'bad id with spaces & <tags>', // Invalid ID format
        name: 'A'.repeat(500), // Needs truncation to 200
        semester: 'B'.repeat(300), // Needs truncation to 100
        creditHours: 999, // Needs clamp to 12
        components: Array(50).fill(null).map((_, i) => ({
          id: `c_${i}`,
          name: 'Comp ' + i,
          max: 100,
          earned: 150 // Clamped to max 100
        }))
      }
    ]
  };

  const success = Storage.importData(maliciousData);
  assert.strictEqual(success, true);

  // Check target_gpa clamped to 4
  const goals = Storage.getGoals();
  assert.strictEqual(goals.target_gpa, 4);
  assert.strictEqual(Object.prototype.polluted, undefined);

  // Check pinned nav sanitized
  const settings = Storage.getSettings();
  assert.deepStrictEqual(settings.pinned_nav_items, ['gpa']);

  // Check courses sanitization
  const courses = Storage.getCourses();
  assert.strictEqual(courses.length, 1);
  const course = courses[0];

  // ID was neutralized / regenerated
  assert.ok(/^[a-zA-Z0-9_\-]+$/.test(course.id));
  assert.strictEqual(course.name.length, 200);
  assert.strictEqual(course.semester.length, 100);
  assert.strictEqual(course.creditHours, 12);
  assert.strictEqual(course.components.length, 20); // Capped at 20 components
  assert.strictEqual(course.components[0].earned, 100); // Clamped to max
});

test('Export, clearAllData, and import round-trip', () => {
  Storage.clearAllData();

  Storage.addCourse({
    name: 'Software Engineering',
    creditHours: 3,
    semester: 'Year 2 - Sem 2',
    subject: 'Computer Science',
    components: [
      { name: 'Mid', max: 30, earned: 25 },
      { name: 'Final', max: 70, earned: 65 }
    ]
  });

  const exported = Storage.exportData();
  assert.strictEqual(Array.isArray(exported.courses), true);
  assert.strictEqual(exported.courses.length, 1);
  assert.strictEqual(exported.courses[0].name, 'Software Engineering');

  Storage.clearAllData();
  assert.strictEqual(Storage.getCourses().length, 0);

  const importResult = Storage.importData(exported);
  assert.strictEqual(importResult, true);

  const restoredCourses = Storage.getCourses();
  assert.strictEqual(restoredCourses.length, 1);
  assert.strictEqual(restoredCourses[0].name, 'Software Engineering');
  assert.strictEqual(restoredCourses[0].components.length, 2);
  assert.strictEqual(restoredCourses[0].components[0].earned, 25);
});
