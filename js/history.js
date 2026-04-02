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

    // Create smoothed line path using quadratic Bézier curves
    let linePath = '';
    if (points.length > 0) {
      linePath = `M ${points[0].x},${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX = (p0.x + p1.x) / 2;
        linePath += ` Q ${cpX},${p0.y} ${cpX},${(p0.y + p1.y) / 2} T ${p1.x},${p1.y}`;
      }
    }

    // Create area path
    const areaPath = `${linePath} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    let svgHtml = `
      <div class="line-graph-wrapper">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="line-graph-svg">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3" />
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.01" />
            </linearGradient>
          </defs>

          <!-- Grid Lines (Horizontal) -->
          <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" class="graph-grid-line" />
          <line x1="${paddingX}" y1="${paddingY + chartHeight / 2}" x2="${width - paddingX}" y2="${paddingY + chartHeight / 2}" class="graph-grid-line" />
          <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" class="graph-grid-line" />

          <!-- Area -->
          <path d="${areaPath}" fill="url(#areaGradient)" class="graph-area-enhanced" />

          <!-- Line -->
          <path d="${linePath}" class="graph-line" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

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
