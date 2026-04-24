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
      allTimeStreak: document.getElementById('all-time-streak'),
      completionRate: document.getElementById('completion-rate'),
      productiveDay: document.getElementById('productive-day'),
      masteryOverview: document.getElementById('mastery-overview'),
      tasksProgress: document.getElementById('tasks-progress'),
      hoursProgress: document.getElementById('hours-progress'),
      progressPercentage: document.getElementById('progress-percentage')
    };
  }

  /**
   * Initialize History module
   */
  function init() {
    initElements();
    updateSummaryStats();
    renderFrequencyGraph();
    updateMasteryOverview();
    updateWeeklyProgress();
  }

  /**
   * Update summary statistics
   */
  function updateSummaryStats() {
    const tasks = Storage.getTasks();
    const sessions = Storage.getSessions();
    const stats = Storage.getStats();

    const totalTasksCount = tasks.length;
    const completedTasksCount = tasks.filter(t => t.completed).length;
    const studyMinutes = sessions.filter(s => s.type === 'work').reduce((total, s) => total + s.duration, 0);

    if (elements.totalCompletedTasks) {
      elements.totalCompletedTasks.textContent = completedTasksCount;
    }
    if (elements.totalStudyHours) {
      elements.totalStudyHours.textContent = Math.round(studyMinutes / 60) + 'h';
    }
    if (elements.allTimeStreak) {
      elements.allTimeStreak.textContent = stats.bestStreak;
    }

    // Completion Rate
    if (elements.completionRate) {
      const rate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
      elements.completionRate.textContent = `${rate}%`;
    }

    // Most Productive Day
    if (elements.productiveDay) {
      const dayActivity = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
      sessions.forEach(s => {
        if (s.type === 'work' && s.completedAt) {
          const day = new Date(s.completedAt).getDay();
          dayActivity[day] += s.duration;
        }
      });

      let maxDay = 0;
      let maxVal = -1;
      dayActivity.forEach((val, day) => {
        if (val > maxVal) {
          maxVal = val;
          maxDay = day;
        }
      });

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      elements.productiveDay.textContent = maxVal > 0 ? dayNames[maxDay] : 'N/A';
    }
  }

  /**
   * Update mastery overview (reused from dashboard)
   */
  function updateMasteryOverview() {
    if (!elements.masteryOverview) return;
    const stats = Storage.getSubjectMasteryStats();

    if (stats.length === 0) {
      elements.masteryOverview.innerHTML = `
        <div style="grid-column: 1 / -1;">
          ${App.createEmptyStateHtml({
            title: 'No Subjects',
            text: 'Define your subjects in Settings to begin tracking mastery.',
            icon: 'settings',
            padding: '2rem'
          })}
        </div>
      `;
      return;
    }

    elements.masteryOverview.innerHTML = stats.map(subject => `
      <div class="mastery-card">
        <div class="mastery-subject-name" title="${App.escapeHtml(subject.name)}">${App.escapeHtml(subject.name)}</div>
        <div class="mastery-progress-mini">
          <div class="mastery-progress-mini-fill" style="width: ${subject.percentage}%; background-color: ${subject.color};"></div>
        </div>
        <div class="mastery-stats">
          <span>${subject.percentage}%</span>
          <span>${subject.completed}/${subject.total}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update weekly progress (reused from dashboard)
   */
  function updateWeeklyProgress() {
    const goals = Storage.getGoals();
    const stats = Storage.getStats();

    if (elements.tasksProgress) {
      const tasksPercentage = goals.weekly_tasks > 0
        ? Math.round((goals.current_tasks / goals.weekly_tasks) * 100)
        : 0;

      elements.tasksProgress.innerHTML = App.createProgressBar(
        goals.current_tasks,
        goals.weekly_tasks,
        'Tasks Completed'
      );

      if (elements.hoursProgress) {
        const currentHours = Math.round(goals.current_hours * 10) / 10;
        elements.hoursProgress.innerHTML = App.createProgressBar(
          currentHours,
          goals.weekly_hours,
          'Study Hours'
        );

        if (elements.progressPercentage) {
          const hoursPercentage = goals.weekly_hours > 0 ? (goals.current_hours / goals.weekly_hours * 100) : 0;
          const avgPercentage = Math.round((tasksPercentage + hoursPercentage) / 2);
          elements.progressPercentage.textContent = `${Math.min(100, avgPercentage)}%`;
        }
      }
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
