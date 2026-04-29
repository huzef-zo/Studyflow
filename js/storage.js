/**
 * StudyFlow - Storage Module
 * Handles all localStorage operations
 */

const Storage = (function() {
  'use strict';

  // Storage keys
  const KEYS = {
    USER: 'studyflow_user',
    TASKS: 'studyflow_tasks',
    SUBJECTS: 'studyflow_subjects',
    SESSIONS: 'studyflow_sessions',
    GOALS: 'studyflow_goals',
    SETTINGS: 'studyflow_settings',
    TIMER: 'studyflow_timer'
  };

  // In-memory cache to avoid redundant JSON.parse and localStorage.getItem calls
  const cache = {};

  // Sync cache with other tabs
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

  // Default data structures
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
    }
  };

  /**
   * Get the start of the current week (Monday)
   */
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Save data to localStorage
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {boolean} - Success status
   */
  function saveData(key, data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      // Update cache
      cache[key] = data;
      return true;
    } catch (error) {
      console.error('Storage save error:', error);
      return false;
    }
  }

  /**
   * Load data from localStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if key doesn't exist
   * @returns {any} - Loaded data or default value
   */
  function loadData(key, defaultValue = null) {
    // Return from cache if available
    if (cache.hasOwnProperty(key)) {
      return cache[key];
    }

    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) {
        return defaultValue;
      }
      const data = JSON.parse(serialized);
      // Store in cache
      cache[key] = data;
      return data;
    } catch (error) {
      console.error('Storage load error:', error);
      return defaultValue;
    }
  }

  /**
   * Remove data from localStorage
   * @param {string} key - Storage key
   */
  function removeData(key) {
    try {
      localStorage.removeItem(key);
      // Clear from cache
      delete cache[key];
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  }

  /**
   * Clear all StudyFlow data
   */
  function clearAllData() {
    Object.values(KEYS).forEach(key => {
      removeData(key);
    });
    // Ensure cache is completely cleared
    Object.keys(cache).forEach(key => delete cache[key]);
  }

  /**
   * Export all data as JSON
   * @returns {object} - All StudyFlow data
   */
  function exportData() {
    return {
      user: getUser(),
      tasks: getTasks(),
      subjects: getSubjects(),
      sessions: getSessions(),
      goals: getGoals(),
      settings: getSettings(),
      exported_at: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Import data from JSON
   * @param {object} data - Data to import
   * @returns {boolean} - Success status
   */
  function importData(data) {
    try {
      if (data.user) saveData(KEYS.USER, data.user);
      if (data.tasks) saveData(KEYS.TASKS, data.tasks);
      if (data.subjects) saveData(KEYS.SUBJECTS, data.subjects);
      if (data.sessions) saveData(KEYS.SESSIONS, data.sessions);
      if (data.goals) saveData(KEYS.GOALS, data.goals);
      if (data.settings) saveData(KEYS.SETTINGS, data.settings);
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }

  // ============================================
  // User Functions
  // ============================================

  function getUser() {
    return loadData(KEYS.USER, DEFAULTS.user);
  }

  function saveUser(user) {
    return saveData(KEYS.USER, user);
  }

  function updateUserName(name) {
    const user = getUser();
    user.name = name;
    return saveUser(user);
  }

  function updateUserEmail(email) {
    const user = getUser();
    user.email = email;
    return saveUser(user);
  }

  // ============================================
  // Task Functions
  // ============================================

  function getTasks() {
    return loadData(KEYS.TASKS, DEFAULTS.tasks);
  }

  function saveTasks(tasks) {
    return saveData(KEYS.TASKS, [...tasks]);
  }

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
      subtasks: subtasks,
      progress: progress,
      createdAt: new Date().toISOString()
    };
    tasks.push(newTask);
    saveTasks(tasks);
    return newTask;
  }

  function updateTask(id, updates) {
    const tasks = getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      const task = { ...tasks[index], ...updates };

      // Update progress and completion status if subtasks changed
      if (task.subtasks && task.subtasks.length > 0) {
        const completedCount = task.subtasks.filter(s => s.isCompleted).length;
        task.progress = Math.round((completedCount / task.subtasks.length) * 100);
        task.completed = task.subtasks.every(s => s.isCompleted);
      } else if (task.subtasks) {
        task.progress = 0;
      }

      tasks[index] = task;
      saveTasks(tasks);
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
    return updateTask(taskId, { subtasks: subtasks });
  }

  function toggleSubtask(taskId, subtaskId, isCompleted) {
    return updateSubtask(taskId, subtaskId, { isCompleted: isCompleted });
  }

  function updateSubtask(taskId, subtaskId, updates) {
    const task = getTaskById(taskId);
    if (!task || !task.subtasks) return null;

    const subtasks = task.subtasks.map(s => {
      if (s.id === subtaskId) {
        return { ...s, ...updates };
      }
      return s;
    });

    return updateTask(taskId, { subtasks: subtasks });
  }

  function deleteTask(id) {
    const tasks = getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    saveTasks(filtered);
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
    const tasks = getTasks();
    return tasks.find(t => t.id === id) || null;
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
    });
  }

  function getTasksByStatus(completed) {
    const tasks = getTasks();
    return tasks.filter(t => t.completed === completed);
  }

  function getTasksBySubject(subject) {
    const tasks = getTasks();
    return tasks.filter(t => t.subject === subject);
  }

  function getTasksByPriority(priority) {
    const tasks = getTasks();
    return tasks.filter(t => t.priority === priority);
  }

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
      return t.dueDate >= todayStr && start <= futureStr;
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
      const dueDate = new Date(t.dueDate);
      return dueDate < today;
    }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  function getTodayTasks() {
    const today = formatDate(new Date());
    return getTasksByDate(today);
  }

  // ============================================
  // Subject Functions
  // ============================================

  function getSubjects() {
    return loadData(KEYS.SUBJECTS, DEFAULTS.subjects);
  }

  function saveSubjects(subjects) {
    return saveData(KEYS.SUBJECTS, [...subjects]);
  }

  function addSubject(name, color) {
    const subjects = getSubjects();
    const newSubject = {
      id: generateId(),
      name: name,
      color: color || '#2563EB',
      createdAt: new Date().toISOString()
    };
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
    const subjects = getSubjects();
    const filtered = subjects.filter(s => s.id !== id);
    saveSubjects(filtered);
    return true;
  }

  function getSubjectById(id) {
    const subjects = getSubjects();
    return subjects.find(s => s.id === id) || null;
  }

  function getSubjectByName(name) {
    const subjects = getSubjects();
    return subjects.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  // ============================================
  // Pomodoro Session Functions
  // ============================================

  function getSessions() {
    return loadData(KEYS.SESSIONS, DEFAULTS.sessions);
  }

  function saveSessions(sessions) {
    return saveData(KEYS.SESSIONS, [...sessions]);
  }

  function addSession(duration, type = 'work', taskId = null) {
    const sessions = getSessions();
    const newSession = {
      id: generateId(),
      duration: duration,
      type: type,
      taskId: taskId,
      completedAt: new Date().toISOString()
    };
    sessions.push(newSession);
    saveSessions(sessions);
    return newSession;
  }

  function getTodaySessions() {
    const sessions = getSessions();
    const today = formatDate(new Date());
    return sessions.filter(s => {
      const sessionDate = formatDate(new Date(s.completedAt));
      return sessionDate === today && s.type === 'session_complete';
    });
  }

  function getTodayWorkSessions() {
    const sessions = getSessions();
    const today = formatDate(new Date());
    return sessions.filter(s => {
      const sessionDate = formatDate(new Date(s.completedAt));
      return sessionDate === today && s.type === 'work';
    });
  }

  function getWeekSessions() {
    const sessions = getSessions();
    const weekStart = getWeekStart(new Date());
    return sessions.filter(s => {
      const sessionDate = new Date(s.completedAt);
      return sessionDate >= weekStart && s.type === 'session_complete';
    });
  }

  function getWeekWorkSessions() {
    const sessions = getSessions();
    const weekStart = getWeekStart(new Date());
    return sessions.filter(s => {
      const sessionDate = new Date(s.completedAt);
      return sessionDate >= weekStart && s.type === 'work';
    });
  }

  function getTotalMinutesToday() {
    const sessions = getSessions();
    const today = formatDate(new Date());
    const workBlocks = sessions.filter(s => {
      const sessionDate = formatDate(new Date(s.completedAt));
      return sessionDate === today && s.type === 'work';
    });
    return workBlocks.reduce((total, s) => total + s.duration, 0);
  }

  function getTotalMinutesWeek() {
    const sessions = getSessions();
    const weekStart = getWeekStart(new Date());
    const workBlocks = sessions.filter(s => {
      const sessionDate = new Date(s.completedAt);
      return sessionDate >= weekStart && s.type === 'work';
    });
    return workBlocks.reduce((total, s) => total + s.duration, 0);
  }

  // ============================================
  // Goals Functions
  // ============================================

  function getGoals() {
    let goals = loadData(KEYS.GOALS, DEFAULTS.goals);

    // Merge with defaults to ensure new properties exist (like daily goals)
    goals = { ...DEFAULTS.goals, ...goals };
    
    // Dynamically calculate current progress
    const weekStart = getWeekStart(new Date());
    const weekStartStr = weekStart.toISOString();

    // Reset week_start if needed
    if (goals.week_start !== weekStartStr) {
      goals.week_start = weekStartStr;
      saveGoals(goals);
    }

    // Calculate completed tasks this week
    const tasks = getTasks();
    goals.current_tasks = tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      return new Date(t.completedAt) >= weekStart;
    }).length;

    // Calculate study hours this week
    const totalMinutes = getTotalMinutesWeek();
    goals.current_hours = totalMinutes / 60;
    
    return goals;
  }

  function saveGoals(goals) {
    return saveData(KEYS.GOALS, goals);
  }

  function updateGoals(updates) {
    const goals = getGoals();
    const updated = { ...goals, ...updates };
    return saveGoals(updated);
  }

  // ============================================
  // Settings Functions
  // ============================================

  function getSettings() {
    const saved = loadData(KEYS.SETTINGS, DEFAULTS.settings);
    return { ...DEFAULTS.settings, ...saved };
  }

  function saveSettings(settings) {
    return saveData(KEYS.SETTINGS, settings);
  }

  function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    return saveSettings(settings);
  }

  // ============================================
  // Timer Persistence Functions
  // ============================================

  function getTimerState() {
    return loadData(KEYS.TIMER, null);
  }

  function saveTimerState(state) {
    return saveData(KEYS.TIMER, { ...state });
  }

  function clearTimerState() {
    return removeData(KEYS.TIMER);
  }

  /**
   * Complete a timer session and return the next state
   * Useful for both the timer page and background tasks
   */
  function completeTimerSession(timerState, recordSession = true) {
    const settings = getSettings();
    const { type, sessionsInCycle, selectedTaskId, selectedSubtaskId } = timerState;

    let nextSessionsInCycle = sessionsInCycle || 0;

    // Save session if it was a work session and recording is enabled
    if (type === 'work') {
      if (recordSession) {
        // Record work cycle duration
        addSession(settings.work_duration || 25, 'work', selectedTaskId);
      }

      nextSessionsInCycle++;

      // Check if cycle (N sessions) is complete
      const n = settings.sessions_until_long_break || 4;
      if (nextSessionsInCycle >= n) {
        // Record completed session
        addSession(0, 'session_complete', selectedTaskId);
      }

      // Increment sub-task cycles if selected and recorded
      if (recordSession && selectedTaskId && selectedSubtaskId) {
        const task = getTaskById(selectedTaskId);
        if (task && task.subtasks) {
          const subtask = task.subtasks.find(s => s.id === selectedSubtaskId);
          if (subtask) {
            const newCycles = (subtask.completedCycles || 0) + 1;
            updateSubtask(selectedTaskId, selectedSubtaskId, {
              completedCycles: newCycles
            });
          }
        }
      }
    }

    // Determine next session type
    let nextType;
    if (type === 'work') {
      const cycleLength = settings.sessions_until_long_break || 4;
      if (nextSessionsInCycle >= cycleLength) {
        nextType = 'long_break';
      } else {
        nextType = 'short_break';
      }
    } else if (type === 'long_break') {
      nextType = 'work';
      nextSessionsInCycle = 0;
    } else if (type === 'short_break') {
      nextType = 'work';
    } else {
      nextType = 'work';
    }

    // Get duration for next type
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
      sessionsInCycle: nextSessionsInCycle,
      selectedTaskId: selectedTaskId,
      selectedSubtaskId: selectedSubtaskId,
      lastCompletedType: type,
      completedAt: new Date().toISOString()
    };

    saveTimerState(newState);
    return newState;
  }

  // ============================================
  // Statistics Functions
  // ============================================

  function getSubjectMasteryStats() {
    const tasks = getTasks();
    const subjects = getSubjects();

    return subjects.map(subject => {
      const subjectTasks = tasks.filter(t => t.subject === subject.name);
      const total = subjectTasks.length;
      const completed = subjectTasks.filter(t => t.completed).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...subject,
        total,
        completed,
        percentage
      };
    });
  }

  function getStats() {
    const tasks = getTasks();
    const today = formatDate(new Date());
    const weekStart = getWeekStart(new Date());
    
    // Task stats
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const todayTasks = getTasksByDate(today);
    const todayCompleted = todayTasks.filter(t => t.completed).length;
    const todayPending = todayTasks.filter(t => !t.completed).length;
    
    // Week stats
    const weekTasks = tasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = new Date(t.completedAt);
      return completedDate >= weekStart;
    });
    const weekCompleted = weekTasks.length;
    
    // Overdue
    const overdueTasks = getOverdueTasks().length;
    
    // Upcoming (next 7 days)
    const upcomingTasks = getUpcomingTasks(7).length;
    
    // Sessions
    const todaySessions = getTodayWorkSessions().length;
    const weekSessions = getWeekWorkSessions().length;
    const totalMinutesToday = getTotalMinutesToday();
    const totalMinutesWeek = getTotalMinutesWeek();
    
    // Streak calculation
    const streak = calculateStreak();
    const bestStreak = calculateBestStreak();
    
    return {
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        today: todayTasks.length,
        todayCompleted: todayCompleted,
        todayPending: todayPending,
        weekCompleted: weekCompleted,
        overdue: overdueTasks,
        upcoming: upcomingTasks
      },
      sessions: {
        today: todaySessions,
        week: weekSessions,
        minutesToday: totalMinutesToday,
        minutesWeek: totalMinutesWeek
      },
      streak: streak,
      bestStreak: bestStreak
    };
  }

  /**
   * Calculate best streak
   */
  function calculateBestStreak() {
    const tasks = getTasks();
    const sessions = getSessions();

    // Get all dates with activity
    const activityDates = new Set();

    // Add task completion dates
    tasks.forEach(t => {
      if (t.completedAt) {
        activityDates.add(formatDate(new Date(t.completedAt)));
      }
    });

    // Add session dates (only work sessions)
    sessions.forEach(s => {
      if (s.type === 'work') {
        activityDates.add(formatDate(new Date(s.completedAt)));
      }
    });

    const sortedDates = Array.from(activityDates).sort();
    if (sortedDates.length === 0) return 0;

    let bestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;

    sortedDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      currentDate.setHours(0, 0, 0, 0);

      if (lastDate) {
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      if (currentStreak > bestStreak) bestStreak = currentStreak;
      lastDate = currentDate;
    });

    return bestStreak;
  }

  /**
   * Calculate current streak
   */
  function calculateStreak() {
    const tasks = getTasks();
    const sessions = getSessions();
    
    // Get all dates with activity
    const activityDates = new Set();
    
    // Add task completion dates
    tasks.forEach(t => {
      if (t.completedAt) {
        activityDates.add(formatDate(new Date(t.completedAt)));
      }
    });
    
    // Add session dates (only work sessions)
    sessions.forEach(s => {
      if (s.type === 'work') {
        activityDates.add(formatDate(new Date(s.completedAt)));
      }
    });
    
    // Calculate streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = formatDate(checkDate);
      
      if (activityDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        // Allow today to be empty but break if a past day is empty
        break;
      }
    }
    
    return streak;
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Generate a unique ID
   */
  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Format date as YYYY-MM-DD
   */
  function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date for display
   */
  function formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Get relative time string
   */
  function getRelativeDays(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays <= 7) return `In ${diffDays} days`;
    return formatDisplayDate(dateStr);
  }

  /**
   * Get days until deadline
   */
  function getDaysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get week number of the year
   */
  function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Check if date is today
   */
  function isToday(dateStr) {
    return formatDate(new Date()) === formatDate(new Date(dateStr));
  }

  // Public API
  return {
    KEYS,
    DEFAULTS,
    
    // Core storage functions
    saveData,
    loadData,
    removeData,
    clearAllData,
    exportData,
    importData,
    
    // User functions
    getUser,
    saveUser,
    updateUserName,
    updateUserEmail,
    
    // Task functions
    getTasks,
    saveTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    getTaskById,
    getTasksByDate,
    getTasksByStatus,
    getTasksBySubject,
    getTasksByPriority,
    getUpcomingTasks,
    getOverdueTasks,
    getTodayTasks,
    addSubtask,
    toggleSubtask,
    updateSubtask,
    
    // Subject functions
    getSubjects,
    saveSubjects,
    addSubject,
    updateSubject,
    deleteSubject,
    getSubjectById,
    getSubjectByName,
    getSubjectMasteryStats,
    
    // Session functions
    getSessions,
    saveSessions,
    addSession,
    getTodaySessions,
    getTodayWorkSessions,
    getWeekSessions,
    getWeekWorkSessions,
    getTotalMinutesToday,
    getTotalMinutesWeek,
    
    // Goals functions
    getGoals,
    saveGoals,
    updateGoals,
    
    // Settings functions
    getSettings,
    saveSettings,
    updateSetting,
    
    // Timer Persistence
    getTimerState,
    saveTimerState,
    clearTimerState,
    completeTimerSession,

    // Statistics
    getStats,
    calculateStreak,
    calculateBestStreak,
    
    // Utility functions
    generateId,
    formatDate,
    formatDisplayDate,
    getRelativeDays,
    getDaysUntil,
    getWeekNumber,
    isToday,
    getWeekStart
  };
})();

// Make Storage available globally
window.Storage = Storage;
