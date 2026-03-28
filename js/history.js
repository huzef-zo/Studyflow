/**
 * StudyFlow - History Module
 * Handles long-term progress tracking and visualizations
 */

const History = (function() {
  'use strict';

  // DOM Elements
  let elements = {};

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      heatmapGrid: document.getElementById('heatmap-grid'),
      frequencyGraph: document.getElementById('frequency-graph'),
      totalCompletedTasks: document.getElementById('total-completed-tasks'),
      totalStudyHours: document.getElementById('total-study-hours'),
      allTimeStreak: document.getElementById('all-time-streak')
    };
  }

  /**
   * Initialize History module
   */
  function init() {
    initElements();
    updateSummaryStats();
    renderHeatMap();
    renderFrequencyGraph();
  }

  /**
   * Update summary statistics
   */
  function updateSummaryStats() {
    const tasks = Storage.getTasks();
    const sessions = Storage.getSessions();
    const stats = Storage.getStats();

    const completedTasks = tasks.filter(t => t.completed).length;
    const studyMinutes = sessions.filter(s => s.type === 'work').reduce((total, s) => total + s.duration, 0);

    if (elements.totalCompletedTasks) {
      elements.totalCompletedTasks.textContent = completedTasks;
    }
    if (elements.totalStudyHours) {
      elements.totalStudyHours.textContent = Math.round(studyMinutes / 60) + 'h';
    }
    if (elements.allTimeStreak) {
      elements.allTimeStreak.textContent = stats.streak;
    }
  }

  /**
   * Aggregate activity data from Storage
   */
  function getActivityData(daysCount) {
    const tasks = Storage.getTasks();
    const sessions = Storage.getSessions();
    const activityData = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Initialize with 0 for all requested days
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = Storage.formatDate(date);
      activityData[dateStr] = 0;
    }

    // Add task completions
    tasks.forEach(task => {
      if (task.completed && task.completedAt) {
        const dateStr = Storage.formatDate(new Date(task.completedAt));
        if (activityData.hasOwnProperty(dateStr)) {
          activityData[dateStr] += 1;
        }
      }
    });

    // Add study sessions (1 point per 15 minutes of work)
    sessions.forEach(session => {
      if (session.type === 'work' && session.completedAt) {
        const dateStr = Storage.formatDate(new Date(session.completedAt));
        if (activityData.hasOwnProperty(dateStr)) {
          activityData[dateStr] += Math.max(1, Math.round(session.duration / 15));
        }
      }
    });

    return activityData;
  }

  /**
   * Render Activity Heat Map
   */
  function renderHeatMap() {
    if (!elements.heatmapGrid) return;

    // Last 53 weeks (371 days)
    const daysCount = 371;
    const data = getActivityData(daysCount);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the last Sunday to start the grid (GitHub style)
    const lastDay = new Date(today);
    const dayOfWeek = lastDay.getDay(); // 0 is Sunday

    // Total days to show (53 full weeks)
    const totalDays = 53 * 7;
    const startDate = new Date(lastDay);
    startDate.setDate(lastDay.getDate() - totalDays + (dayOfWeek + 1));

    let html = '';
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = Storage.formatDate(date);
      const activityCount = data[dateStr] || 0;

      let level = 0;
      if (activityCount > 10) level = 4;
      else if (activityCount > 5) level = 3;
      else if (activityCount > 2) level = 2;
      else if (activityCount > 0) level = 1;

      const title = `${activityCount} activities on ${date.toLocaleDateString()}`;
      html += `<div class="heatmap-day level-${level}" title="${title}"></div>`;
    }

    elements.heatmapGrid.innerHTML = html;
  }

  /**
   * Render Frequency Graph
   */
  function renderFrequencyGraph() {
    if (!elements.frequencyGraph) return;

    const daysCount = 30;
    const data = getActivityData(daysCount);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let maxCount = 0;
    const days = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = Storage.formatDate(date);
      const count = data[dateStr] || 0;
      if (count > maxCount) maxCount = count;
      days.push({ date, count });
    }

    // Ensure at least some height if all counts are 0
    if (maxCount === 0) maxCount = 10;

    let html = '';
    days.forEach(day => {
      const height = (day.count / maxCount) * 100;
      const label = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      html += `
        <div class="frequency-bar-wrapper">
          <div class="frequency-bar" style="height: ${Math.max(2, height)}%" data-value="${day.count}"></div>
          <span class="frequency-label">${label}</span>
        </div>
      `;
    });

    elements.frequencyGraph.innerHTML = html;
  }

  // Public API
  return {
    init
  };
})();

// Make History available globally
window.History = History;
