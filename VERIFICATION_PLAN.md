# Active Tasks Calculation Fix - Verification Plan

## Overview

This document provides step-by-step instructions to verify that the active tasks calculation fix is working correctly across all scenarios.

## Pre-Verification Checklist

- [ ] Browser DevTools console is accessible (F12 or Cmd+Option+I)
- [ ] Application has loaded fully
- [ ] At least one repeating task exists in the system
- [ ] You have admin/debug access to the console

## Phase 1: Quick Smoke Test (2 minutes)

### Step 1.1: Run Audit Report
```javascript
DebugActiveTasks.displayAuditReport();
```

**Expected Output:**
```
═══════════════════════════════════════════════════════
ACTIVE TASKS CALCULATION AUDIT REPORT
...
✓ NO MISMATCHES - All counts are accurate
═══════════════════════════════════════════════════════
```

**If you see mismatches:**
- Note the specific mismatch type
- Check the "Detailed Task Breakdown" section
- Proceed to Phase 3 Troubleshooting

✅ **Pass:** No mismatches detected, continue to Step 1.2
❌ **Fail:** Mismatches found, go to Troubleshooting

### Step 1.2: Run Automated Tests
```javascript
TestActiveTasks.runAllTests();
```

**Expected Output:**
```
═══════════════════════════════════════════════════════
TEST RESULTS: 10 PASSED, 0 FAILED
═══════════════════════════════════════════════════════
```

✅ **Pass:** All 10 tests passed, continue to Phase 2
❌ **Fail:** Some tests failed, review individual test failures and go to Troubleshooting

---

## Phase 2: UI Verification (5 minutes)

### Step 2.1: Baseline Measurement

1. Open the dashboard (or reload current page)
2. Note the current values:
   - "Tasks Today" count (top-left pill)
   - "Pending" count
   - "Completed Today" count

```javascript
// Get exact values from code
const stats = Storage.getStats();
console.log('Baseline - Tasks Today:', stats.tasks.today);
console.log('Baseline - Pending:', stats.tasks.pending);
console.log('Baseline - Completed Today:', stats.tasks.todayCompleted);
```

**Screenshot tip:** Take a screenshot for reference

### Step 2.2: Find or Create a Repeating Task Due Today

**Option A: Use Existing Task**
1. Navigate to Tasks page
2. Look for a repeating task (cycle icon) that's due today
3. Verify it's not already completed (no checkmark)

**Option B: Create Test Task**
```javascript
const today = new Date();
const todayStr = Storage.formatDate(today);
const dayOfWeek = today.getDay();

const testTask = {
  id: `test_${Date.now()}`,
  title: 'Test Repeating Task',
  type: 'repeating',
  subject: 'Other',
  completed: false,
  completedAt: null,
  dueDate: todayStr,
  startDate: todayStr,
  repeatDays: [dayOfWeek],
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(testTask);
console.log('Created test task:', testTask.id);
```

✅ **Pass:** Have a repeating task due today that's not completed
❌ **Fail:** Cannot find or create test task, skip to Phase 2.3

### Step 2.3: Complete the Repeating Task

**Method A: Via UI**
1. Go to Tasks page
2. Find the repeating task
3. Click the checkbox to mark complete
4. Wait for UI to update

**Method B: Via Console**
```javascript
const task = Storage.getTasks().find(t => t.type === 'repeating' && t.title.includes('Test'));
if (task) {
  const today = Storage.formatDate(new Date());
  Storage.setRepeatingTaskCompletedOnDate(task.id, today, true);
  console.log('Task marked complete for today');
}
```

### Step 2.4: Verify Changes on Dashboard

**Go back to dashboard and observe:**

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Tasks Today | Decreased by 1 | ? | ? |
| Pending | Decreased by 1 | ? | ? |
| Completed Today | Increased by 1 | ? | ? |

**Verify with code:**
```javascript
const statsAfter = Storage.getStats();
console.log('After - Tasks Today:', statsAfter.tasks.today);
console.log('After - Pending:', statsAfter.tasks.pending);
console.log('After - Completed Today:', statsAfter.tasks.todayCompleted);
```

✅ **Pass:** All three metrics changed as expected
❌ **Fail:** Some metrics didn't change, check Troubleshooting

### Step 2.5: Undo Completion

**Method A: Via UI**
1. Go to Tasks page
2. Find the completed repeating task
3. Click the checkbox to mark incomplete
4. Wait for UI to update

**Method B: Via Console**
```javascript
const task = Storage.getTasks().find(t => t.type === 'repeating' && t.title.includes('Test'));
if (task) {
  const today = Storage.formatDate(new Date());
  Storage.setRepeatingTaskCompletedOnDate(task.id, today, false);
  console.log('Task unmarked as complete');
}
```

