/**
 * StudyFlow - Smart Study Scheduler Module
 * Implements 3-pass algorithm for allocating study blocks
 */

const Scheduler = (function() {
  'use strict';

  function init() {
    // Initialization if needed
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
    const todayStr = Storage.formatDate(date);
    const tasks = Storage.getTasks();
    const flashcards = Storage.getFlashcards();
    const masteryStats = Storage.getSubjectMasteryStats();

    const items = [];

    // 1. SRS Reviews (Overdue & Today)
    const dueCards = flashcards.filter(c => c.nextReview <= todayStr);
    if (dueCards.length > 0) {
      const overdue = dueCards.filter(c => c.nextReview < todayStr);
      const today = dueCards.filter(c => c.nextReview === todayStr);

      if (overdue.length > 0) {
        items.push({ type: 'srs', priority: 1, label: `SRS Review (${overdue.length} overdue)`, count: overdue.length });
      }
      if (today.length > 0) {
        items.push({ type: 'srs', priority: 4, label: `SRS Review (${today.length} due)`, count: today.length });
      }
    }

    // 2. Tasks
    tasks.forEach(t => {
      if (t.completed) return;

      const daysUntil = t.dueDate ? Storage.getDaysUntil(t.dueDate) : 999;
      let priority = 999;

      if (daysUntil <= 3 && t.priority === 'critical') priority = 2;
      else if (daysUntil <= 7 && t.priority === 'high') priority = 3;
      else if (daysUntil <= 14 && t.priority === 'medium') priority = 5;
      else if (daysUntil <= 30 && t.priority === 'low') priority = 7;

      if (priority <= 7) {
        items.push({
          type: 'task',
          priority,
          label: t.title,
          subject: t.subject,
          taskId: t.id,
          estimatedCycles: t.subtasks?.reduce((acc, s) => acc + (s.estimatedCycles - s.completedCycles), 0) || 1
        });
      }
    });

    // 3. Subject Review
    masteryStats.forEach(s => {
      if (s.percentage < 50) {
        items.push({ type: 'subject_review', priority: 6, label: `Review ${s.name}`, subject: s.name });
      }
    });

    return items.sort((a, b) => a.priority - b.priority);
  }

  function getWindowsForDay(dayOfWeek) {
    const allWindows = Storage.loadData(Storage.KEYS.STUDY_WINDOWS, Storage.DEFAULTS.studyWindows || []);
    return allWindows.filter(w => w.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function allocateBlocks(items, windows, dateStr) {
    const blocks = [];
    const BLOCK_DURATION = 25; // mins
    const SHORT_BREAK = 5;
    const LONG_BREAK = 15;

    let currentItemIdx = 0;
    let sessionsInCycle = 0;

    windows.forEach(window => {
      let currentTime = new Date(`${dateStr}T${window.startTime}:00`);
      const endTime = new Date(`${dateStr}T${window.endTime}:00`);

      while (currentTime.getTime() + (BLOCK_DURATION * 60000) <= endTime.getTime() && currentItemIdx < items.length) {
        const item = items[currentItemIdx];

        blocks.push({
          startTime: currentTime.toTimeString().slice(0, 5),
          endTime: new Date(currentTime.getTime() + (BLOCK_DURATION * 60000)).toTimeString().slice(0, 5),
          label: item.label,
          type: item.type,
          subject: item.subject,
          taskId: item.taskId
        });

        currentTime = new Date(currentTime.getTime() + (BLOCK_DURATION * 60000));
        sessionsInCycle++;

        // Add break
        const breakDuration = (sessionsInCycle % 4 === 0) ? LONG_BREAK : SHORT_BREAK;
        if (currentTime.getTime() + (breakDuration * 60000) <= endTime.getTime()) {
          currentTime = new Date(currentTime.getTime() + (breakDuration * 60000));
        }

        // Logic to move to next item or stay if multiple cycles needed
        if (item.type === 'task' && item.estimatedCycles > 1) {
          item.estimatedCycles--;
        } else {
          currentItemIdx++;
        }
      }
    });

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
            const temp = { ...blocks[i] };
            // Swap but keep original times
            blocks[i].label = blocks[j].label;
            blocks[i].type = blocks[j].type;
            blocks[i].subject = blocks[j].subject;
            blocks[i].taskId = blocks[j].taskId;

            blocks[j].label = temp.label;
            blocks[j].type = temp.type;
            blocks[j].subject = temp.subject;
            blocks[j].taskId = temp.taskId;
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
