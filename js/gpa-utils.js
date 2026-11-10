/**
 * StudyFlow - GPA Calculation Engine
 * Pure utility functions for grade conversion, course status, what-if analysis, and GPA aggregation.
 * No DOM access, no Storage access.
 */

const GpaUtils = (function() {
  'use strict';

  /**
   * Default university grading scale.
   * Sorted descending by minimum raw mark.
   * Keep this table in ONE place so it can be changed or configured later.
   */
  const GRADING_SCALE = [
    { min: 93, gp: 4.00, letter: 'A',  label: 'Excellent' },
    { min: 90, gp: 3.70, letter: 'A-', label: 'Excellent' },
    { min: 87, gp: 3.30, letter: 'B+', label: 'Very Good' },
    { min: 83, gp: 3.00, letter: 'B',  label: 'Good' },
    { min: 80, gp: 2.70, letter: 'B-', label: 'Good' },
    { min: 77, gp: 2.30, letter: 'C+', label: 'Satisfactory' },
    { min: 73, gp: 2.00, letter: 'C',  label: 'Satisfactory' },
    { min: 70, gp: 1.70, letter: 'C-', label: 'Fair' },
    { min: 67, gp: 1.30, letter: 'D+', label: 'Poor' },
    { min: 63, gp: 1.00, letter: 'D',  label: 'Poor' },
    { min: 60, gp: 0.70, letter: 'D-', label: 'Very Poor' },
    { min: 0,  gp: 0.00, letter: 'F',  label: 'Fail' }
  ];

  /**
   * Convert a raw mark (0-100) to its corresponding grade point, letter, and label.
   * Rounds raw mark to the nearest whole integer first.
   */
  function rawToGrade(mark) {
    if (!Number.isFinite(mark)) {
      return { ...GRADING_SCALE[GRADING_SCALE.length - 1] };
    }
    const rounded = Math.round(mark);
    for (let i = 0; i < GRADING_SCALE.length; i++) {
      if (rounded >= GRADING_SCALE[i].min) {
        return { ...GRADING_SCALE[i] };
      }
    }
    return { ...GRADING_SCALE[GRADING_SCALE.length - 1] };
  }

  /**
   * Calculate detailed grading status for a course.
   * Course object shape: { id, name, creditHours, components: [{ id, name, max, earned }] }
   */
  function courseStatus(course) {
    const components = Array.isArray(course?.components) ? course.components : [];
    let earned = 0;
    let gradedMax = 0;
    let ungradedMax = 0;
    let hasUngraded = false;

    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      const max = Number.isFinite(Number(c.max)) ? Number(c.max) : 0;
      if (c.earned !== null && c.earned !== undefined && Number.isFinite(Number(c.earned))) {
        const e = Number(c.earned);
        earned += Math.max(0, Math.min(max, e));
        gradedMax += max;
      } else {
        ungradedMax += max;
        hasUngraded = true;
      }
    }

    const currentMark = earned;
    const isComplete = !hasUngraded && components.length > 0;
    const percentOfGraded = gradedMax > 0 ? (earned / gradedMax) * 100 : null;
    const projectedMark = percentOfGraded !== null ? percentOfGraded : null;
    const bestCaseMark = earned + ungradedMax;
    const worstCaseMark = earned;

    let grade;
    if (isComplete) {
      grade = { ...rawToGrade(currentMark), isProjected: false };
    } else if (projectedMark !== null) {
      grade = { ...rawToGrade(projectedMark), isProjected: true };
    } else {
      grade = { ...rawToGrade(0), isProjected: true };
    }

    return {
      earned,
      gradedMax,
      ungradedMax,
      currentMark,
      percentOfGraded,
      projectedMark,
      bestCaseMark,
      worstCaseMark,
      isComplete,
      grade
    };
  }

  /**
   * Determine required score on remaining ungraded points to reach targetMark.
   * targetMark: number (0-100)
   * Returns:
   *  - { status: 'secured', pointsNeeded: 0, percentNeeded: 0 }
   *  - { status: 'unreachable', pointsNeeded: ..., percentNeeded: ... }
   *  - { status: 'reachable', pointsNeeded, percentNeeded }
   */
  function requiredOnRemaining(course, targetMark) {
    const status = courseStatus(course);
    const needed = targetMark - status.earned;

    if (needed <= 0) {
      return { status: 'secured', pointsNeeded: 0, percentNeeded: 0 };
    }

    if (status.bestCaseMark < targetMark || status.ungradedMax <= 0) {
      return { status: 'unreachable', pointsNeeded: needed, percentNeeded: null };
    }

    const percentNeeded = (needed / status.ungradedMax) * 100;
    return {
      status: 'reachable',
      pointsNeeded: Math.round(needed * 100) / 100,
      percentNeeded: Math.round(percentNeeded * 10) / 10
    };
  }

  /**
   * Calculate credit-weighted semester or cumulative GPA.
   * Options: { includeProjected: boolean }
   * Formula: sum(gp * creditHours) / sum(creditHours)
   */
  function calculateWeightedGpa(courses, options = {}) {
    if (!Array.isArray(courses) || courses.length === 0) {
      return { gpa: 0, totalCredits: 0, countedCourses: 0 };
    }

    const includeProjected = Boolean(options.includeProjected);
    let totalQualityPoints = 0;
    let totalCredits = 0;
    let countedCourses = 0;

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const status = courseStatus(course);
      const isCountable = course.finalized || status.isComplete || (includeProjected && status.gradedMax > 0);

      if (!isCountable) continue;

      const credits = Number.isFinite(Number(course.creditHours)) ? Number(course.creditHours) : 3;
      const gp = status.grade.gp;

      totalQualityPoints += gp * credits;
      totalCredits += credits;
      countedCourses++;
    }

    if (totalCredits <= 0) {
      return { gpa: 0, totalCredits: 0, countedCourses: 0 };
    }

    const rawGpa = totalQualityPoints / totalCredits;
    const roundedGpa = Math.round(rawGpa * 100) / 100;

    return {
      gpa: roundedGpa,
      rawGpa,
      totalCredits,
      countedCourses
    };
  }

  function semesterGpa(courses, options = {}) {
    return calculateWeightedGpa(courses, options);
  }

  function cgpa(courses, options = {}) {
    return calculateWeightedGpa(courses, options);
  }

  /**
   * Group courses by semester string (e.g. "Year 1 - Sem 1").
   * Preserves insertion order of semesters encountered.
   */
  function groupBySemester(courses) {
    const groups = {};
    if (!Array.isArray(courses)) return groups;

    for (let i = 0; i < courses.length; i++) {
      const c = courses[i];
      const sem = (c.semester && typeof c.semester === 'string' && c.semester.trim()) ? c.semester.trim() : 'Unassigned';
      if (!groups[sem]) {
        groups[sem] = [];
      }
      groups[sem].push(c);
    }
    return groups;
  }

  return {
    GRADING_SCALE,
    rawToGrade,
    courseStatus,
    requiredOnRemaining,
    semesterGpa,
    cgpa,
    groupBySemester
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GpaUtils;
}
if (typeof window !== 'undefined') {
  window.GpaUtils = GpaUtils;
}
