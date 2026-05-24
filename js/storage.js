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
    REPEATING_COMPLETIONS: 'studyflow_repeating_completions',
    FLASHCARDS: 'studyflow_flashcards',
    DECKS: 'studyflow_decks',
    REVIEW_LOGS: 'studyflow_review_logs',
    ACHIEVEMENTS: 'studyflow_achievements',
    XP_STATE: 'studyflow_xp',
    STUDY_BLOCKS: 'studyflow_study_blocks',
    STUDY_WINDOWS: 'studyflow_study_windows',
    EXAMS: 'studyflow_exams',
    HABITS: 'studyflow_habits',
    NOTES: 'studyflow_notes',
    TIME_BLOCKS: 'studyflow_time_blocks',
    REFLECTIONS: 'studyflow_reflections',
    THEME: 'studyflow_theme'
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
    if (e.key === 'studyflow_cleared_at') {
      // Full reset — clear cache and cancel all pending completion timers
      Object.keys(cache).forEach(k => delete cache[k]);
      Object.keys(_pendingCompletions).forEach(id => {
        clearTimeout(_pendingCompletions[id].timeoutId);
        delete _pendingCompletions[id];
      });
      window.location.reload();
      return;
    }
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
      weekend_daily_tasks: 1,
      weekend_daily_hours: 1.5,
      current_tasks: 0,
      current_hours: 0,
      freezeCount: 1,
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
      sessions_until_long_break: 4,
      pinned_nav_items: ['timer', 'calendar']
    },
    repeatingCompletions: {},
    flashcards: [],
    decks: [],
    reviewLogs: [],
    achievements: [],
    studyBlocks: [],
    exams: [],
    habits: [],
    notes: [],
    timeBlocks: [],
    reflections: [],
    theme: 'default',
    studyWindows: [
      { id: 'sw_1', dayOfWeek: 1, startTime: '09:00', endTime: '12:00', label: 'Morning Study' },
      { id: 'sw_2', dayOfWeek: 1, startTime: '14:00', endTime: '17:00', label: 'Afternoon Study' },
      { id: 'sw_3', dayOfWeek: 2, startTime: '09:00', endTime: '12:00', label: 'Morning Study' },
      { id: 'sw_4', dayOfWeek: 2, startTime: '14:00', endTime: '17:00', label: 'Afternoon Study' },
      { id: 'sw_5', dayOfWeek: 3, startTime: '09:00', endTime: '12:00', label: 'Morning Study' },
      { id: 'sw_6', dayOfWeek: 3, startTime: '14:00', endTime: '17:00', label: 'Afternoon Study' },
      { id: 'sw_7', dayOfWeek: 4, startTime: '09:00', endTime: '12:00', label: 'Morning Study' },
      { id: 'sw_8', dayOfWeek: 4, startTime: '14:00', endTime: '17:00', label: 'Afternoon Study' },
      { id: 'sw_9', dayOfWeek: 5, startTime: '09:00', endTime: '12:00', label: 'Morning Study' },
      { id: 'sw_10', dayOfWeek: 5, startTime: '14:00', endTime: '17:00', label: 'Afternoon Study' }
    ],
    xpState: {
      totalXP: 0,
      currentLevel: 1,
      currentRank: 'Novice',
      history: []
    }
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
      // Revert cache to what is actually stored — do not let cache drift from localStorage
      try {
        const stored = localStorage.getItem(key);
        cache[key] = stored ? JSON.parse(stored) : undefined;
      } catch (e) { /* ignore parse errors */ }
      // Notify the app so it can show a user-visible warning
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        try {
          window.dispatchEvent(new CustomEvent('studyflow_storageQuotaExceeded', { detail: { key } }));
        } catch (e) { /* ignore */ }
      }
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
    localStorage.setItem('studyflow_cleared_at', Date.now().toString());
    if (typeof window !== 'undefined' && window.location && window.location.reload) {
      window.location.reload();
    }
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
      flashcards: getFlashcards(),
      decks: getDecks(),
      reviewLogs: getReviewLogs(),
      achievements: getAchievements(),
      xpState: getXPState(),
      studyBlocks: getStudyBlocks(),
      studyWindows: getStudyWindows(),
      exams: getExams(),
      habits: getHabits(),
      notes: getNotes(),
      timeBlocks: getTimeBlocks(),
      reflections: getReflections(),
      theme: getTheme(),
      exported_at: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  function importData(data) {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

      // SECURITY: Explicitly pick and validate known properties to prevent malicious object property injection
      // and ensure data integrity from untrusted JSON backups.

      if (data.user && typeof data.user === 'object' && !Array.isArray(data.user)) {
        const safeUser = { ...DEFAULTS.user };
        if ('name' in data.user) safeUser.name = String(data.user.name);
        if ('email' in data.user) safeUser.email = String(data.user.email);
        if ('created_at' in data.user) safeUser.created_at = String(data.user.created_at);
        saveData(KEYS.USER, safeUser);
      }

      if (Array.isArray(data.subjects)) {
        const safeSubjects = data.subjects.map(s => ({
          id: String(s.id || generateId()),
          name: String(s.name || 'Unnamed Subject'),
          color: String(s.color || '#2563EB'),
          createdAt: String(s.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.SUBJECTS, safeSubjects);
      }

      if (Array.isArray(data.tasks)) {
        const safeTasks = data.tasks.map(t => ({
          id: String(t.id || generateId()),
          title: String(t.title || 'Untitled Task'),
          type: String(t.type || 'one-time'),
          startDate: t.startDate ? String(t.startDate) : null,
          dueDate: t.dueDate ? String(t.dueDate) : null,
          dueTime: t.dueTime ? String(t.dueTime) : null,
          priority: String(t.priority || 'medium'),
          subject: String(t.subject || 'Other'),
          repeatDays: Array.isArray(t.repeatDays) ? t.repeatDays.map(Number) : [],
          completed: Boolean(t.completed),
          completedAt: t.completedAt ? String(t.completedAt) : null,
          subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(st => ({
            id: String(st.id || generateId()),
            title: String(st.title || 'Untitled Subtask'),
            isCompleted: Boolean(st.isCompleted),
            estimatedCycles: Number(st.estimatedCycles || 1),
            completedCycles: Number(st.completedCycles || 0)
          })) : [],
          progress: Number(t.progress || 0),
          sortOrder: Number(t.sortOrder || 0),
          createdAt: String(t.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.TASKS, safeTasks);
      }

      if (Array.isArray(data.sessions)) {
        const safeSessions = data.sessions.map(s => ({
          id: String(s.id || generateId()),
          duration: Number(s.duration || 0),
          type: String(s.type || 'work'),
          taskId: s.taskId ? String(s.taskId) : null,
          completedAt: String(s.completedAt || new Date().toISOString())
        }));
        saveData(KEYS.SESSIONS, safeSessions);
      }

      if (data.goals && typeof data.goals === 'object' && !Array.isArray(data.goals)) {
        // Goals are mostly numeric/string, simple spread is still risky but here we pick main ones
        const safeGoals = { ...DEFAULTS.goals };
        ['weekly_tasks', 'weekly_hours', 'daily_tasks', 'daily_hours', 'weekend_daily_tasks', 'weekend_daily_hours', 'current_tasks', 'current_hours'].forEach(key => {
          if (key in data.goals) safeGoals[key] = Number(data.goals[key]);
        });
        if (data.goals.week_start) safeGoals.week_start = String(data.goals.week_start);
        saveData(KEYS.GOALS, safeGoals);
      }

      if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        const safeSettings = { ...DEFAULTS.settings };
        Object.keys(DEFAULTS.settings).forEach(key => {
          if (key in data.settings) {
            if (typeof DEFAULTS.settings[key] === 'boolean') safeSettings[key] = Boolean(data.settings[key]);
            else if (typeof DEFAULTS.settings[key] === 'number') safeSettings[key] = Number(data.settings[key]);
            else safeSettings[key] = data.settings[key];
          }
        });
        saveData(KEYS.SETTINGS, safeSettings);
      }

      if (data.repeatingCompletions && typeof data.repeatingCompletions === 'object') {
        const safeRC = {};
        Object.keys(data.repeatingCompletions).forEach(k => {
          if (data.repeatingCompletions[k] === true) safeRC[String(k)] = true;
        });
        saveRepeatingCompletions(safeRC);
      }

      if (data.xpState && typeof data.xpState === 'object' && !Array.isArray(data.xpState)) {
        const safeXP = { ...DEFAULTS.xpState };
        if ('totalXP' in data.xpState) safeXP.totalXP = Number(data.xpState.totalXP);
        if ('currentLevel' in data.xpState) safeXP.currentLevel = Number(data.xpState.currentLevel);
        if ('currentRank' in data.xpState) safeXP.currentRank = String(data.xpState.currentRank);
        if (Array.isArray(data.xpState.history)) {
          safeXP.history = data.xpState.history.map(h => ({
            date: String(h.date),
            xpGained: Number(h.xpGained),
            source: String(h.source)
          }));
        }
        saveData(KEYS.XP_STATE, safeXP);
      }

      if (Array.isArray(data.achievements)) {
        const safeAchievements = data.achievements.map(a => ({
          id: String(a.id || generateId()),
          type: String(a.type),
          condition: Number(a.condition),
          unlockedAt: a.unlockedAt ? String(a.unlockedAt) : null,
          icon: String(a.icon)
        }));
        saveData(KEYS.ACHIEVEMENTS, safeAchievements);
      }

      if (Array.isArray(data.habits)) {
        const safeHabits = data.habits.map(h => {
          const habit = {
            id: String(h.id || generateId()),
            title: String(h.title || 'Untitled Habit'),
            icon: String(h.icon || '🎯'),
            streak: Number(h.streak || 0),
            lastCompleted: h.lastCompleted ? String(h.lastCompleted) : null,
            createdAt: String(h.createdAt || new Date().toISOString()),
            completions: {}
          };
          if (h.completions && typeof h.completions === 'object') {
            Object.keys(h.completions).forEach(k => {
              if (h.completions[k] === true) habit.completions[String(k)] = true;
            });
          }
          return habit;
        });
        saveData(KEYS.HABITS, safeHabits);
      }

      if (Array.isArray(data.exams)) {
        const safeExams = data.exams.map(e => ({
          id: String(e.id || generateId()),
          title: String(e.title || 'Untitled Exam'),
          examDate: String(e.examDate),
          subject: String(e.subject || 'Other'),
          weight: Number(e.weight || 3),
          revisionStartDate: String(e.revisionStartDate),
          notes: String(e.notes || ''),
          createdAt: String(e.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.EXAMS, safeExams);
      }

      if (Array.isArray(data.notes)) {
        const safeNotes = data.notes.map(n => ({
          id: String(n.id || generateId()),
          title: String(n.title || 'Untitled Note'),
          content: String(n.content || ''),
          subject: String(n.subject || 'Other'),
          createdAt: String(n.createdAt || new Date().toISOString()),
          updatedAt: String(n.updatedAt || new Date().toISOString())
        }));
        saveData(KEYS.NOTES, safeNotes);
      }

      if (Array.isArray(data.decks)) {
        const safeDecks = data.decks.map(d => ({
          id: String(d.id || generateId()),
          subjectId: String(d.subjectId),
          createdAt: String(d.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.DECKS, safeDecks);
      }

      if (Array.isArray(data.flashcards)) {
        const safeCards = data.flashcards.map(c => ({
          id: String(c.id || generateId()),
          deckId: String(c.deckId),
          front: String(c.front || ''),
          back: String(c.back || ''),
          easeFactor: Number(c.easeFactor || 2.5),
          interval: Number(c.interval || 0),
          repetitions: Number(c.repetitions || 0),
          nextReview: String(c.nextReview || formatDate(new Date())),
          createdAt: String(c.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.FLASHCARDS, safeCards);
      }

      if (Array.isArray(data.reviewLogs)) {
        const safeLogs = data.reviewLogs.map(l => ({
          id: String(l.id || generateId()),
          cardId: String(l.cardId),
          rating: Number(l.rating),
          timestamp: String(l.timestamp || new Date().toISOString())
        }));
        saveData(KEYS.REVIEW_LOGS, safeLogs);
      }

      if (Array.isArray(data.reflections)) {
        const safeReflections = data.reflections.map(r => ({
          date: String(r.date),
          text: String(r.text),
          timestamp: String(r.timestamp || new Date().toISOString())
        }));
        saveData(KEYS.REFLECTIONS, safeReflections);
      }

      if (Array.isArray(data.studyBlocks)) {
        const safeSB = data.studyBlocks.map(b => ({
          id: String(b.id || generateId()),
          title: String(b.title || 'Untitled Block'),
          startTime: String(b.startTime),
          endTime: String(b.endTime),
          dayOfWeek: Number(b.dayOfWeek),
          subject: String(b.subject || 'Other'),
          createdAt: String(b.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.STUDY_BLOCKS, safeSB);
      }

      if (Array.isArray(data.studyWindows)) {
        const safeSW = data.studyWindows.map(w => ({
          id: String(w.id || generateId()),
          dayOfWeek: Number(w.dayOfWeek),
          startTime: String(w.startTime),
          endTime: String(w.endTime),
          label: String(w.label || 'Study Session')
        }));
        saveData(KEYS.STUDY_WINDOWS, safeSW);
      }

      if (Array.isArray(data.timeBlocks)) {
        const safeTB = data.timeBlocks.map(b => ({
          id: String(b.id || generateId()),
          date: String(b.date),
          startTime: String(b.startTime),
          endTime: String(b.endTime),
          label: String(b.label || 'Time Block'),
          createdAt: String(b.createdAt || new Date().toISOString())
        }));
        saveData(KEYS.TIME_BLOCKS, safeTB);
      }

      if (data.theme && typeof data.theme === 'string') {
        saveData(KEYS.THEME, data.theme);
      }

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
      if (completions[key] !== true) {
        const task = getTaskById(taskId);
        if (task && typeof Achievements !== 'undefined') {
          const xpAwards = { low: 10, medium: 25, high: 50, critical: 100 };
          Achievements.awardXP(xpAwards[task.priority] || 25, 'Repeating Task Completed');
        }
      }
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
  function getAchievements() { return [...loadData(KEYS.ACHIEVEMENTS, DEFAULTS.achievements)]; }
  function getXPState() { return { ...loadData(KEYS.XP_STATE, DEFAULTS.xpState) }; }
  function getStudyBlocks() { return [...loadData(KEYS.STUDY_BLOCKS, DEFAULTS.studyBlocks)]; }
  function getStudyWindows() { return [...loadData(KEYS.STUDY_WINDOWS, DEFAULTS.studyWindows)]; }
  function getExams() { return [...loadData(KEYS.EXAMS, DEFAULTS.exams)]; }
  function getHabits() { return [...loadData(KEYS.HABITS, DEFAULTS.habits)]; }
  function getNotes() { return [...loadData(KEYS.NOTES, DEFAULTS.notes)]; }
  function getTimeBlocks() { return [...loadData(KEYS.TIME_BLOCKS, DEFAULTS.timeBlocks)]; }
  function getReflections() { return [...loadData(KEYS.REFLECTIONS, DEFAULTS.reflections)]; }
  function getTheme() { return loadData(KEYS.THEME, DEFAULTS.theme); }

  // ── Tasks ───────────────────────────────────────────────────────────────────

  function getTasks() { return [...loadData(KEYS.TASKS, DEFAULTS.tasks)]; }
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
      sortOrder: tasks.length,
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

  // Subtask completion callbacks for reactive updates
  const _subtaskCallbacks = [];

  function onSubtaskCompleted(callback) {
    _subtaskCallbacks.push(callback);
    return () => {
      const idx = _subtaskCallbacks.indexOf(callback);
      if (idx !== -1) _subtaskCallbacks.splice(idx, 1);
    };
  }

  function _notifySubtaskCompleted(taskId, subtask, task, progress) {
    try {
      _subtaskCallbacks.forEach(cb => {
        cb({ taskId, subtask, task, progress });
      });
    } catch (err) {
      console.error('Error in subtask completion callback:', err);
    }
  }

  function toggleSubtask(taskId, subtaskId, isCompleted) {
    return updateSubtask(taskId, subtaskId, { isCompleted });
  }

  function updateSubtask(taskId, subtaskId, updates) {
    const task = getTaskById(taskId);
    if (!task || !task.subtasks) return null;
    
    const subtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, ...updates } : s);
    const result = updateTask(taskId, { subtasks });
    
    // Trigger callbacks if subtask was completed
    if (updates.isCompleted) {
      const completedSubtask = subtasks.find(s => s.id === subtaskId);
      const newProgress = SubtaskUtils && SubtaskUtils.calculateProgress(result);
      _notifySubtaskCompleted(taskId, completedSubtask, result, newProgress);
      
      // Auto-complete parent task if all subtasks are complete
      if (SubtaskUtils && SubtaskUtils.shouldAutoCompleteParent(result)) {
        updateTask(taskId, { completed: true, completedAt: new Date().toISOString() });
      }
    }
    
    return result;
  }

  function deleteTask(id) {
    const tasks = getTasks();
    saveTasks(tasks.filter(t => t.id !== id));
    notifyTaskDataChanged();
    return true;
  }

  function completeTask(id) {
    const task = getTaskById(id);
    if (task && !task.completed) {
      const xpAwards = { low: 10, medium: 25, high: 50, critical: 100 };
      if (typeof Achievements !== 'undefined') {
        Achievements.awardXP(xpAwards[task.priority] || 25, 'Task Completed');
      }

      if (task.subtasks && task.subtasks.length > 0) {
        const updatedSubtasks = task.subtasks.map(s => ({ ...s, isCompleted: true }));
        return updateTask(id, { completed: true, completedAt: new Date().toISOString(), subtasks: updatedSubtasks });
      }
      return updateTask(id, { completed: true, completedAt: new Date().toISOString() });
    }
    return null;
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
    const todayStr = formatDate(new Date());
    return tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      return t.dueDate < todayStr;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  function getTodayTasks() {
    const todayStr = formatDate(new Date());
    const tasks = getTasksByDate(todayStr).filter(t => {
      if (t.type === 'repeating') {
        return !isRepeatingTaskCompletedOnDate(t.id, todayStr);
      }
      return !t.completed;
    });
    const overdue = getOverdueTasks().map(t => ({ ...t, _isOverdue: true }));
    // Combine and deduplicate if a task is both today and overdue (though usually they aren't)
    const combined = [...tasks];
    overdue.forEach(ot => {
      if (!combined.some(t => t.id === ot.id)) combined.push(ot);
    });
    return combined;
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

  function getSubjects() { return [...loadData(KEYS.SUBJECTS, DEFAULTS.subjects)]; }
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

  function getSessions() { return [...loadData(KEYS.SESSIONS, DEFAULTS.sessions)]; }
  function saveSessions(sessions) { return saveData(KEYS.SESSIONS, [...sessions]); }

  function addSession(duration, type = 'work', taskId = null, notes = '') {
    const sessions = getSessions();
    const newSession = {
      id: generateId(),
      duration,
      type,
      taskId,
      notes,
      completedAt: new Date().toISOString()
    };
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
      goals.freezeCount = DEFAULTS.goals.freezeCount || 1;
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

  // ── Spaced Repetition (SRS) ──────────────────────────────────────────────────

  function getFlashcards() { return [...loadData(KEYS.FLASHCARDS, DEFAULTS.flashcards)]; }
  function saveFlashcards(cards) { return saveData(KEYS.FLASHCARDS, [...cards]); }

  function getDecks() { return [...loadData(KEYS.DECKS, DEFAULTS.decks)]; }
  function saveDecks(decks) { return saveData(KEYS.DECKS, [...decks]); }

  function getReviewLogs() { return [...loadData(KEYS.REVIEW_LOGS, DEFAULTS.reviewLogs)]; }
  function saveReviewLogs(logs) { return saveData(KEYS.REVIEW_LOGS, [...logs]); }

  function addFlashcard(card) {
    const cards = getFlashcards();
    const newCard = {
      id: 'fc_' + generateId(),
      deckId: card.deckId,
      front: card.front || '',
      back: card.back || '',
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: formatDate(new Date()),
      createdAt: new Date().toISOString()
    };
    cards.push(newCard);
    saveFlashcards(cards);
    return newCard;
  }

  function updateFlashcard(id, updates) {
    const cards = getFlashcards();
    const idx = cards.findIndex(c => c.id === id);
    if (idx !== -1) {
      cards[idx] = { ...cards[idx], ...updates };
      saveFlashcards(cards);
      return cards[idx];
    }
    return null;
  }

  function deleteFlashcard(id) {
    const cards = getFlashcards();
    saveFlashcards(cards.filter(c => c.id !== id));
    return true;
  }

  function getDeckBySubject(subjectId) {
    let decks = getDecks();
    let deck = decks.find(d => d.subjectId === subjectId);
    if (!deck) {
      deck = {
        id: 'deck_' + generateId(),
        subjectId: subjectId,
        createdAt: new Date().toISOString()
      };
      decks.push(deck);
      saveDecks(decks);
    }
    return deck;
  }

  function addReviewLog(cardId, rating) {
    const logs = getReviewLogs();
    const log = {
      id: generateId(),
      cardId,
      rating,
      timestamp: new Date().toISOString()
    };
    logs.push(log);
    saveReviewLogs(logs);
    if (typeof Achievements !== 'undefined') {
      Achievements.awardXP(5, 'Flashcard Reviewed');
    }
    return log;
  }

  // ── Timer persistence ────────────────────────────────────────────────────────

  function getTimerState() { return loadData(KEYS.TIMER, null); }
  function saveTimerState(state) { return saveData(KEYS.TIMER, { ...state }); }
  function clearTimerState() { return removeData(KEYS.TIMER); }

  function completeTimerSession(timerState, recordSession = true, notes = '') {
    const settings = getSettings();
    const { type, sessionsInCycle, selectedTaskId, selectedSubtaskId, timeRemaining } = timerState;
    let nextSessionsInCycle = sessionsInCycle || 0;

    if (type === 'work') {
      if (recordSession) {
        const configuredSeconds = settings.work_duration * 60;
        const elapsed = timeRemaining !== undefined
          ? configuredSeconds - timeRemaining
          : configuredSeconds;
        const actualMinutes = Math.max(1, Math.round(elapsed / 60));
        addSession(actualMinutes, 'work', selectedTaskId, notes);
        if (typeof Achievements !== 'undefined') {
          Achievements.awardXP(actualMinutes, 'Focus Session');
        }
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
    const tasks = loadData(KEYS.TASKS, DEFAULTS.tasks);
    const sessions = loadData(KEYS.SESSIONS, DEFAULTS.sessions);
    const now = new Date();
    const todayStr = formatDate(now);
    const weekStart = getWeekStart(now);
    const weekStartTime = weekStart.getTime();

    const dayOfWeek = now.getDay();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStartTime = today.getTime();
    const todayEndTime = todayStartTime + 86400000;
    const future7DaysStr = formatDate(new Date(todayStartTime + 7 * 86400000));
    const activityCutoff = todayStartTime - (366 * 86400000);

    let completedTasks = 0, todayCompleted = 0, todayTotalCount = 0, todayPendingCount = 0;
    let pendingCount = 0, weekCompleted = 0, overdueTasks = 0, upcomingTasks = 0;

    const activityDates = new Set();
    const completions = getRepeatingCompletions();
    const reusableDate = new Date();

    tasks.forEach(t => {
      const isRepeating = t.type === 'repeating';
      const compTime = t.completedAt ? (typeof t.completedAt === 'number' ? t.completedAt : Date.parse(t.completedAt)) : 0;

      const isCompletedToday = isRepeating
        ? (completions[`${t.id}_${todayStr}`] === true)
        : (t.completed && compTime >= todayStartTime && compTime < todayEndTime);

      let isScheduledForToday = false;
      let isOverdue = false;

      if (isRepeating) {
        if (t.repeatDays && t.repeatDays.includes(dayOfWeek)) isScheduledForToday = true;
      } else {
        if (t.dueDate) {
          const start = t.startDate || t.dueDate;
          if (todayStr >= start && todayStr <= t.dueDate) isScheduledForToday = true;
          if (t.dueDate < todayStr && !t.completed) isOverdue = true;
        }
      }

      if (isScheduledForToday || isOverdue) {
        todayTotalCount++;
        if (!isCompletedToday && (isRepeating || !t.completed)) todayPendingCount++;
      }

      if (t.completed) {
        completedTasks++;
        if (compTime > 0) {
          if (compTime >= weekStartTime) weekCompleted++;
          if (compTime >= activityCutoff) {
            reusableDate.setTime(compTime);
            activityDates.add(formatDate(reusableDate));
          }
        }
      } else {
        if (!isCompletedToday) pendingCount++;
        if (isOverdue) overdueTasks++;
        if (isRepeating) {
          upcomingTasks++;
        } else if (t.dueDate) {
          const start = t.startDate || t.dueDate;
          if (t.dueDate < todayStr || (t.dueDate >= todayStr && start <= future7DaysStr)) upcomingTasks++;
        }
      }
      if (isCompletedToday) {
        todayCompleted++;
        activityDates.add(todayStr);
      }
    });

    let todaySessions = 0, weekSessions = 0, totalMinutesToday = 0, totalMinutesWeek = 0;
    sessions.forEach(s => {
      if (!s.completedAt) return;
      const compTime = typeof s.completedAt === 'number' ? s.completedAt : Date.parse(s.completedAt);
      if (isNaN(compTime)) return;

      if (s.type === 'work') {
        if (compTime >= activityCutoff) {
          reusableDate.setTime(compTime);
          activityDates.add(formatDate(reusableDate));
        }
        if (compTime >= todayStartTime && compTime < todayEndTime) {
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

    return {
      tasks: {
        total: tasks.length,
        completed: completedTasks,
        pending: pendingCount,
        today: todayTotalCount,
        todayCompleted,
        todayPending: todayPendingCount,
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
      const tasks = loadData(KEYS.TASKS, DEFAULTS.tasks);
      const sessions = loadData(KEYS.SESSIONS, DEFAULTS.sessions);
      activityDates = new Set();
      const reusableDate = new Date();
      tasks.forEach(t => {
        if (t.completedAt) {
          const compTime = typeof t.completedAt === 'number' ? t.completedAt : Date.parse(t.completedAt);
          if (!isNaN(compTime)) {
            reusableDate.setTime(compTime);
            activityDates.add(formatDate(reusableDate));
          }
        }
      });
      sessions.forEach(s => {
        if (s.type === 'work' && s.completedAt) {
          const compTime = typeof s.completedAt === 'number' ? s.completedAt : Date.parse(s.completedAt);
          if (!isNaN(compTime)) {
            reusableDate.setTime(compTime);
            activityDates.add(formatDate(reusableDate));
          }
        }
      });
    }
    const sortedDates = Array.from(activityDates).sort();
    if (sortedDates.length === 0) return 0;
    let bestStreak = 0, currentStreak = 0, lastTime = null;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const streakReusableDate = new Date();
    sortedDates.forEach(dateStr => {
      const parts = dateStr.split('-');
      streakReusableDate.setFullYear(parts[0], parts[1] - 1, parts[2]);
      streakReusableDate.setHours(0, 0, 0, 0);
      const currentTime = streakReusableDate.getTime();
      if (lastTime) {
        const diffDays = Math.round((currentTime - lastTime) / MS_PER_DAY);
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      } else {
        currentStreak = 1;
      }
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      lastTime = currentTime;
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
      const tasks = loadData(KEYS.TASKS, DEFAULTS.tasks);
      const sessions = loadData(KEYS.SESSIONS, DEFAULTS.sessions);
      activityDates = new Set();
      const reusableDate = new Date();
      tasks.forEach(t => {
        if (t.completedAt) {
          const compTime = typeof t.completedAt === 'number' ? t.completedAt : Date.parse(t.completedAt);
          if (!isNaN(compTime)) {
            reusableDate.setTime(compTime);
            activityDates.add(formatDate(reusableDate));
          }
        }
      });
      sessions.forEach(s => {
        if (s.type === 'work' && s.completedAt) {
          const compTime = typeof s.completedAt === 'number' ? s.completedAt : Date.parse(s.completedAt);
          if (!isNaN(compTime)) {
            reusableDate.setTime(compTime);
            activityDates.add(formatDate(reusableDate));
          }
        }
      });
    }

    const goals = loadData(KEYS.GOALS, DEFAULTS.goals);
    let currentFreezeCount = goals.freezeCount || 0;
    const weekStart = new Date(goals.week_start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const dateStr = formatDate(checkDate);
      if (activityDates.has(dateStr)) {
        streak++;
      } else {
        // Only apply freeze if it's within the current week and we have freezes left
        if (checkDate >= weekStart && checkDate <= today && currentFreezeCount > 0) {
          currentFreezeCount--;
          // Update storage so it stays decremented
          updateGoals({ freezeCount: currentFreezeCount });
          // Don't increment streak, but also don't break it
        } else {
          break;
        }
      }
      // Move back one day by modifying the existing Date instance
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'id_' + crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11) + '_' + (generateId._counter = (generateId._counter || 0) + 1);
  }

  function formatDate(date) {
    // Avoid re-instantiating if already a Date; reuse object if possible in high-perf loops
    const d = (date instanceof Date) ? date : new Date(date);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    // Use year directly, and fast conditional padding
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
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

  function isDateOverdue(dateStr) {
    if (!dateStr) return false;
    return dateStr < formatDate(new Date());
  }

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
    getAchievements, getXPState, getStudyBlocks, getStudyWindows, getExams,
    getHabits, getNotes, getTimeBlocks, getReflections, getTheme,
    generateId, formatDate, formatDisplayDate, getRelativeDays, getDaysUntil,
    getWeekNumber, isToday, isDateOverdue, getWeekStart,
    getRepeatingCompletions, saveRepeatingCompletions, isRepeatingTaskCompletedOnDate,
    setRepeatingTaskCompletedOnDate, pruneRepeatingCompletions,
    onSubtaskCompleted, _notifySubtaskCompleted,
    getFlashcards, saveFlashcards, getDecks, saveDecks, getReviewLogs, saveReviewLogs,
    addFlashcard, updateFlashcard, deleteFlashcard, getDeckBySubject, addReviewLog
  };
})();

window.Storage = Storage;
