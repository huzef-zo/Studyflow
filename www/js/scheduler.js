/**
 * StudyFlow - Smart Study Scheduler Module
 * Implements 3-pass algorithm for allocating study blocks
 */

const Scheduler = (function() {
  'use strict';

  function init() {
    // Initialization if needed
  }

  function parseMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function formatMinutes(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }

  /**
   * Generates a study plan for the given day
   */
  function generatePlan(date = new Date()) {
    const dayOfWeek = date.getDay();
    const dateStr = Storage.formatDate(date);

    // Pass 1: Collect and Priority Sort
    const items = collectDueItems(date);

    // Pass 2: Allocate Blocks
    const windows = getWindowsForDay(dayOfWeek);
    const blocks = allocateBlocks(items, windows, dateStr);

    // Pass 3: Optimize
    const optimized = optimizeBlocks(blocks);

    return optimized;
  }

  function collectDueItems(date) {
    const dayOfWeek = date.getDay();
    const todayStr = Storage.formatDate(date);
    // OPTIMIZATION: Query raw tasks directly from storage to avoid getTasks() redundant repeating completion resolution passes
    const rawTasks = Storage.loadData ? Storage.loadData(Storage.KEYS.TASKS, Storage.DEFAULTS.tasks) : [];
    const masteryStats = Storage.getSubjectMasteryStats ? Storage.getSubjectMasteryStats() : [];

    const items = [];

    // Precalculate base date midnight timestamp for fast days-until math
    const baseDate = Storage.parseLocalDate ? Storage.parseLocalDate(todayStr) : new Date(date);
    if (baseDate) baseDate.setHours(0, 0, 0, 0);
    const baseTime = baseDate ? baseDate.getTime() : 0;

    for (let i = 0; i < rawTasks.length; i++) {
      const t = rawTasks[i];
      if (t.type === 'repeating') {
        // Only include if scheduled for today and not completed today
        if (t.repeatDays && t.repeatDays.includes(dayOfWeek) && !Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr)) {
          let estimatedCycles = 1;
          if (t.subtasks && t.subtasks.length > 0) {
            let cycles = 0;
            for (let s = 0; s < t.subtasks.length; s++) {
              cycles += ((t.subtasks[s].estimatedCycles || 1) - (t.subtasks[s].completedCycles || 0));
            }
            estimatedCycles = cycles > 0 ? cycles : 1;
          }
          items.push({
            type: 'task',
            priority: t.priority === 'critical' ? 2 : (t.priority === 'high' ? 3 : (t.priority === 'medium' ? 5 : 7)),
            label: t.title,
            subject: t.subject,
            taskId: t.id,
            estimatedCycles
          });
        }
        continue;
      }

      if (t.completed) continue;

      let daysUntil = 999;
      if (t.dueDate && baseTime) {
        const targetDate = Storage.parseLocalDate ? Storage.parseLocalDate(t.dueDate) : null;
        if (targetDate) {
          targetDate.setHours(0, 0, 0, 0);
          daysUntil = Math.round((targetDate.getTime() - baseTime) / 86400000);
        }
      }

      let priority = 999;
      if (daysUntil <= 3 && t.priority === 'critical') priority = 2;
      else if (daysUntil <= 7 && t.priority === 'high') priority = 3;
      else if (daysUntil <= 14 && t.priority === 'medium') priority = 5;
      else if (daysUntil <= 30 && t.priority === 'low') priority = 7;

      if (priority <= 7) {
        let estimatedCycles = 1;
        if (t.subtasks && t.subtasks.length > 0) {
          let cycles = 0;
          for (let s = 0; s < t.subtasks.length; s++) {
            cycles += ((t.subtasks[s].estimatedCycles || 1) - (t.subtasks[s].completedCycles || 0));
          }
          estimatedCycles = cycles > 0 ? cycles : 1;
        }
        items.push({
          type: 'task',
          priority,
          label: t.title,
          subject: t.subject,
          taskId: t.id,
          estimatedCycles
        });
      }
    }

    // 3. Subject Review
    for (let i = 0; i < masteryStats.length; i++) {
      const s = masteryStats[i];
      if (s.percentage < 50) {
        items.push({ type: 'subject_review', priority: 6, label: `Review ${s.name}`, subject: s.name });
      }
    }

    return items.sort((a, b) => a.priority - b.priority);
  }

  function getWindowsForDay(dayOfWeek) {
    const allWindows = Storage.loadData ? Storage.loadData(Storage.KEYS.STUDY_WINDOWS, Storage.DEFAULTS.studyWindows || []) : [];
    return allWindows.filter(w => w.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime < b.startTime ? -1 : (a.startTime > b.startTime ? 1 : 0));
  }

  function allocateBlocks(items, windows, dateStr) {
    const blocks = [];
    const BLOCK_DURATION = 25; // mins
    const SHORT_BREAK = 5;
    const LONG_BREAK = 15;

    let currentItemIdx = 0;
    let sessionsInCycle = 0;

    for (let w = 0; w < windows.length; w++) {
      const window = windows[w];
      let currentMin = parseMinutes(window.startTime);
      const endMin = parseMinutes(window.endTime);

      while (currentMin + BLOCK_DURATION <= endMin && currentItemIdx < items.length) {
        const item = items[currentItemIdx];

        blocks.push({
          startTime: formatMinutes(currentMin),
          endTime: formatMinutes(currentMin + BLOCK_DURATION),
          label: item.label,
          type: item.type,
          subject: item.subject,
          taskId: item.taskId
        });

        currentMin += BLOCK_DURATION;
        sessionsInCycle++;

        // Add break
        const breakDuration = (sessionsInCycle % 4 === 0) ? LONG_BREAK : SHORT_BREAK;
        if (currentMin + breakDuration <= endMin) {
          currentMin += breakDuration;
        }

        // Logic to move to next item or stay if multiple cycles needed
        if (item.type === 'task' && item.estimatedCycles > 1) {
          item.estimatedCycles--;
        } else {
          currentItemIdx++;
        }
      }
    }

    return blocks;
  }

  function optimizeBlocks(blocks) {
    // 1. Fresher mind: swap harder subjects (lower priority items) to earlier slots if they are in same window
    // 2. Variation: Avoid more than 2 consecutive blocks of same subject
    for (let i = 2; i < blocks.length; i++) {
      if (blocks[i].subject && blocks[i].subject === blocks[i-1].subject && blocks[i].subject === blocks[i-2].subject) {
        // Find next block with different subject to swap
        for (let j = i + 1; j < blocks.length; j++) {
          if (blocks[j].subject !== blocks[i].subject) {
            const tempLabel = blocks[i].label;
            const tempType = blocks[i].type;
            const tempSubject = blocks[i].subject;
            const tempTaskId = blocks[i].taskId;

            blocks[i].label = blocks[j].label;
            blocks[i].type = blocks[j].type;
            blocks[i].subject = blocks[j].subject;
            blocks[i].taskId = blocks[j].taskId;

            blocks[j].label = tempLabel;
            blocks[j].type = tempType;
            blocks[j].subject = tempSubject;
            blocks[j].taskId = tempTaskId;
            break;
          }
        }
      }
    }
    return blocks;
  }

  return {
    init,
    generatePlan
  };
})();

window.Scheduler = Scheduler;
