# Active Tasks Calculation Fix - Quick Reference Guide

## Overview

The active tasks calculation bug in `getStats()` has been fixed. Repeating tasks completed today are no longer incorrectly counted as pending/active.

## Quick Test

### In the Browser Console

```javascript
// 1. Run the audit to see detailed breakdown
DebugActiveTasks.displayAuditReport();

// 2. Test the completion flow
DebugActiveTasks.testRepeatingTaskCompletion();

// 3. Run all automated tests
TestActiveTasks.runAllTests();
```

## What Was Fixed

**Problem:** Repeating tasks marked as complete today were still counted as "pending" and "active today"

**Solution:** Modified `getStats()` in `storage.js` to check `repeatingCompletions` during the main task loop instead of after

## Verifying the Fix Works

### Step 1: Check Current Status

```javascript
DebugActiveTasks.displayAuditReport();
```

**Expected Output:**
- ✓ NO MISMATCHES - All counts are accurate
- Reported stats match actual counts
- Repeating tasks completed today appear in breakdown under "REPEATING COMPLETED TODAY"

### Step 2: Complete a Repeating Task

1. Find any repeating task due today
2. Mark it as complete
3. Run the audit again:

```javascript
DebugActiveTasks.displayAuditReport();
```

**Expected Changes:**
- `Pending Tasks` count decreased by 1
- `Active Today` count decreased by 1
- `Completed Today` count increased by 1

### Step 3: Run Comprehensive Tests

```javascript
TestActiveTasks.runAllTests();
```

**Expected Output:**
```
═══════════════════════════════════════════════════════
ACTIVE TASKS CALCULATION - TEST SUITE
═══════════════════════════════════════════════════════

✓ Test 1: Repeating task not completed today is active
✓ Test 2: Repeating task completed today is NOT active
✓ Test 3: Completing repeating task decreases counts
✓ Test 4: One-time task due today is active
✓ Test 5: Overdue task is active
✓ Test 6: Future task is NOT active today
✓ Test 7: Completed task is not pending or active
✓ Test 8: Repeating task not scheduled today is not active today
✓ Test 9: Repeating task with date range
✓ Test 10: Mixed task types

═══════════════════════════════════════════════════════
TEST RESULTS: 10 PASSED, 0 FAILED
═══════════════════════════════════════════════════════
```

## Manual Verification Checklist

- [ ] **Dashboard counts:** Complete a repeating task and verify count decreases on dashboard
- [ ] **Goals progress:** Complete a task and verify goals progress bar updates
- [ ] **Calendar view:** Check that repeating tasks show as completed on the calendar for today
- [ ] **Pending count:** Verify pending count decreases when repeating task is completed
- [ ] **Today count:** Verify "Tasks Today" count decreases when repeating task is completed
- [ ] **Completed count:** Verify "Completed Today" count increases when repeating task is completed
- [ ] **Undo action:** Verify counts revert when completion is undone
- [ ] **Multiple tasks:** Test with multiple repeating tasks in different states
- [ ] **Different times:** Test completing tasks at different times during the day
- [ ] **Next day:** Verify repeating task resets as pending the next day

## Debug Functions Available

### `DebugActiveTasks.auditActiveTasks()`
Returns detailed audit report object with:
- `stats` - Reported stats from `getStats()`
- `actualCounts` - Calculated actual counts
- `mismatches` - Array of any discrepancies found
- `taskBreakdown` - Organized list of tasks by status

### `DebugActiveTasks.displayAuditReport()`
Prints formatted audit report to console with:
- Comparison of reported vs actual counts
- Task breakdown by category
- Detailed list of any mismatches
- Full task breakdown with IDs and titles

### `DebugActiveTasks.testRepeatingTaskCompletion()`
Simulates completing a repeating task and verifies:
- Pending count decreases
- Today count decreases
- Completed count increases
Returns object with: `{ passed: boolean, details: {...} }`

### `TestActiveTasks.runAllTests()`
Runs 10 comprehensive tests covering:
- All task type combinations
- Date range scenarios
- Overdue tasks
- Future tasks
- Mixed task types

Returns test results with passed/failed counts

## Where Code Was Changed

### Modified Files
- **`js/storage.js`** - Fixed `getStats()` function (lines 760-813)
  - Moved repeating completion check into main task loop
  - Fixed pending and today counts
  - Removed duplicate completion counting

### New Files
- **`js/debug-active-tasks.js`** - Debug utility module
- **`tests/test-active-tasks-fix.js`** - Comprehensive test suite
- **`ACTIVE_TASKS_FIX.md`** - Detailed technical documentation
- **`DEBUG_GUIDE.md`** - This quick reference guide

## Troubleshooting

### Counts still show mismatches

1. Check if all tasks are properly saved:
   ```javascript
   console.log('Total tasks:', Storage.getTasks().length);
   ```

2. Check repeating completions are being tracked:
   ```javascript
   console.log('Completions:', Storage.getRepeatingCompletions());
   ```

3. Clear browser cache and reload if using an older version

### Specific task not counted correctly

1. Get the task ID and date:
   ```javascript
   const task = Storage.getTasks().find(t => t.title.includes('search text'));
   const today = Storage.formatDate(new Date());
   console.log('Task ID:', task.id, 'Today:', today);
   ```

2. Check its completion status:
   ```javascript
   const key = `${task.id}_${today}`;
   console.log('Is completed today:', Storage.getRepeatingCompletions()[key]);
   ```

3. Manually set if needed:
   ```javascript
   Storage.setRepeatingTaskCompletedOnDate(task.id, today, true);
   ```

4. Verify the change:
   ```javascript
   DebugActiveTasks.displayAuditReport();
   ```

## Performance Impact

✓ **Slight improvement** - `getRepeatingCompletions()` called once instead of multiple times
✓ **No breaking changes** - Fully backward compatible
✓ **No new dependencies** - Uses existing Storage module

## Related Files

- Full technical details: `/ACTIVE_TASKS_FIX.md`
- Test scenarios: `/tests/test-active-tasks-fix.js`
- Debug utility: `/js/debug-active-tasks.js`
- Implementation plan: `/v0_plans/grand-process.md`

## Support

If issues persist:

1. Run full diagnostic:
   ```javascript
   const report = DebugActiveTasks.auditActiveTasks();
   console.log(JSON.stringify(report, null, 2));
   ```

2. Check browser console for errors
3. Review `/ACTIVE_TASKS_FIX.md` for detailed debugging tips
4. Verify all script files are loading (check Network tab in DevTools)
