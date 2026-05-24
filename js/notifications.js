/**
 * StudyFlow - Notification Module
 * Handles task notifications and reminders
 */

const NotificationManager = (function() {
  'use strict';

  const NOTIFICATION_TYPES = {
    TASK_DUE_SOON: 'task_due_soon',
    TASK_OVERDUE: 'task_overdue',
    DAILY_GOAL_COMPLETE: 'daily_goal_complete',
    STREAK_FROZEN: 'streak_frozen',
    SESSION_COMPLETE: 'session_complete'
  };

  let notificationQueue = [];
  let lastNotificationTime = {};

  /**
   * Request notification permission from user
   */
  function requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return Promise.resolve(false);
    }
    if (Notification.permission === 'granted') {
      return Promise.resolve(true);
    }
    if (Notification.permission === 'denied') {
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(permission => permission === 'granted');
  }

  /**
   * Check if notifications are enabled in settings
   */
  function isEnabled() {
    const settings = Storage.getSettings();
    return settings.notifications !== false || settings.task_notifications !== false;
  }

  /**
   * Send a notification with throttling to avoid spam
   */
  function notify(type, title, options = {}) {
    if (!isEnabled() || Notification.permission !== 'granted') {
      return;
    }

    // Throttle notifications of the same type (max 1 per minute)
    const now = Date.now();
    if (lastNotificationTime[type] && now - lastNotificationTime[type] < 60000) {
      console.log(`[v0] Notification throttled: ${type}`);
      return;
    }
    lastNotificationTime[type] = now;

    try {
      const notification = new Notification(title, {
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: type,
        requireInteraction: options.requireInteraction || false,
        ...options
      });

      if (Storage.getSettings().sound !== false) {
        playNotificationSound();
      }

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.action) {
          options.action();
        }
      };
    } catch (err) {
      console.error('Notification error:', err);
    }
  }

  /**
   * Play a subtle notification sound
   */
  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch (err) {
      console.error('Audio error:', err);
    }
  }

  /**
   * Check for upcoming tasks and send notifications
   */
  function checkUpcomingTasks() {
    if (!Storage.getSettings().task_notifications) {
      return;
    }

    const tasks = Storage.getUpcomingTasks(1);
    const today = Storage.formatDate(new Date());

    tasks.forEach(task => {
      if (task.completed) return;
      if (!task.dueDate) return;

      // Overdue tasks
      if (task.dueDate < today && !task.completed) {
        notify(NOTIFICATION_TYPES.TASK_OVERDUE, 'Task Overdue!', {
          body: `"${task.title}" was due ${Storage.getRelativeDays(task.dueDate)}`,
          requireInteraction: true,
          action: () => {
            window.location.href = 'tasks.html';
          }
        });
      }
      // Tasks due today
      else if (task.dueDate === today) {
        notify(NOTIFICATION_TYPES.TASK_DUE_SOON, 'Task Due Today!', {
          body: `"${task.title}" is due today`,
          action: () => {
            window.location.href = 'tasks.html';
          }
        });
      }
    });
  }

  /**
   * Notify when daily goals are met
   */
  function checkDailyGoalCompletion() {
    const stats = Storage.getStats();
    const goals = Storage.getGoals();

    if (stats.tasks.todayCompleted >= goals.daily_tasks) {
      notify(NOTIFICATION_TYPES.DAILY_GOAL_COMPLETE, 'Daily Goal Complete! 🎉', {
        body: `You\'ve completed ${stats.tasks.todayCompleted} tasks today!`,
        requireInteraction: false
      });
    }
  }

  /**
   * Notify when streak freeze is used
   */
  function notifyStreakFrozen() {
    notify(NOTIFICATION_TYPES.STREAK_FROZEN, 'Streak Frozen! ❄️', {
      body: 'Your study streak has been preserved for today',
      requireInteraction: false
    });
  }

  return {
    NOTIFICATION_TYPES,
    requestPermission,
    isEnabled,
    notify,
    playNotificationSound,
    checkUpcomingTasks,
    checkDailyGoalCompletion,
    notifyStreakFrozen
  };
})();

if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
}
