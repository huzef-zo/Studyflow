/**
 * Active Tasks Calculation Debug Utility
 * 
 * This utility helps identify and diagnose issues with the active tasks counting logic.
 * It compares what's counted as active tasks vs. what should actually be counted.
 * 
 * ISSUE IDENTIFIED:
 * In getStats(), repeating tasks marked as completed today are NOT being excluded from
 * the active task count. The function checks repeatingCompletions to ADD to todayCompleted,
 * but does NOT check repeatingCompletions when counting pendingCount or todayTasksCount.
 * 
 * AFFECTED LINES: 761-792 in storage.js
 * - Lines 761-792: Check if task.completed is true, but repeating tasks have completed=false
 *   while having an entry in repeatingCompletions for today
 * - Lines 779-785: Count pending repeating tasks without checking if they're completed today
 */

const DebugActiveTasks = (function() {
  'use strict';

  /**
   * Audit active task calculations
   * Compares the count reported by getStats() with actual task status
   * 
   * Returns an audit report with detailed mismatches
   */
  function auditActiveTasks() {
    const tasks = Storage.getTasks();
    const stats = Storage.getStats();
    const now = new Date();
    const todayStr = Storage.formatDate(now);
    const completions = Storage.getRepeatingCompletions();

    const report = {
      timestamp: new Date().toISOString(),
      todayStr,
      stats: {
        pending: stats.tasks.pending,
        today: stats.tasks.today,
        todayCompleted: stats.tasks.todayCompleted
      },
      actualCounts: {
        truelyPendingTasks: 0,
        truelyActiveTodayTasks: 0,
        repeatingTasksCompletedToday: 0,
        repeatingTasksNotCompletedToday: 0,
        oneTimeTasksDueToday: 0,
        overdueTasks: 0
      },
      mismatches: [],
      taskBreakdown: {
        completed: [],
        repeatingCompletedToday: [],
        repeatingNotCompletedToday: [],
        oneTimeNotCompletedDueToday: [],
        oneTimeNotCompletedOverdue: [],
        oneTimeFuture: []
      }
    };

    const dayOfWeek = now.getDay();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Analyze each task
    tasks.forEach(t => {
      const taskInfo = {
        id: t.id,
        title: t.title,
        type: t.type,
        completed: t.completed,
        completedAt: t.completedAt,
        dueDate: t.dueDate,
        startDate: t.startDate,
        repeatDays: t.repeatDays
      };

      if (t.completed) {
        // Task is marked as completed in the main task object
        report.taskBreakdown.completed.push(taskInfo);
      } else if (t.type === 'repeating') {
        // Repeating task: check if it has a completion entry for today
        const completionKey = `${t.id}_${todayStr}`;
        const isCompletedToday = completions[completionKey] === true;
        const isDueToday = t.repeatDays && t.repeatDays.includes(dayOfWeek);

        if (isCompletedToday) {
          report.taskBreakdown.repeatingCompletedToday.push({
            ...taskInfo,
            completedToday: true
          });
          report.actualCounts.repeatingTasksCompletedToday++;
        } else {
          report.taskBreakdown.repeatingNotCompletedToday.push({
            ...taskInfo,
            completedToday: false,
            isDueToday
          });
          report.actualCounts.repeatingTasksNotCompletedToday++;
          if (isDueToday) report.actualCounts.truelyActiveTodayTasks++;
        }
        report.actualCounts.truelyPendingTasks++;
      } else {
        // One-time task
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        const start = t.startDate ? new Date(t.startDate) : dueDate;
        const isDueToday = todayStr >= (t.startDate || t.dueDate) && todayStr <= t.dueDate;
        const isOverdue = dueDate && dueDate < today;

        if (isOverdue) {
          report.taskBreakdown.oneTimeNotCompletedOverdue.push({
            ...taskInfo,
            isOverdue: true
          });
          report.actualCounts.overdueTasks++;
          report.actualCounts.truelyActiveTodayTasks++;
        } else if (isDueToday) {
          report.taskBreakdown.oneTimeNotCompletedDueToday.push({
            ...taskInfo,
            isDueToday: true
          });
          report.actualCounts.oneTimeTasksDueToday++;
          report.actualCounts.truelyActiveTodayTasks++;
        } else {
          report.taskBreakdown.oneTimeFuture.push(taskInfo);
        }
        report.actualCounts.truelyPendingTasks++;
      }
    });

    // Identify mismatches
    if (report.stats.pending !== report.actualCounts.truelyPendingTasks) {
      report.mismatches.push({
        type: 'PENDING_COUNT_MISMATCH',
        reported: report.stats.pending,
        actual: report.actualCounts.truelyPendingTasks,
        difference: report.stats.pending - report.actualCounts.truelyPendingTasks,
        explanation: report.actualCounts.repeatingTasksCompletedToday > 0
          ? `Repeating tasks completed today are being counted as pending. Count: ${report.actualCounts.repeatingTasksCompletedToday}`
          : 'Unknown mismatch source'
      });
    }

    if (report.stats.today !== report.actualCounts.truelyActiveTodayTasks) {
      report.mismatches.push({
        type: 'TODAY_ACTIVE_COUNT_MISMATCH',
        reported: report.stats.today,
        actual: report.actualCounts.truelyActiveTodayTasks,
        difference: report.stats.today - report.actualCounts.truelyActiveTodayTasks,
        explanation: report.actualCounts.repeatingTasksCompletedToday > 0
          ? `Repeating tasks completed today are being counted as active. Count: ${report.actualCounts.repeatingTasksCompletedToday}`
          : 'Unknown mismatch source'
      });
    }

    return report;
  }

  /**
   * Format and display the audit report
   */
  function displayAuditReport() {
    const report = auditActiveTasks();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('ACTIVE TASKS CALCULATION AUDIT REPORT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Date: ${report.timestamp}`);
    console.log(`Today: ${report.todayStr}`);
    console.log('');
    
    console.log('REPORTED STATS vs ACTUAL COUNTS');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Pending Tasks:   ${report.stats.pending} (reported) vs ${report.actualCounts.truelyPendingTasks} (actual)`);
    console.log(`Active Today:    ${report.stats.today} (reported) vs ${report.actualCounts.truelyActiveTodayTasks} (actual)`);
    console.log(`Completed Today: ${report.stats.todayCompleted} (reported)`);
    console.log('');

    console.log('ACTUAL TASK BREAKDOWN');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`✓ Permanently Completed: ${report.taskBreakdown.completed.length}`);
    console.log(`⟳ Repeating Completed Today: ${report.taskBreakdown.repeatingCompletedToday.length}`);
    console.log(`⟳ Repeating NOT Completed Today: ${report.taskBreakdown.repeatingNotCompletedToday.length}`);
    console.log(`  - Due Today: ${report.taskBreakdown.repeatingNotCompletedToday.filter(t => t.isDueToday).length}`);
    console.log(`📋 One-Time Due Today: ${report.taskBreakdown.oneTimeNotCompletedDueToday.length}`);
    console.log(`⚠️  Overdue: ${report.taskBreakdown.oneTimeNotCompletedOverdue.length}`);
    console.log(`📅 Future: ${report.taskBreakdown.oneTimeFuture.length}`);
    console.log('');

    if (report.mismatches.length > 0) {
      console.log('⚠️  MISMATCHES DETECTED');
      console.log('─────────────────────────────────────────────────────────');
      report.mismatches.forEach((mismatch, idx) => {
        console.log(`${idx + 1}. ${mismatch.type}`);
        console.log(`   Reported: ${mismatch.reported}, Actual: ${mismatch.actual}, Diff: ${mismatch.difference}`);
        console.log(`   Cause: ${mismatch.explanation}`);
      });
    } else {
      console.log('✓ NO MISMATCHES - All counts are accurate');
    }
    console.log('');

    console.log('DETAILED TASK BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════');
    
    if (report.taskBreakdown.repeatingCompletedToday.length > 0) {
      console.log(`⟳ REPEATING COMPLETED TODAY (${report.taskBreakdown.repeatingCompletedToday.length}):`);
      report.taskBreakdown.repeatingCompletedToday.forEach(t => {
        console.log(`   • [${t.id}] ${t.title}`);
      });
      console.log('');
    }

    if (report.taskBreakdown.repeatingNotCompletedToday.length > 0) {
      console.log(`⟳ REPEATING NOT COMPLETED TODAY (${report.taskBreakdown.repeatingNotCompletedToday.length}):`);
      report.taskBreakdown.repeatingNotCompletedToday.forEach(t => {
        console.log(`   • [${t.id}] ${t.title}${t.isDueToday ? ' (DUE TODAY)' : ''}`);
      });
      console.log('');
    }

    if (report.taskBreakdown.oneTimeNotCompletedDueToday.length > 0) {
      console.log(`📋 ONE-TIME DUE TODAY (${report.taskBreakdown.oneTimeNotCompletedDueToday.length}):`);
      report.taskBreakdown.oneTimeNotCompletedDueToday.forEach(t => {
        console.log(`   • [${t.id}] ${t.title} (due: ${t.dueDate})`);
      });
      console.log('');
    }

    if (report.taskBreakdown.oneTimeNotCompletedOverdue.length > 0) {
      console.log(`⚠️  OVERDUE (${report.taskBreakdown.oneTimeNotCompletedOverdue.length}):`);
      report.taskBreakdown.oneTimeNotCompletedOverdue.forEach(t => {
        console.log(`   • [${t.id}] ${t.title} (was due: ${t.dueDate})`);
      });
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════');
    return report;
  }

  /**
   * Test function to verify the fix
   * Simulates completing a repeating task and verifies counts update correctly
   */
  function testRepeatingTaskCompletion() {
    console.log('[v0] Testing repeating task completion scenario...');
    
    // Find or create a repeating task
    let repeatingTask = Storage.getTasks().find(t => t.type === 'repeating');
    if (!repeatingTask) {
      console.log('[v0] No repeating tasks found, skipping test');
      return;
    }

    const today = new Date();
    const todayStr = Storage.formatDate(today);
    const completionKey = `${repeatingTask.id}_${todayStr}`;

    // Get baseline
    let statsBefore = Storage.getStats();
    let auditBefore = auditActiveTasks();

    console.log(`[v0] Before marking complete:`);
    console.log(`[v0]   Pending: ${statsBefore.tasks.pending}`);
    console.log(`[v0]   Today: ${statsBefore.tasks.today}`);
    console.log(`[v0]   Audit - Repeating Completed Today: ${auditBefore.actualCounts.repeatingTasksCompletedToday}`);

    // Mark repeating task completed for today
    Storage.setRepeatingTaskCompletedOnDate(repeatingTask.id, todayStr, true);

    // Get after state
    let statsAfter = Storage.getStats();
    let auditAfter = auditActiveTasks();

    console.log(`[v0] After marking complete:`);
    console.log(`[v0]   Pending: ${statsAfter.tasks.pending} (was ${statsBefore.tasks.pending})`);
    console.log(`[v0]   Today: ${statsAfter.tasks.today} (was ${statsBefore.tasks.today})`);
    console.log(`[v0]   Audit - Repeating Completed Today: ${auditAfter.actualCounts.repeatingTasksCompletedToday} (was ${auditBefore.actualCounts.repeatingTasksCompletedToday})`);

    // Check expectations
    const pendingDecreased = statsAfter.tasks.pending < statsBefore.tasks.pending;
    const todayDecreased = statsAfter.tasks.today < statsBefore.tasks.today;
    const completedIncreased = auditAfter.actualCounts.repeatingTasksCompletedToday > auditBefore.actualCounts.repeatingTasksCompletedToday;

    console.log(`[v0] Validation:`);
    console.log(`[v0]   Pending decreased: ${pendingDecreased ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`[v0]   Today decreased: ${todayDecreased ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`[v0]   Completed increased: ${completedIncreased ? '✓ PASS' : '✗ FAIL'}`);

    // Cleanup
    Storage.setRepeatingTaskCompletedOnDate(repeatingTask.id, todayStr, false);

    return {
      passed: pendingDecreased && todayDecreased && completedIncreased,
      details: { pendingDecreased, todayDecreased, completedIncreased }
    };
  }

  return {
    auditActiveTasks,
    displayAuditReport,
    testRepeatingTaskCompletion
  };
})();

// Make available globally for console debugging
if (typeof window !== 'undefined') {
  window.DebugActiveTasks = DebugActiveTasks;
}