### Step 2.6: Verify Revert

**Expected:** All metrics return to baseline values

```javascript
const statsReverted = Storage.getStats();
console.log('Reverted - Tasks Today:', statsReverted.tasks.today);
console.log('Reverted - Pending:', statsReverted.tasks.pending);
console.log('Reverted - Completed Today:', statsReverted.tasks.todayCompleted);
```

✅ **Pass:** All metrics reverted to baseline
❌ **Fail:** Metrics didn't revert, check Troubleshooting

---

## Phase 3: Scenario Testing (10 minutes)

### Scenario A: Multiple Repeating Tasks

**Setup:**
```javascript
const today = new Date();
const todayStr = Storage.formatDate(today);
const dayOfWeek = today.getDay();

// Create 3 test tasks
const tasks = [];
for (let i = 0; i < 3; i++) {
  const task = {
    id: `scenario_a_${i}`,
    title: `Multiple Test ${i + 1}`,
    type: 'repeating',
    subject: 'Other',
    completed: false,
    completedAt: null,
    dueDate: todayStr,
    repeatDays: [dayOfWeek],
    createdAt: new Date().toISOString(),
    priority: 'medium',
    subtasks: []
  };
  Storage.addTask(task);
  tasks.push(task.id);
}

console.log('Created tasks:', tasks);
```

**Test:**
1. Get baseline: `DebugActiveTasks.displayAuditReport()`
2. Complete first task: `Storage.setRepeatingTaskCompletedOnDate(tasks[0], todayStr, true);`
3. Check: Counts decrease by 1
4. Complete second task: `Storage.setRepeatingTaskCompletedOnDate(tasks[1], todayStr, true);`
5. Check: Counts decrease by another 1 (now -2 from baseline)
6. Undo first task: `Storage.setRepeatingTaskCompletedOnDate(tasks[0], todayStr, false);`
7. Check: Counts increase by 1 (now -1 from baseline)
8. Complete all: Mark tasks[2] as completed
9. Check: Audit shows all 3 in completed today breakdown

✅ **Pass:** Counts update correctly as tasks are completed/uncompleted
❌ **Fail:** Counts don't track correctly with multiple tasks

**Cleanup:**
```javascript
tasks.forEach(id => Storage.deleteTask(id));
```

### Scenario B: Mixed Task Types

**Setup:**
```javascript
const today = new Date();
const todayStr = Storage.formatDate(today);

const repeating = {
  id: 'scenario_b_repeating',
  title: 'Repeating Task',
  type: 'repeating',
  subject: 'Other',
  completed: false,
  completedAt: null,
  repeatDays: [today.getDay()],
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

const oneTime = {
  id: 'scenario_b_onetime',
  title: 'One-Time Task',
  type: 'one-time',
  subject: 'Other',
  completed: false,
  completedAt: null,
  dueDate: todayStr,
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(repeating);
Storage.addTask(oneTime);
```

**Test:**
1. Check audit: Both should be pending, both active today
2. Complete repeating: `Storage.setRepeatingTaskCompletedOnDate(repeating.id, todayStr, true);`
3. Check: Pending decreased by 1, only one-time remains active today
4. Complete one-time: `Storage.completeTask(oneTime.id);`
5. Check: Both tasks now completed, pending = 0, today active = 0

✅ **Pass:** Different task types handled correctly
❌ **Fail:** Task types not handled correctly

**Cleanup:**
```javascript
Storage.deleteTask(repeating.id);
Storage.deleteTask(oneTime.id);
```

### Scenario C: Overdue Tasks

**Setup:**
```javascript
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = Storage.formatDate(yesterday);

const overdue = {
  id: 'scenario_c_overdue',
  title: 'Overdue Task',
  type: 'one-time',
  subject: 'Other',
  completed: false,
  completedAt: null,
  dueDate: yesterdayStr,
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(overdue);
```

**Test:**
1. Check audit: Should be marked as overdue and active today
2. Complete: `Storage.completeTask(overdue.id);`
3. Check: No longer in pending or active today

✅ **Pass:** Overdue tasks handled correctly
❌ **Fail:** Overdue tasks not counted correctly

**Cleanup:**
```javascript
Storage.deleteTask(overdue.id);
```

---

## Phase 4: Edge Cases (5 minutes)

### Edge Case 1: Task Across Week Boundary

**Test:** Repeating task with start date last week, due date next week
- Should be pending ✅
- Should be active today if scheduled for today ✅

```javascript
const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - 7);
const endDate = new Date(today);
endDate.setDate(today.getDate() + 7);

const weekSpan = {
  id: 'edge_week_span',
  title: 'Week Spanning Task',
  type: 'repeating',
  subject: 'Other',
  completed: false,
  completedAt: null,
  startDate: Storage.formatDate(startDate),
  dueDate: Storage.formatDate(endDate),
  repeatDays: [today.getDay()],
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(weekSpan);
DebugActiveTasks.displayAuditReport();
// Verify in breakdown: "REPEATING NOT COMPLETED TODAY (1): Due Today"

Storage.deleteTask(weekSpan.id);
```

