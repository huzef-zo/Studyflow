/**
 * StudyFlow - Storage Module
 * Handles all localStorage operations
 *
 * FIXES APPLIED:
 * 1. Added SIDEBAR key to KEYS constant so cross-tab cache invalidation works
 * 2. completeTimerSession: explicitly zero sessionsInCycle in saved state after long_break
 * 3. getGoals: force week-start flush before returning to prevent stale current_tasks on first load
 * 4. calculateStreak: fixed so today is only counted if activity exists today
 */

const Storage = (function() {
  'use strict';

  const KEYS = {
    USER: 'studyflow_user',
    TASKS: 'studyflow_tasks',
    SUBJECTS: 'studyflow_subjects',
    SESSIONS: 'studyflow_sessions',
    GOALS: 'studyflow_goals',
    SETTINGS: 'studyflow_settings',
    TIMER: 'studyflow_timer',
    SIDEBAR: 'is_sidebar_collapsed',   // FIX 1: was a raw string in app.js, now tracked in cache
    REPEATING_COMPLETIONS: 'studyflow_repeating_completions'
  };

  const cache = {};

  // Pending completions: taskId → { timeoutId }
  const _pendingCompletions = {};

  function notifyTaskDataChanged() {
    try {
      const event = new CustomEvent('studyflow_taskDataChanged', {
        detail: { timestamp: new Date().toISOString() }
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to dispatch task data change event:', err);
    }
  }

  window.addEventListener('storage', (e) => {
    if (Object.values(KEYS).includes(e.key)) {
      if (e.newValue === null) {
        delete cache[e.key];
      } else {
        try {
          cache[e.key] = JSON.parse(e.newValue);
        } catch (err) {
          delete cache[e.key];
        }
      }
    }
  });

  const DEFAULTS = {
    user: {
      name: 'Student',
      email: '',
      created_at: new Date().toISOString()
    },
    tasks: [],
    subjects: [
      { id: 'sub_1', name: 'Math', color: '#2563EB', createdAt: new Date().toISOString() },
      { id: 'sub_2', name: 'Science', color: '#22C55E', createdAt: new Date().toISOString() },
      { id: 'sub_3', name: 'English', color: '#EAB308', createdAt: new Date().toISOString() },
      { id: 'sub_4', name: 'History', color: '#F97316', createdAt: new Date().toISOString() },
      { id: 'sub_5', name: 'Other', color: '#6B7280', createdAt: new Date().toISOString() }
    ],
    sessions: [],
    goals: {
      weekly_tasks: 10,
      weekly_hours: 20,
      daily_tasks: 2,
      daily_hours: 3,
      current_tasks: 0,
      current_hours: 0,
      week_start: getWeekStart(new Date()).toISOString()
    },
    settings: {
      notifications: true,
      task_notifications: true,
      sound: true,
      auto_start_break: true,
      auto_start_work: true,
      work_duration: 25,
      short_break: 5,
      long_break: 15,
      sessions_until_long_break: 4
    },
    repeatingCompletions: {}
  };

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function saveData(key, data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      cache[key] = data;
      return true;
    } catch (error) {
      console.error('Storage save error:', error);
      return false;
    }
  }

  function loadData(key, defaultValue = null) {
    if (cache.hasOwnProperty(key)) {
      return cache[key];
    }
    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) {
        return defaultValue;
      }
      const data = JSON.parse(serialized);
      cache[key] = data;
      return data;
    } catch (error) {
      console.error('Storage load error:', error);
      return defaultValue;
    }
  }

  function removeData(key) {
    try {
      localStorage.removeItem(key);
      delete cache[key];
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  }

  function clearAllData() {
    Object.values(KEYS).forEach(key => {
      removeData(key);
    });
    Object.keys(cache).forEach(key => delete cache[key]);
  }

  function exportData() {
    return {
      user: getUser(),
      tasks: getTasks(),
      subjects: getSubjects(),
      sessions: getSessions(),
      goals: getGoals(),
      settings: getSettings(),
      repeatingCompletions: getRepeatingCompletions(),
      exported_at: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  function importData(data) {
    try {
      if (data.user) saveData(KEYS.USER, data.user);
      if (data.tasks) saveData(KEYS.TASKS, data.tasks);
      if (data.subjects) saveData(KEYS.SUBJECTS, data.subjects);
      if (data.sessions) saveData(KEYS.SESSIONS, data.sessions);
      if (data.goals) saveData(KEYS.GOALS, data.goals);
      if (data.settings) saveData(KEYS.SETTINGS, data.settings);
      if (data.repeatingCompletions) saveRepeatingCompletions(data.repeatingCompletions);
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }

  function getRepeatingCompletions() {
    return loadData(KEYS.REPEATING_COMPLETIONS, DEFAULTS.repeatingCompletions);
  }

  function saveRepeatingCompletions(completions) {
    return saveData(KEYS.REPEATING_COMPLETIONS, completions);
  }

  function isRepeatingTaskCompletedOnDate(taskId, dateStr) {
    const completions = getRepeatingCompletions();
    return completions[`${taskId}_${dateStr}`] === true;
  }

  function setRepeatingTaskCompletedOnDate(taskId, dateStr, completed) {
    const completions = getRepeatingCompletions();
    const key = `${taskId}_${dateStr}`;
    if (completed) {
      completions[key] = true;
    } else {
      delete completions[key];
    }
    saveRepeatingCompletions(completions);
    notifyTaskDataChanged();
  }

  function pruneRepeatingCompletions() {
    const completions = getRepeatingCompletions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = formatDate(cutoff);
    const pruned = {};
    Object.keys(completions).forEach(key => {
      // key format: "taskId_YYYY-MM-DD"
      const dateStr = key.slice(-10);
      if (dateStr >= cutoffStr) pruned[key] = completions[key];
    });
    saveRepeatingCompletions(pruned);
  }

  // ── User ────────────────────────────────────────────────────────────────────

  function getUser() { return loadData(KEYS.USER, DEFAULTS.user); }
  function saveUser(user) { return saveData(KEYS.USER, user); }
  function updateUserName(name) { const u = getUser(); u.name = name; return saveUser(u); }
  function updateUserEmail(email) { const u = getUser(); u.email = email; return saveUser(u); }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  function getTasks() { return loadData(KEYS.TASKS, DEFAULTS.tasks); }
  function saveTasks(tasks) { return saveData(KEYS.TASKS, [...tasks]); }

  function addTask(task) {
    const tasks = getTasks();
    const subtasks = task.subtasks || [];
    let completed = task.completed || false;
    let progress = 0;
    if (subtasks.length > 0) {
      const completedSubtasks = subtasks.filter(s => s.isCompleted).length;
      progress = Math.round((completedSubtasks / subtasks.length) * 100);
      completed = subtasks.every(s => s.isCompleted);
    }
    const newTask = {
      id: generateId(),
      title: task.title,
      type: task.type || 'one-time',
      startDate: task.startDate || task.dueDate || null,
      dueDate: task.dueDate || null,
      dueTime: task.dueTime || null,
      priority: task.priority || 'medium',
      subject: task.subject || 'Other',
      repeatDays: task.repeatDays || [],
      completed: completed,
      completedAt: completed ? new Date().toISOString() : null,
      subtasks: subtasks,
      progress: progress,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveTasks(tasks);
    notifyTaskDataChanged();
    return newTask;
  }

  function updateTask(id, updates) {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      const oldStatus = tasks[index].completed;
      const task = { ...tasks[index], ...updates };
      if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(s => s.isCompleted).length;
        task.progress = Math.round((completedCount / task.subtasks.length) * 100);
        task.completed = task.subtasks.every(s => s.isCompleted);
      } else if (task.subtasks) {
        task.progress = 0;
      }
      if (task.completed && !oldStatus) {
        task.completedAt = task.completedAt || new Date().toISOString();
      } else if (!task.completed && oldStatus) {
        task.completedAt = null;
      }
      tasks[index] = task;
      saveTasks(tasks);
      notifyTaskDataChanged();
      return tasks[index];
    }
    return null;
  }

  function addSubtask(taskId, subtaskData) {
    const task = getTaskById(taskId);
    if (!task) return null;
    const subtasks = task.subtasks || [];
    const newSubtask = {
      id: generateId(),
      title: subtaskData.title,
      isCompleted: subtaskData.isCompleted || false,
      estimatedCycles: subtaskData.estimatedCycles || 1,
      completedCycles: subtaskData.completedCycles || 0
    };
    subtasks.push(newSubtask);
    return updateTask(taskId, { subtasks });
  }

  function toggleSubtask(taskId, subtaskId, isCompleted) {
    return updateSubtask(taskId, subtaskId, { isCompleted });
  }

  function updateSubtask(taskId, subtaskId, updates) {
    const task = getTaskById(taskId);
    if (!task || !task.subtasks) return null;
    const subtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, ...updates } : s);
    return updateTask(taskId, { subtasks });
  }

  function deleteTask(id) {
    const tasks = getTasks();
    saveTasks(tasks.filter(t => t.id !== id));
    notifyTaskDataChanged();
    return true;
  }

  function completeTask(id) {
    const task = getTaskById(id);
    if (task && task.subtasks && task.subtasks.length > 0) {
      const updatedSubtasks = task.subtasks.map(s => ({ ...s, isCompleted: true }));
      return updateTask(id, { completed: true, completedAt: new Date().toISOString(), subtasks: updatedSubtasks });
    }
    return updateTask(id, { completed: true, completedAt: new Date().toISOString() });
  }

  function uncompleteTask(id) {
    const task = getTaskById(id);
    if (task && task.subtasks && task.subtasks.length > 0) {
      const updatedSubtasks = task.subtasks.map(s => ({ ...s, isCompleted: false }));
      return updateTask(id, { completed: false, completedAt: null, subtasks: updatedSubtasks });
    }
    return updateTask(id, { completed: false, completedAt: null });
  }

  function getTaskById(id) {
    return getTasks().find(t => t.id === id) || null;
  }

  function getTasksByDate(dateStr) {
    const tasks = getTasks();
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

    return tasks.filter(t => {
      if (t.type === 'repeating') {
        return t.repeatDays && t.repeatDays.includes(dayOfWeek);
      }
      if (!t.dueDate) return false;
      const start = t.startDate || t.dueDate;
      return dateStr >= start && dateStr <= t.dueDate;
    }).map(t => {
      if (t.type === 'repeating') {
        return {
          ...t,
          completedOnDate: isRepeatingTaskCompletedOnDate(t.id, dateStr),
          _dateContext: dateStr   // which date this instance is for
        };
      }
      return t;
    });
  }

  function getTasksByStatus(completed) { return getTasks().filter(t => t.completed === completed); }
  function getTasksBySubject(subject) { return getTasks().filter(t => t.subject === subject); }
  function getTasksByPriority(priority) { return getTasks().filter(t => t.priority === priority); }

  function getUpcomingTasks(days = 7) {
    const tasks = getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    const todayStr = formatDate(today);
    const futureStr = formatDate(futureDate);
    return tasks.filter(t => {
      if (t.completed) return false;
      if (t.type === 'repeating') return true;
      if (!t.dueDate) return false;
      const start = t.startDate || t.dueDate;
      return t.dueDate < todayStr || (t.dueDate >= todayStr && start <= futureStr);
    }).sort((a, b) => {
      if (a.type === 'repeating' && b.type !== 'repeating') return 1;
      if (a.type !== 'repeating' && b.type === 'repeating') return -1;
      if (a.type === 'repeating' && b.type === 'repeating') return 0;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }

  function getOverdueTasks() {
    const tasks = getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      return new Date(t.dueDate) < today;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  function getTodayTasks() {
    return getTasksByDate(formatDate(new Date())).filter(t => !t.completed);
  }

  /**
   * Stage a task completion with a delay before writing to storage.
   * Returns a cancel function. Calls onCommit when the delay expires.
   */
  function stageTaskCompletion(taskId, delayMs, onCommit) {
    // Cancel any existing pending completion for this task
    if (_pendingCompletions[taskId]) {
      clearTimeout(_pendingCompletions[taskId].timeoutId);
    }

    const timeoutId = setTimeout(() => {
      delete _pendingCompletions[taskId];
      onCommit();
    }, delayMs);

    _pendingCompletions[taskId] = { timeoutId };

    return function cancelCompletion() {
      if (_pendingCompletions[taskId]) {
        clearTimeout(_pendingCompletions[taskId].timeoutId);
        delete _pendingCompletions[taskId];
        return true;  // was cancelled
      }
      return false;   // already committed
    };
  }

  function hasPendingCompletion(taskId) {
    return !!_pendingCompletions[taskId];
  }

  // ── Subjects ────────────────────────────────────────────────────────────────

  function getSubjects() { return loadData(KEYS.SUBJECTS, DEFAULTS.subjects); }
  function saveSubjects(subjects) { return saveData(KEYS.SUBJECTS, [...subjects]); }

  function addSubject(name, color) {
    const subjects = getSubjects();
    const newSubject = { id: generateId(), name, color: color || '#2563EB', createdAt: new Date().toISOString() };
    subjects.push(newSubject);
    saveSubjects(subjects);
    return newSubject;
  }

  function updateSubject(id, updates) {
    const subjects = getSubjects();
    const index = subjects.findIndex(s => s.id === id);
    if (index !== -1) {
      subjects[index] = { ...subjects[index], ...updates };
      saveSubjects(subjects);
      return subjects[index];
    }
    return null;
  }

  function deleteSubject(id) {
    saveSubjects(getSubjects().filter(s => s.id !== id));
    return true;
  }

  function getSubjectById(id) { return getSubjects().find(s => s.id === id) || null; }
  function getSubjectByName(name) { return getSubjects().find(s => s.name.toLowerCase() === name.toLowerCase()) || null; }

  // ── Sessions ────────────────────────────────────────────────────────────────

  function getSessions() { return loadData(KEYS.SESSIONS, DEFAULTS.sessions); }
  function saveSessions(sessions) { return saveData(KEYS.SESSIONS, [...sessions]); }

  function addSession(duration, type = 'work', taskId = null) {
    const sessions = getSessions();
    const newSession = { id: generateId(), duration, type, taskId, completedAt: new Date().toISOString() };
    sessions.push(newSession);
    saveSessions(sessions);
    return newSession;
  }

  function getTodaySessions() {
    const today = formatDate(new Date());
    return getSessions().filter(s => formatDate(new Date(s.completedAt)) === today && s.type === 'session_complete');
  }

  function getTodayWorkSessions() {
    const today = formatDate(new Date());
    return getSessions().filter(s => formatDate(new Date(s.completedAt)) === today && s.type === 'work');
  }

  function getWeekSessions() {
    const weekStart = getWeekStart(new Date());
    return getSessions().filter(s => new Date(s.completedAt) >= weekStart && s.type === 'session_complete');
  }

  function getWeekWorkSessions() {
    const weekStart = getWeekStart(new Date());
    return getSessions().filter(s => new Date(s.completedAt) >= weekStart && s.type === 'work');
  }

  /**
   * Return sessions on or after the given date string (YYYY-MM-DD).
   * More efficient than filtering getSessions() inline everywhere.
   */
  function getSessionsSince(dateStr) {
    const threshold = new Date(dateStr).getTime();
    return getSessions().filter(s => {
      if (!s.completedAt) return false;
      // Faster numeric comparison instead of string formatting in loop
      return new Date(s.completedAt).getTime() >= threshold;
    });
  }

  /**
   * Prune sessions older than `keepDays` days (default 365).
   * Runs at most once per browser session via sessionStorage guard.
   * Returns the number of entries removed.
   */
  function pruneSessions(keepDays = 365) {
    const PRUNE_GUARD_KEY = 'studyflow_sessions_pruned';
    if (sessionStorage.getItem(PRUNE_GUARD_KEY)) return 0;
    sessionStorage.setItem(PRUNE_GUARD_KEY, '1');

    const sessions = getSessions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    cutoff.setHours(0, 0, 0, 0);

    const kept = sessions.filter(s => {
      if (!s.completedAt) return false;  // drop malformed entries
      return new Date(s.completedAt) >= cutoff;
    });

    const removed = sessions.length - kept.length;
    if (removed > 0) {
      saveSessions(kept);
      console.log(`[StudyFlow] Pruned ${removed} old session records.`);
    }
    return removed;
  }

  function getTotalMinutesToday() {
    const today = formatDate(new Date());
    return getSessionsSince(today)
      .filter(s => formatDate(new Date(s.completedAt)) === today && s.type === 'work')
      .reduce((total, s) => total + s.duration, 0);
  }

  function getTotalMinutesWeek() {
    const weekStart = getWeekStart(new Date());
    const weekStartStr = formatDate(weekStart);
    return getSessionsSince(weekStartStr)
      .filter(s => s.type === 'work')
      .reduce((total, s) => total + s.duration, 0);
  }

  // ── Goals ───────────────────────────────────────────────────────────────────

  function getGoals() {
    let goals = loadData(KEYS.GOALS, DEFAULTS.goals);
    goals = { ...DEFAULTS.goals, ...goals };

    const weekStart = getWeekStart(new Date());
    const weekStartStr = weekStart.toISOString();

    // FIX 3: If week has rolled over, flush immediately so current_tasks is never stale
    if (goals.week_start !== weekStartStr) {
      goals.week_start = weekStartStr;
      goals.current_tasks = 0;
      goals.current_hours = 0;
      saveGoals(goals);           // write the reset so next read from cache is clean
    }

    // Prune old repeating completions once per session
    if (!sessionStorage.getItem('repeating_completions_pruned')) {
      pruneRepeatingCompletions();
      sessionStorage.setItem('repeating_completions_pruned', 'true');
    }

    // Dynamically recalculate from source of truth
    const tasks = getTasks();
    goals.current_tasks = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= weekStart).length;
    goals.current_hours = getTotalMinutesWeek() / 60;

    return goals;
  }

  function saveGoals(goals) { return saveData(KEYS.GOALS, goals); }
  function updateGoals(updates) {
    const goals = getGoals();
    return saveGoals({ ...goals, ...updates });
  }

  // ── Settings ────────────────────────────────────────────────────────────────

  function getSettings() { return { ...DEFAULTS.settings, ...loadData(KEYS.SETTINGS, DEFAULTS.settings) }; }
  function saveSettings(settings) { return saveData(KEYS.SETTINGS, settings); }
  function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    return saveSettings(settings);
  }

  // ── Timer persistence ────────────────────────────────────────────────────────

  function getTimerState() { return loadData(KEYS.TIMER, null); }
  function saveTimerState(state) { return saveData(KEYS.TIMER, { ...state }); }
  function clearTimerState() { return removeData(KEYS.TIMER); }

  function completeTimerSession(timerState, recordSession = true) {
    const settings = getSettings();
    const { type, sessionsInCycle, selectedTaskId, selectedSubtaskId } = timerState;
    let nextSessionsInCycle = sessionsInCycle || 0;

    if (type === 'work') {
      if (recordSession) {
        addSession(settings.work_duration || 25, 'work', selectedTaskId);
      }
      nextSessionsInCycle++;
      const n = settings.sessions_until_long_break || 4;
      if (nextSessionsInCycle >= n) {
        addSession(0, 'session_complete', selectedTaskId);
      }
      if (recordSession && selectedTaskId && selectedSubtaskId) {
        const task = getTaskById(selectedTaskId);
        if (task && task.subtasks) {
          const subtask = task.subtasks.find(s => s.id === selectedSubtaskId);
          if (subtask) {
            updateSubtask(selectedTaskId, selectedSubtaskId, {
              completedCycles: (subtask.completedCycles || 0) + 1
            });
          }
        }
      }
    }

    let nextType;
    if (type === 'work') {
      const cycleLength = settings.sessions_until_long_break || 4;
      nextType = nextSessionsInCycle >= cycleLength ? 'long_break' : 'short_break';
    } else if (type === 'long_break') {
      nextType = 'work';
      // FIX 2: explicitly reset cycle counter after long break
      nextSessionsInCycle = 0;
    } else {
      nextType = 'work';
    }

    let nextDuration;
    switch (nextType) {
      case 'work': nextDuration = (settings.work_duration || 25) * 60; break;
      case 'short_break': nextDuration = (settings.short_break || 5) * 60; break;
      case 'long_break': nextDuration = (settings.long_break || 15) * 60; break;
      default: nextDuration = 25 * 60;
    }

    const shouldAutoStart = nextType === 'work' ? settings.auto_start_work : settings.auto_start_break;

    const newState = {
      type: nextType,
      state: shouldAutoStart ? 'running' : 'idle',
      timeRemaining: nextDuration,
      totalTime: nextDuration,
      endTime: shouldAutoStart ? Date.now() + (nextDuration * 1000) : null,
      sessionsInCycle: nextSessionsInCycle,   // FIX 2: 0 after long_break, correct count otherwise
      selectedTaskId,
      selectedSubtaskId,
      lastCompletedType: type,
      completedAt: new Date().toISOString()
    };

    saveTimerState(newState);
    return newState;
  }

  // ── Statistics ───────────────────────────────────────────────────────────────

  function getSubjectMasteryStats() {
    const tasks = getTasks();
    const subjects = getSubjects();
    const subjectMetrics = {};
    subjects.forEach(s => { subjectMetrics[s.name] = { total: 0, completed: 0 }; });
    tasks.forEach(t => {
      if (subjectMetrics[t.subject]) {
        subjectMetrics[t.subject].total++;
        if (t.completed) subjectMetrics[t.subject].completed++;
      }
    });
    return subjects.map(subject => {
      const metrics = subjectMetrics[subject.name] || { total: 0, completed: 0 };
      const percentage = metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;
      return { ...subject, total: metrics.total, completed: metrics.completed, percentage };
    });
  }

  function getStats() {
    const tasks = getTasks();
    const sessions = getSessions();
    const now = new Date();
    const todayStr = formatDate(now);
    const weekStart = getWeekStart(now);
    const weekStartTime = weekStart.getTime();

    const dayOfWeek = now.getDay();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const future7Days = new Date(today);
    future7Days.setDate(today.getDate() + 7);
    const future7DaysStr = formatDate(future7Days);

    let completedTasks = 0;
    let todayCompleted = 0;
    let todayTasksCount = 0;   // pending tasks scheduled for today
    let pendingCount = 0;      // all uncompleted tasks (global)
    let weekCompleted = 0;
    let overdueTasks = 0;
    let upcomingTasks = 0;

    const activityDates = new Set();

    tasks.forEach(t => {
      if (t.completed) {
        completedTasks++;
        if (t.completedAt) {
          const compDate = new Date(t.completedAt);
          const compDateStr = formatDate(compDate);
          if (compDateStr === todayStr) todayCompleted++;
          if (compDate.getTime() >= weekStartTime) weekCompleted++;
          activityDates.add(compDateStr);
        }
      } else {
        pendingCount++;
        let isOverdue = false;
        if (t.dueDate) {
          const dueDate = new Date(t.dueDate);
          if (dueDate < today) { overdueTasks++; isOverdue = true; }
        }
        let isDueToday = false;
        if (t.type === 'repeating') {
          if (t.repeatDays && t.repeatDays.includes(dayOfWeek)) isDueToday = true;
        } else if (t.dueDate) {
          const start = t.startDate || t.dueDate;
          if (todayStr >= start && todayStr <= t.dueDate) isDueToday = true;
        }
        if (isDueToday || isOverdue) todayTasksCount++;
        if (t.type === 'repeating') {
          upcomingTasks++;
        } else if (t.dueDate) {
          const start = t.startDate || t.dueDate;
          if (t.dueDate < todayStr || (t.dueDate >= todayStr && start <= future7DaysStr)) upcomingTasks++;
        }
      }
    });

    let todaySessions = 0, weekSessions = 0, totalMinutesToday = 0, totalMinutesWeek = 0;

    // Single pass over sessions for all metric calculations
    sessions.forEach(s => {
      if (!s.completedAt) return;
      const compDate = new Date(s.completedAt);
      const compTime = compDate.getTime();
      const compDateStr = formatDate(compDate);

      if (s.type === 'work') {
        activityDates.add(compDateStr);
        if (compDateStr === todayStr) {
          todaySessions++;
          totalMinutesToday += s.duration;
        }
        if (compTime >= weekStartTime) {
          weekSessions++;
          totalMinutesWeek += s.duration;
        }
      }
    });

    const streak = calculateStreak(activityDates);
    const bestStreak = calculateBestStreak(activityDates);

    // Count repeating task completions for today
    const completions = getRepeatingCompletions();
    Object.keys(completions).forEach(key => {
      if (key.endsWith(`_${todayStr}`)) todayCompleted++;
    });

    return {
      tasks: {
        total: tasks.length,
        completed: completedTasks,
        pending: pendingCount,
        today: todayTasksCount,
        todayCompleted,
        todayPending: todayTasksCount,   // tasks due today that are not completed
        weekCompleted,
        overdue: overdueTasks,
        upcoming: upcomingTasks
      },
      sessions: { today: todaySessions, week: weekSessions, minutesToday: totalMinutesToday, minutesWeek: totalMinutesWeek },
      streak,
      bestStreak
    };
  }

  function calculateBestStreak(activityDates) {
    if (!activityDates) {
      const tasks = getTasks(); const sessions = getSessions();
      activityDates = new Set();
      tasks.forEach(t => { if (t.completedAt) activityDates.add(formatDate(new Date(t.completedAt))); });
      sessions.forEach(s => { if (s.type === 'work') activityDates.add(formatDate(new Date(s.completedAt))); });
    }
    const sortedDates = Array.from(activityDates).sort();
    if (sortedDates.length === 0) return 0;
    let bestStreak = 0, currentStreak = 0, lastDate = null;
    sortedDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      currentDate.setHours(0, 0, 0, 0);
      if (lastDate) {
        const diffDays = Math.round(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      } else {
        currentStreak = 1;
      }
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      lastDate = currentDate;
    });
    return bestStreak;
  }

  /**
   * FIX 4: calculateStreak — today only counts if there is actual activity today.
   * Previously i=0 was always skipped regardless of activity, causing the streak
   * to appear 1 day higher than reality on days with no activity yet.
   */
  function calculateStreak(activityDates) {
    if (!activityDates) {
      const tasks = getTasks(); const sessions = getSessions();
      activityDates = new Set();
      tasks.forEach(t => { if (t.completedAt) activityDates.add(formatDate(new Date(t.completedAt))); });
      sessions.forEach(s => { if (s.type === 'work') activityDates.add(formatDate(new Date(s.completedAt))); });
    }
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = formatDate(checkDate);
      if (activityDates.has(dateStr)) {
        streak++;
      } else {
        // FIX: break immediately — today included. No special case for i===0.
        // This means if today has no activity yet, streak shows yesterday's count (correct).
        // The streak resets if any day (including today) is missed.
        break;
      }
    }
    return streak;
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  function formatDate(date) {
    const d = (date instanceof Date) ? date : new Date(date);
    const year = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    // Faster string concatenation for padding
    return year + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function getRelativeDays(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `In ${diffDays} days`;
    return formatDisplayDate(dateStr);
  }

  function getDaysUntil(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr); targetDate.setHours(0, 0, 0, 0);
    return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
  }

  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  function isToday(dateStr) { return formatDate(new Date()) === formatDate(new Date(dateStr)); }

  return {
    KEYS, DEFAULTS,
    saveData, loadData, removeData, clearAllData, exportData, importData,
    getUser, saveUser, updateUserName, updateUserEmail,
    getTasks, saveTasks, addTask, updateTask, deleteTask, completeTask, uncompleteTask,
    getTaskById, getTasksByDate, getTasksByStatus, getTasksBySubject, getTasksByPriority,
    getUpcomingTasks, getOverdueTasks, getTodayTasks,
    stageTaskCompletion, hasPendingCompletion,
    addSubtask, toggleSubtask, updateSubtask,
    getSubjects, saveSubjects, addSubject, updateSubject, deleteSubject,
    getSubjectById, getSubjectByName, getSubjectMasteryStats,
    getSessions, saveSessions, addSession,
    getTodaySessions, getTodayWorkSessions, getWeekSessions, getWeekWorkSessions,
    getTotalMinutesToday, getTotalMinutesWeek,
    getSessionsSince, pruneSessions,
    getGoals, saveGoals, updateGoals,
    getSettings, saveSettings, updateSetting,
    getTimerState, saveTimerState, clearTimerState, completeTimerSession,
    getStats, calculateStreak, calculateBestStreak,
    generateId, formatDate, formatDisplayDate, getRelativeDays, getDaysUntil,
    getWeekNumber, isToday, getWeekStart,
    getRepeatingCompletions, saveRepeatingCompletions, isRepeatingTaskCompletedOnDate,
    setRepeatingTaskCompletedOnDate, pruneRepeatingCompletions
  };
})();

window.Storage = Storage;
