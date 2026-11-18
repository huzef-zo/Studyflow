const fs = require('fs');
const path = require('path');

// Mock environment
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, value) => { localStorageStore[key] = value.toString(); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); }
};
global.localStorage = localStorageMock;
global.sessionStorage = localStorageMock;
global.window = {
  localStorage: localStorageMock,
  sessionStorage: localStorageMock,
  addEventListener: () => {},
  dispatchEvent: () => {}
};
global.CustomEvent = class {};

eval(fs.readFileSync(path.join(__dirname, '../js/subtask-utils.js'), 'utf8'));
global.SubtaskUtils = window.SubtaskUtils;

eval(fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8'));
const Storage = window.Storage;

const originalSchedulerCode = fs.readFileSync(path.join(__dirname, '../js/scheduler.js'), 'utf8');
eval(originalSchedulerCode);
const OriginalScheduler = window.Scheduler;

// Optimized Scheduler
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

function collectDueItemsOptimized(date) {
  const dayOfWeek = date.getDay();
  const todayStr = Storage.formatDate(date);
  // OPTIMIZATION: Query raw tasks directly from storage to avoid getTasks() redundant repeating completion resolution passes
  const rawTasks = Storage.loadData(Storage.KEYS.TASKS, Storage.DEFAULTS.tasks) || [];
  const masteryStats = Storage.getSubjectMasteryStats();

  const items = [];

  const baseDate = Storage.parseLocalDate ? Storage.parseLocalDate(todayStr) : new Date(date);
  if (baseDate) baseDate.setHours(0, 0, 0, 0);
  const baseTime = baseDate ? baseDate.getTime() : 0;

  for (let i = 0; i < rawTasks.length; i++) {
    const t = rawTasks[i];
    if (t.type === 'repeating') {
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

  for (let i = 0; i < masteryStats.length; i++) {
    const s = masteryStats[i];
    if (s.percentage < 50) {
      items.push({ type: 'subject_review', priority: 6, label: `Review ${s.name}`, subject: s.name });
    }
  }

  return items.sort((a, b) => a.priority - b.priority);
}

function getWindowsForDayOptimized(dayOfWeek) {
  const allWindows = Storage.loadData(Storage.KEYS.STUDY_WINDOWS, Storage.DEFAULTS.studyWindows || []);
  return allWindows.filter(w => w.dayOfWeek === dayOfWeek).sort((a, b) => a.startTime < b.startTime ? -1 : (a.startTime > b.startTime ? 1 : 0));
}

function allocateBlocksOptimized(items, windows) {
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

      const breakDuration = (sessionsInCycle % 4 === 0) ? LONG_BREAK : SHORT_BREAK;
      if (currentMin + breakDuration <= endMin) {
        currentMin += breakDuration;
      }

      if (item.type === 'task' && item.estimatedCycles > 1) {
        item.estimatedCycles--;
      } else {
        currentItemIdx++;
      }
    }
  }

  return blocks;
}

function generatePlanOptimized(date = new Date()) {
  const dayOfWeek = date.getDay();
  const items = collectDueItemsOptimized(date);
  const windows = getWindowsForDayOptimized(dayOfWeek);
  const blocks = allocateBlocksOptimized(items, windows);

  // Pass 3: Optimize
  for (let i = 2; i < blocks.length; i++) {
    if (blocks[i].subject && blocks[i].subject === blocks[i-1].subject && blocks[i].subject === blocks[i-2].subject) {
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

function runComparison() {
  const now = new Date(2026, 9, 12); // Monday
  now.setHours(0, 0, 0, 0);

  const numTasks = 1000;
  const tasks = [];
  for (let i = 0; i < numTasks; i++) {
    const isRepeating = i % 5 === 0;
    const dueDate = new Date(now.getTime() + (i % 30) * 86400000);
    const dueDateStr = Storage.formatDate(dueDate);

    tasks.push({
      id: 'task_' + i,
      title: 'Task ' + i,
      type: isRepeating ? 'repeating' : 'one-time',
      startDate: dueDateStr,
      dueDate: dueDateStr,
      priority: (i % 4 === 0) ? 'critical' : ((i % 4 === 1) ? 'high' : ((i % 4 === 2) ? 'medium' : 'low')),
      completed: i % 3 === 0,
      subject: (i % 5 === 0) ? 'Math' : ((i % 5 === 1) ? 'Science' : ((i % 5 === 2) ? 'English' : 'History')),
      repeatDays: [1, 2, 3, 4, 5],
      subtasks: [
        { id: 'st_1', title: 'Sub 1', estimatedCycles: 2, completedCycles: 0, isCompleted: false },
        { id: 'st_2', title: 'Sub 2', estimatedCycles: 3, completedCycles: 1, isCompleted: false }
      ]
    });
  }

  Storage.saveTasks(tasks);

  const origPlan = OriginalScheduler.generatePlan(now);
  const optPlan = generatePlanOptimized(now);

  console.log('--- CORRECTNESS CHECK ---');
  console.log('Original output equal to Optimized output:', JSON.stringify(origPlan) === JSON.stringify(optPlan));

  // Warmup
  for (let i = 0; i < 20; i++) {
    OriginalScheduler.generatePlan(now);
    generatePlanOptimized(now);
  }

  const iterations = 1000;

  const startOrig = process.hrtime();
  for (let i = 0; i < iterations; i++) {
    OriginalScheduler.generatePlan(now);
  }
  const diffOrig = process.hrtime(startOrig);
  const avgOrig = (diffOrig[0] * 1000 + diffOrig[1] / 1e6) / iterations;

  const startOpt = process.hrtime();
  for (let i = 0; i < iterations; i++) {
    generatePlanOptimized(now);
  }
  const diffOpt = process.hrtime(startOpt);
  const avgOpt = (diffOpt[0] * 1000 + diffOpt[1] / 1e6) / iterations;

  console.log('--- BENCHMARK RESULTS ---');
  console.log(`Original Scheduler.generatePlan(): ${avgOrig.toFixed(4)}ms per call`);
  console.log(`Optimized Scheduler.generatePlan(): ${avgOpt.toFixed(4)}ms per call`);
  const speedup = (avgOrig / avgOpt).toFixed(2);
  const pctGain = (((avgOrig - avgOpt) / avgOrig) * 100).toFixed(1);
  console.log(`Speedup: ${speedup}x (${pctGain}% faster)`);
}

runComparison();
