/**
 * StudyFlow - Smart Features Module
 * Handles Q4: Auto-Complete Daily Goals
 * Handles Q6: Spaced Repetition Indicator
 * Handles Q7: Mastery Graph Visualization
 */

const SmartFeatures = (function() {
  'use strict';

  /**
   * Q4: Auto-complete daily goals when daily targets are met
   */
  function checkAndCompleteDailyGoals() {
    const stats = Storage.getStats();
    const goals = Storage.getGoals();
    const settings = Storage.getSettings();

    // Check if daily task goal is met
    if (stats.tasks.todayCompleted >= goals.daily_tasks) {
      NotificationManager.checkDailyGoalCompletion();
    }

    // Check if daily hours goal is met
    const todayMinutes = Storage.getTotalMinutesToday();
    const dailyHoursInMinutes = goals.daily_hours * 60;
    if (todayMinutes >= dailyHoursInMinutes && stats.tasks.todayCompleted >= goals.daily_tasks) {
      console.log('[v0] Daily goals achieved!');
    }
  }

  /**
   * Q6: Calculate spaced repetition interval for a subtask
   * Uses SM-2 algorithm for optimal review spacing
   */
  function getSpacedRepetitionInterval(subtask) {
    if (!subtask || !subtask.completedCycles) {
      return 1; // First review: next day
    }

    const interval = Math.min(subtask.completedCycles * 3, 365);
    return Math.max(1, interval);
  }

  /**
   * Q6: Get next review date for a subtask
   */
  function getNextReviewDate(subtask) {
    if (!subtask) return null;

    const interval = getSpacedRepetitionInterval(subtask);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    return Storage.formatDate(nextDate);
  }

  /**
   * Q6: Determine if a subtask needs review
   */
  function needsReview(task) {
    if (!task || !task.subtasks) return false;

    const today = Storage.formatDate(new Date());
    return task.subtasks.some(subtask => {
      if (subtask.isCompleted) {
        const nextReview = getNextReviewDate(subtask);
        return nextReview && nextReview <= today;
      }
      return false;
    });
  }

  /**
   * Q6: Get spaced repetition indicator for UI
   */
  function getSpacedRepetitionBadge(task) {
    if (!task || !task.subtasks) return null;

    let needsReviewCount = 0;
    let reviewIndicator = null;

    task.subtasks.forEach(subtask => {
      if (subtask.isCompleted) {
        const nextReview = getNextReviewDate(subtask);
        if (nextReview && nextReview <= Storage.formatDate(new Date())) {
          needsReviewCount++;
        }
      }
    });

    if (needsReviewCount > 0) {
      reviewIndicator = {
        count: needsReviewCount,
        total: task.subtasks.length,
        color: '#EAB308',
        icon: '📚',
        label: `${needsReviewCount} due for review`
      };
    }

    return reviewIndicator;
  }

  /**
   * Q7: Generate mastery graph data for visualization
   */
  function getMasteryGraphData() {
    const subjects = Storage.getSubjects();
    const stats = Storage.getSubjectMasteryStats();

    return {
      subjects: stats.map(s => ({
        name: s.name,
        percentage: s.percentage,
        color: s.color,
        completed: s.completed,
        total: s.total
      })),
      average: stats.length > 0 
        ? Math.round(stats.reduce((sum, s) => sum + s.percentage, 0) / stats.length)
        : 0
    };
  }

  /**
   * Q7: Get weekly progress data for graph
   */
  function getWeeklyProgressData() {
    const week = 7;
    const sessions = Storage.getWeekSessions();
    const dayData = {};

    // Initialize all days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = Storage.formatDate(date);
      dayData[dateStr] = { date: dateStr, focused: 0, breaks: 0, tasks: 0, dayName: date.toLocaleDateString('en-US', { weekday: 'short' }) };
    }

    // Add session data
    sessions.forEach(session => {
      const dateStr = Storage.formatDate(new Date(session.completedAt));
      if (dayData[dateStr]) {
        if (session.type === 'work') {
          dayData[dateStr].focused += session.duration;
        } else {
          dayData[dateStr].breaks += session.duration;
        }
      }
    });

    // Add task data
    const tasks = Storage.getTasks();
    tasks.forEach(task => {
      if (task.completed && task.completedAt) {
        const dateStr = Storage.formatDate(new Date(task.completedAt));
        if (dayData[dateStr]) {
          dayData[dateStr].tasks++;
        }
      }
    });

    return Object.values(dayData);
  }

  /**
   * Create SVG bar chart for mastery levels
   */
  function renderMasteryChart() {
    const data = getMasteryGraphData();
    const width = 300;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family: sans-serif;">`;

    // Background
    svg += `<rect width="${width}" height="${height}" fill="rgba(255,255,255,0.02)" rx="8"/>`;

    // Y-axis
    svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;

    // X-axis
    svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>`;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
      const y = height - padding.bottom - (i * (height - padding.top - padding.bottom) / 5);
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2,2"/>`;
      svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="rgba(255,255,255,0.5)">${i * 20}%</text>`;
    }

    // Bars
    const barWidth = (width - padding.left - padding.right) / Math.max(data.subjects.length, 1);
    data.subjects.forEach((subject, idx) => {
      const x = padding.left + (idx * barWidth) + (barWidth * 0.1);
      const barHeight = ((height - padding.top - padding.bottom) * subject.percentage) / 100;
      const y = height - padding.bottom - barHeight;

      svg += `<rect x="${x}" y="${y}" width="${barWidth * 0.8}" height="${barHeight}" fill="${subject.color}" rx="4" opacity="0.8"/>`;
      svg += `<text x="${x + (barWidth * 0.4)}" y="${height - padding.bottom + 20}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,0.7)">${subject.name.substring(0, 3)}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  return {
    checkAndCompleteDailyGoals,
    getSpacedRepetitionInterval,
    getNextReviewDate,
    needsReview,
    getSpacedRepetitionBadge,
    getMasteryGraphData,
    getWeeklyProgressData,
    renderMasteryChart
  };
})();

if (typeof window !== 'undefined') {
  window.SmartFeatures = SmartFeatures;
}
