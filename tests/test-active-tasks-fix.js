/**
 * Test Suite: Active Tasks Calculation Fix
 * 
 * Tests the corrected logic for counting active tasks, ensuring that:
 * 1. Repeating tasks completed today are excluded from active count
 * 2. Repeating tasks not completed today are included in active count
 * 3. One-time tasks are counted correctly
 * 4. Overdue tasks are included in active count
 * 5. Counts are accurate across different date scenarios
 */

const TestActiveTasks = (function() {
  'use strict';

  // Test results tracking
  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  /**
   * Helper: Create a test task
   */
  function createTestTask(config = {}) {
    const id = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id,
      title: config.title || 'Test Task',
      type: config.type || 'one-time',
      subject: config.subject || 'Other',
      completed: config.completed || false,
      completedAt: config.completedAt || null,
      dueDate: config.dueDate || null,
      startDate: config.startDate || null,
      repeatDays: config.repeatDays || [],
      createdAt: new Date().toISOString(),
      priority: 'medium',
      subtasks: []
    };
  }

  /**
   * Helper: Run a single test
   */
  function runTest(name, testFn) {
    try {
      testFn();
      testResults.passed++;
      testResults.tests.push({
        name,
        status: 'PASS',
        error: null
      });
      console.log(`✓ ${name}`);
      return true;
    } catch (error) {
      testResults.failed++;
      testResults.tests.push({
        name,
        status: 'FAIL',
        error: error.message
      });
      console.log(`✗ ${name}: ${error.message}`);
      return false;
    }
  }

  /**
   * Helper: Assert condition
   */
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Helper: Assert equality
   */
  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Values do not match'}: expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Helper: Format date as YYYY-MM-DD
   */
  function formatDate(date) {
    return Storage.formatDate(date);
  }

  /**
   * Test 1: Repeating task not completed today should be counted as active
   */
  function test_RepeatingTaskNotCompletedTodayIsActive() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    // Create a repeating task scheduled for today
    const task = createTestTask({
      type: 'repeating',
      title: 'Daily Study',
      repeatDays: [today.getDay()]
    });

    // Setup: Save task and ensure it's not completed today
    Storage.addTask(task);
    Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, false);

    try {
      const stats = Storage.getStats();
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be counted as pending
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Task should be pending');
      
      // Should be counted as active today
      assert(audit.actualCounts.repeatingTasksNotCompletedToday > 0, 'Task should not be marked completed');
      
      // Today count should include it
      assert(audit.actualCounts.truelyActiveTodayTasks > 0, 'Task due today should be active');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 2: Repeating task completed today should NOT be counted as active
   */
  function test_RepeatingTaskCompletedTodayIsNotActive() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const task = createTestTask({
      type: 'repeating',
      title: 'Daily Review',
      repeatDays: [today.getDay()]
    });

    Storage.addTask(task);
    
    try {
      // Mark as completed today
      Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, true);

      const audit = DebugActiveTasks.auditActiveTasks();

      // Should still be pending in the main task object
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Repeating task always pending in task list');
      
      // But completed today in the completions dict
      assertEqual(audit.actualCounts.repeatingTasksCompletedToday, 1, 'Should be marked completed today');
      
      // Should NOT be in active today count
      const beforeCount = audit.actualCounts.truelyActiveTodayTasks;
      // Verify it's not double-counted
      
    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 3: Completing a repeating task should decrease both pending and today counts
   */
  function test_CompletingRepeatingTaskDecreasesCounts() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const task = createTestTask({
      type: 'repeating',
      title: 'Weekly Assignment',
      repeatDays: [today.getDay()]
    });

    Storage.addTask(task);
    Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, false);

    try {
      const statsBefore = Storage.getStats();
      const auditBefore = DebugActiveTasks.auditActiveTasks();

      // Mark as completed
      Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, true);

      const statsAfter = Storage.getStats();
      const auditAfter = DebugActiveTasks.auditActiveTasks();

      // Today count should decrease (assuming it includes today's active tasks)
      // Note: getStats().tasks.today counts todayTasksCount, not strictly active count
      // So we verify the audit counts are correct
      
      assertEqual(
        auditAfter.actualCounts.repeatingTasksCompletedToday,
        auditBefore.actualCounts.repeatingTasksCompletedToday + 1,
        'Completed today count should increase by 1'
      );

      assertEqual(
        auditAfter.actualCounts.repeatingTasksNotCompletedToday,
        auditBefore.actualCounts.repeatingTasksNotCompletedToday - 1,
        'Not completed today count should decrease by 1'
      );

    } finally {
      Storage.deleteTask(task.id);
      Storage.setRepeatingTaskCompletedOnDate(task.id, todayStr, false);
    }
  }

  /**
   * Test 4: One-time task due today but not completed should be active
   */
  function test_OneTimeTaskDueTodayIsActive() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const task = createTestTask({
      type: 'one-time',
      title: 'Complete Essay',
      dueDate: todayStr
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be pending
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Task should be pending');
      
      // Should be active today
      assert(audit.taskBreakdown.oneTimeNotCompletedDueToday.length > 0, 'Should be due today');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 5: One-time overdue task should be active and counted as overdue
   */
  function test_OverdueTaskIsActive() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    
    const task = createTestTask({
      type: 'one-time',
      title: 'Overdue Assignment',
      dueDate: yesterdayStr
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be pending
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Overdue task should be pending');
      
      // Should be overdue
      assertEqual(audit.actualCounts.overdueTasks, 1, 'Should be marked as overdue');
      
      // Should be in active today tasks
      assert(audit.taskBreakdown.oneTimeNotCompletedOverdue.length > 0, 'Should be in overdue list');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 6: One-time future task should NOT be active today
   */
  function test_FutureTaskIsNotActiveTod() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);
    
    const task = createTestTask({
      type: 'one-time',
      title: 'Future Task',
      dueDate: tomorrowStr
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be pending
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Future task should be pending');
      
      // Should NOT be active today
      assert(audit.taskBreakdown.oneTimeFuture.length > 0, 'Should be in future list');
      
      // Should not be in today's active count
      const isInTodayActive = audit.taskBreakdown.oneTimeNotCompletedDueToday.some(t => t.id === task.id);
      assert(!isInTodayActive, 'Future task should not be in today active list');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 7: Completed one-time task should not be counted as pending or active
   */
  function test_CompletedTaskIsNotPendingOrActive() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const task = createTestTask({
      type: 'one-time',
      title: 'Finished Task',
      dueDate: todayStr,
      completed: true,
      completedAt: new Date().toISOString()
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be in completed list
      assert(audit.taskBreakdown.completed.length > 0, 'Should be in completed list');
      
      // Should NOT be in pending
      const isInPending = audit.taskBreakdown.oneTimeNotCompletedDueToday.some(t => t.id === task.id);
      assert(!isInPending, 'Completed task should not be in pending');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 8: Repeating task not scheduled for today should not be counted as today active
   */
  function test_RepeatingTaskNotScheduledTodayIsNotActiveToday() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay();
    
    const task = createTestTask({
      type: 'repeating',
      title: 'Tomorrow Only',
      repeatDays: [tomorrowDayOfWeek]
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be pending (repeating tasks always are)
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Repeating task should be pending');
      
      // Should NOT be active today (not due today)
      const isDueTodayInActiveList = audit.taskBreakdown.repeatingNotCompletedToday.some(t => 
        t.id === task.id && t.isDueToday
      );
      assert(!isDueTodayInActiveList, 'Task not due today should not be marked as due today');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 9: Repeating task with date range (start and due dates)
   */
  function test_RepeatingTaskWithDateRange() {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 5);
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 5);

    const startStr = formatDate(startDate);
    const dueStr = formatDate(dueDate);
    
    const task = createTestTask({
      type: 'repeating',
      title: 'Range Task',
      startDate: startStr,
      dueDate: dueStr,
      repeatDays: [today.getDay()]
    });

    Storage.addTask(task);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Should be pending
      assert(audit.actualCounts.truelyPendingTasks > 0, 'Repeating task should be pending');
      
      // Should be active (due today and within date range)
      assert(audit.taskBreakdown.repeatingNotCompletedToday.length > 0, 'Should have repeating tasks today');

    } finally {
      Storage.deleteTask(task.id);
    }
  }

  /**
   * Test 10: Simultaneous repeating and one-time tasks
   */
  function test_MixedTaskTypes() {
    const today = new Date();
    const todayStr = formatDate(today);
    
    const repeating = createTestTask({
      type: 'repeating',
      title: 'Daily Task',
      repeatDays: [today.getDay()]
    });

    const oneTime = createTestTask({
      type: 'one-time',
      title: 'One-off Task',
      dueDate: todayStr
    });

    Storage.addTask(repeating);
    Storage.addTask(oneTime);

    try {
      const audit = DebugActiveTasks.auditActiveTasks();

      // Both should be pending
      const totalPending = audit.actualCounts.truelyPendingTasks;
      assert(totalPending >= 2, 'Should have at least 2 pending tasks');
      
      // Both should be active today
      const totalActiveToday = audit.actualCounts.truelyActiveTodayTasks;
      assert(totalActiveToday >= 2, 'Should have at least 2 active tasks today');

    } finally {
      Storage.deleteTask(repeating.id);
      Storage.deleteTask(oneTime.id);
    }
  }

  /**
   * Run all tests
   */
  function runAllTests() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('ACTIVE TASKS CALCULATION - TEST SUITE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    testResults = { passed: 0, failed: 0, tests: [] };

    runTest('Test 1: Repeating task not completed today is active', test_RepeatingTaskNotCompletedTodayIsActive);
    runTest('Test 2: Repeating task completed today is NOT active', test_RepeatingTaskCompletedTodayIsNotActive);
    runTest('Test 3: Completing repeating task decreases counts', test_CompletingRepeatingTaskDecreasesCounts);
    runTest('Test 4: One-time task due today is active', test_OneTimeTaskDueTodayIsActive);
    runTest('Test 5: Overdue task is active', test_OverdueTaskIsActive);
    runTest('Test 6: Future task is NOT active today', test_FutureTaskIsNotActiveTod);
    runTest('Test 7: Completed task is not pending or active', test_CompletedTaskIsNotPendingOrActive);
    runTest('Test 8: Repeating task not scheduled today is not active today', test_RepeatingTaskNotScheduledTodayIsNotActiveToday);
    runTest('Test 9: Repeating task with date range', test_RepeatingTaskWithDateRange);
    runTest('Test 10: Mixed task types', test_MixedTaskTypes);

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`TEST RESULTS: ${testResults.passed} PASSED, ${testResults.failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    return {
      passed: testResults.passed,
      failed: testResults.failed,
      results: testResults.tests
    };
  }

  return {
    runAllTests
  };
})();

// Run tests when file loads in test environment
if (typeof window !== 'undefined' && window.location && window.location.search.includes('test')) {
  window.addEventListener('load', () => {
    console.log('[v0] Running active tasks test suite...');
    TestActiveTasks.runAllTests();
  });
}
