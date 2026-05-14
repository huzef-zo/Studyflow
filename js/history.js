/**
 * StudyFlow - History Module
 * FIX: Added empty-points guard in renderFrequencyGraph() to prevent crash for new users.
 */

const History = (function() {
  'use strict';

  let elements = {};
  let statsPeriodDays = null;  // null = all time, number = days

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

  function init() {
    initElements();

    document.querySelectorAll('[data-period]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-period]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        statsPeriodDays = tab.dataset.period === 'all' ? null : parseInt(tab.dataset.period);
        updateSummaryStats();
        renderFrequencyGraph();
        updateMasteryOverview();
      });
    });

    updateSummaryStats();
    renderFrequencyGraph();
    updateMasteryOverview();
    updateWeeklyProgress();
  }

  function getCutoffDate() {
    if (!statsPeriodDays) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (statsPeriodDays - 1));
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }

  function getFilteredSessions() {
    const sessions = Storage.getSessions();
    const cutoff = getCutoffDate();
    if (!cutoff) return sessions;
    return sessions.filter(s => s.completedAt && new Date(s.completedAt) >= cutoff);
  }

  function getFilteredTasks() {
    const tasks = Storage.getTasks();
    const cutoff = getCutoffDate();
    if (!cutoff) return tasks;
    return tasks.filter(t => {
      const completedAt = t.completedAt ? new Date(t.completedAt) : null;
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      return (completedAt && completedAt >= cutoff) || (dueDate && dueDate >= cutoff);
    });
  }

  function getCompletedTasksInPeriod() {
    const tasks = Storage.getTasks();
    const cutoff = getCutoffDate();
    if (!cutoff) return tasks.filter(t => t.completed);
    return tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt) >= cutoff);
  }

  function updateSummaryStats() {
    const filteredTasks = getFilteredTasks();
    const completedTasksInPeriod = getCompletedTasksInPeriod();
    const filteredSessions = getFilteredSessions();
    const stats = Storage.getStats();

    const periodCompletedCount = completedTasksInPeriod.length;
    const studyMinutes = filteredSessions.filter(s => s.type === 'work').reduce((total, s) => total + s.duration, 0);

    if (elements.totalCompletedTasks) elements.totalCompletedTasks.textContent = periodCompletedCount;
    if (elements.totalStudyHours) elements.totalStudyHours.textContent = Math.round(studyMinutes / 60) + 'h';
    if (elements.allTimeStreak) elements.allTimeStreak.textContent = stats.bestStreak;

    if (elements.completionRate) {
      const rate = filteredTasks.length > 0 ? Math.round((periodCompletedCount / filteredTasks.length) * 100) : 0;
      elements.completionRate.textContent = `${rate}%`;
    }

    if (elements.productiveDay) {
      const dayActivity = [0, 0, 0, 0, 0, 0, 0];
      // Include focus sessions (weighted by 15-min intervals)
      filteredSessions.forEach(s => {
        if (s.type === 'work' && s.completedAt) {
          dayActivity[new Date(s.completedAt).getDay()] += Math.max(1, Math.round(s.duration / 15));
        }
      });
      // Include task completions (weighted as 1 unit)
      completedTasksInPeriod.forEach(t => {
        if (t.completedAt) {
          dayActivity[new Date(t.completedAt).getDay()] += 1;
        }
      });

      let maxDay = 0, maxVal = -1;
      dayActivity.forEach((val, day) => { if (val > maxVal) { maxVal = val; maxDay = day; } });
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      elements.productiveDay.textContent = maxVal > 0 ? dayNames[maxDay] : 'N/A';
    }
  }

  function updateMasteryOverview() {
    if (!elements.masteryOverview) return;
    const stats = Storage.getSubjectMasteryStats();
    if (stats.length === 0) {
      elements.masteryOverview.innerHTML = `<div style="grid-column:1/-1">${App.createEmptyStateHtml({ title: 'No Subjects', text: 'Define your subjects in Settings to begin tracking mastery.', icon: 'settings', padding: '2rem' })}</div>`;
      return;
    }
    elements.masteryOverview.innerHTML = stats.map(subject => `
      <div class="mastery-card">
        <div class="mastery-subject-name" title="${App.escapeHtml(subject.name)}">${App.escapeHtml(subject.name)}</div>
        <div class="mastery-progress-mini">
          <div class="mastery-progress-mini-fill" style="width:${subject.percentage}%;background-color:${subject.color};"></div>
        </div>
        <div class="mastery-stats"><span>${subject.percentage}%</span><span>${subject.completed}/${subject.total}</span></div>
      </div>
    `).join('');
  }

  function updateWeeklyProgress() {
    const goals = Storage.getGoals();
    if (elements.tasksProgress) {
      const tasksPercentage = goals.weekly_tasks > 0 ? Math.round((goals.current_tasks / goals.weekly_tasks) * 100) : 0;
      elements.tasksProgress.innerHTML = App.createProgressBar(goals.current_tasks, goals.weekly_tasks, 'Tasks Completed');
      if (elements.hoursProgress) {
        const currentHours = Math.round(goals.current_hours * 10) / 10;
        elements.hoursProgress.innerHTML = App.createProgressBar(currentHours, goals.weekly_hours, 'Study Hours');
        if (elements.progressPercentage) {
          const hoursPercentage = goals.weekly_hours > 0 ? (goals.current_hours / goals.weekly_hours * 100) : 0;
          elements.progressPercentage.textContent = `${Math.min(100, Math.round((tasksPercentage + hoursPercentage) / 2))}%`;
        }
      }
    }
  }

  function getActivityData(daysCount) {
    const tasks = Storage.getTasks();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - daysCount);
    const sessions = Storage.getSessionsSince(Storage.formatDate(cutoffDate));

    const activityData = {};
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(today); date.setDate(date.getDate() - i);
      activityData[Storage.formatDate(date)] = 0;
    }
    tasks.forEach(t => {
      if (t.completed && t.completedAt) {
        const dateStr = Storage.formatDate(new Date(t.completedAt));
        if (activityData.hasOwnProperty(dateStr)) activityData[dateStr] += 1;
      }
    });
    sessions.forEach(s => {
      if (s.type === 'work' && s.completedAt) {
        const dateStr = Storage.formatDate(new Date(s.completedAt));
        if (activityData.hasOwnProperty(dateStr)) activityData[dateStr] += Math.max(1, Math.round(s.duration / 15));
      }
    });
    return activityData;
  }

  function renderFrequencyGraph() {
    if (!elements.frequencyGraph) return;

    const daysCount = statsPeriodDays || 30;
    const data = getActivityData(daysCount);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let maxCount = 0;
    const days = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(today); date.setDate(today.getDate() - i);
      const count = data[Storage.formatDate(date)] || 0;
      if (count > maxCount) maxCount = count;
      days.push({ date, count });
    }

    // FIX 5: Guard against empty or all-zero data — prevents crash on first launch
    if (days.length === 0) {
      elements.frequencyGraph.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0;font-size:14px;">No activity data yet. Complete tasks or focus sessions to see your timeline.</p>';
      return;
    }

    if (maxCount === 0) maxCount = 5;

    const width = 800, height = 200, paddingX = 40, paddingY = 30;
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2);

    const points = days.map((day, i) => ({
      x: paddingX + (i * (chartWidth / (daysCount - 1))),
      y: height - paddingY - (day.count / maxCount * chartHeight),
      count: day.count,
      date: day.date
    }));

    // Build smoothed line path
    let linePath = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      linePath += ` Q ${cpX},${p0.y} ${cpX},${(p0.y + p1.y) / 2} T ${p1.x},${p1.y}`;
    }

    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    elements.frequencyGraph.classList.add('line-graph-container');
    elements.frequencyGraph.innerHTML = `
      <div class="line-graph-wrapper">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="line-graph-svg">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.01"/>
            </linearGradient>
          </defs>
          <line x1="${paddingX}" y1="${paddingY}" x2="${width-paddingX}" y2="${paddingY}" class="graph-grid-line"/>
          <line x1="${paddingX}" y1="${paddingY+chartHeight/2}" x2="${width-paddingX}" y2="${paddingY+chartHeight/2}" class="graph-grid-line"/>
          <line x1="${paddingX}" y1="${height-paddingY}" x2="${width-paddingX}" y2="${height-paddingY}" class="graph-grid-line"/>
          <path d="${areaPath}" fill="url(#areaGradient)" class="graph-area-enhanced"/>
          <path d="${linePath}" class="graph-line" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" class="graph-dot"><title>${p.count} activities on ${p.date.toLocaleDateString()}</title></circle>`).join('')}
        </svg>
        <div class="graph-labels-x">
          ${days.filter((_, i) => i % 5 === 0 || i === daysCount - 1).map(day => {
            const index = days.indexOf(day);
            const left = (paddingX + (index * (chartWidth / (daysCount - 1)))) / width * 100;
            return `<span class="graph-label-x" style="left:${left}%">${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
          }).join('')}
        </div>
        <div class="graph-labels-y">
          <span class="graph-label-y" style="bottom:${paddingY/height*100}%">0</span>
          <span class="graph-label-y" style="bottom:50%">${Math.round(maxCount/2)}</span>
          <span class="graph-label-y" style="top:${paddingY/height*100}%">${maxCount}</span>
        </div>
      </div>`;
  }

  return { init };
})();

window.History = History;