✅ **Pass:** Week-spanning tasks handled correctly
❌ **Fail:** Date range logic broken

### Edge Case 2: Task Completed Next Day

**Test:** Complete a repeating task for today, verify it resets tomorrow
```javascript
const today = new Date();
const todayStr = Storage.formatDate(today);
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const tomorrowStr = Storage.formatDate(tomorrow);

const resetTask = {
  id: 'edge_reset_task',
  title: 'Reset Test Task',
  type: 'repeating',
  subject: 'Other',
  completed: false,
  completedAt: null,
  repeatDays: [today.getDay(), tomorrow.getDay()],
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(resetTask);

// Complete for today
Storage.setRepeatingTaskCompletedOnDate(resetTask.id, todayStr, true);
let stats = Storage.getStats();
console.log('Today - Pending includes this:', stats.tasks.pending); // Should NOT include

// This would require date manipulation - skip for now or use time travel
Storage.deleteTask(resetTask.id);
```

✅ **Pass:** Task completion logic is sound
❌ **Fail:** Reset logic broken

### Edge Case 3: Null/Empty Values

```javascript
// Task with no repeat days
const noRepeat = {
  id: 'edge_no_repeat',
  title: 'No Repeat Days',
  type: 'repeating',
  subject: 'Other',
  completed: false,
  completedAt: null,
  repeatDays: [], // Empty!
  createdAt: new Date().toISOString(),
  priority: 'medium',
  subtasks: []
};

Storage.addTask(noRepeat);
const audit = DebugActiveTasks.auditActiveTasks();

// Should be pending but NOT due today
console.log('Pending count:', audit.actualCounts.truelyPendingTasks); // Should include
console.log('Active today:', audit.actualCounts.truelyActiveTodayTasks); // Should NOT include

Storage.deleteTask(noRepeat.id);
```

✅ **Pass:** Empty values handled gracefully
❌ **Fail:** Error with null/empty data

---

## Results Summary

### Test Coverage

| Phase | Tests | Status | Notes |
|-------|-------|--------|-------|
| Phase 1 | Audit + Auto Tests | ? | Quick validation |
| Phase 2 | UI + Undo | ? | Core functionality |
| Phase 3 | Multiple + Mixed + Overdue | ? | Complex scenarios |
| Phase 4 | Week boundary + Reset + Empty | ? | Edge cases |

### Overall Assessment

- [ ] All Phases PASSED - Fix is working correctly ✅
- [ ] Phase 1 FAILED - Fix requires investigation ❌
- [ ] Phase 2 FAILED - UI integration issue ❌
- [ ] Phase 3 FAILED - Scenario handling broken ❌
- [ ] Phase 4 FAILED - Edge case issue ❌

---

## Troubleshooting Guide

### If Audit Shows Mismatches

```javascript
// Get detailed breakdown
const report = DebugActiveTasks.auditActiveTasks();
console.log(JSON.stringify(report.mismatches, null, 2));

// Identify specific problem tasks
console.log('Completed today:', report.taskBreakdown.repeatingCompletedToday);
console.log('Not completed today:', report.taskBreakdown.repeatingNotCompletedToday);
```

**Common issues:**
- Repeating task showing in both lists
- Completion key doesn't match date format
- Task state not being saved properly

### If Tests Fail

```javascript
// Run tests with verbose output
const results = TestActiveTasks.runAllTests();
results.results.forEach(r => {
  if (r.status === 'FAIL') {
    console.error('Failed:', r.name, '-', r.error);
  }
});
```

### If UI Doesn't Update

1. Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
2. Hard reload: Ctrl+F5 (or Cmd+Shift+R on Mac)
3. Check console for errors: F12 → Console tab
4. Verify `Storage.getStats()` returns new values

### If Counts Are Wrong

```javascript
// Check Storage state
console.log('All tasks:', Storage.getTasks().length);
console.log('Completions dict:', Storage.getRepeatingCompletions());

// Check specific task
const taskId = 'YOUR_TASK_ID';
const today = Storage.formatDate(new Date());
console.log(`Is completed today: ${taskId}_${today}`, 
  Storage.isRepeatingTaskCompletedOnDate(taskId, today));
```

---

## Sign-Off

**Verification Completed By:** ________________

**Date:** ________________

**Overall Status:**  ☐ PASS  ☐ FAIL

**Any Issues Found:** ___________________________________________

**Remediation Required:** ☐ Yes  ☐ No

If yes, describe: _______________________________________________
