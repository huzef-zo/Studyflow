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
   * Render Frequency Graph (Line Chart)
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
    if (maxCount === 0) maxCount = 5;

    const width = 800;
    const height = 200;
    const paddingX = 40;
    const paddingY = 30;
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2);

    // Calculate points
    const points = days.map((day, i) => {
      const x = paddingX + (i * (chartWidth / (daysCount - 1)));
      const y = height - paddingY - (day.count / maxCount * chartHeight);
      return { x, y, count: day.count, date: day.date };
    });

    // Create line path
    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`).join(' ');

    // Create area path
    const areaPath = `${linePath} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    let svgHtml = `
      <div class="line-graph-wrapper">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="line-graph-svg">
          <!-- Grid Lines (Horizontal) -->
          <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" class="graph-grid-line" />
          <line x1="${paddingX}" y1="${paddingY + chartHeight / 2}" x2="${width - paddingX}" y2="${paddingY + chartHeight / 2}" class="graph-grid-line" />
          <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" class="graph-grid-line" />

          <!-- Area -->
          <path d="${areaPath}" class="graph-area" />

          <!-- Line -->
          <path d="${linePath}" class="graph-line" />

          <!-- Dots -->
          ${points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="4" class="graph-dot">
              <title>${p.count} activities on ${p.date.toLocaleDateString()}</title>
            </circle>
          `).join('')}
        </svg>

        <!-- X-Axis Labels -->
        <div class="graph-labels-x">
          ${days.filter((_, i) => i % 5 === 0 || i === daysCount - 1).map(day => {
            const index = days.indexOf(day);
            const left = (paddingX + (index * (chartWidth / (daysCount - 1)))) / width * 100;
            return `
              <span class="graph-label-x" style="left: ${left}%">
                ${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            `;
          }).join('')}
        </div>

        <!-- Y-Axis Labels -->
        <div class="graph-labels-y">
          <span class="graph-label-y" style="bottom: ${paddingY / height * 100}%">0</span>
          <span class="graph-label-y" style="bottom: 50%">${Math.round(maxCount / 2)}</span>
          <span class="graph-label-y" style="top: ${paddingY / height * 100}%">${maxCount}</span>
        </div>
      </div>
    `;

    elements.frequencyGraph.innerHTML = svgHtml;
    // Reset container style
    elements.frequencyGraph.classList.add('line-graph-container');
  }

  // Public API
  return {
    init
  };
})();

// Make History available globally
window.History = History;
