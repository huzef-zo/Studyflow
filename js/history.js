/**
 * StudyFlow - History / Analytics Module
 * Fully aligned with Stitch design system.
 */

const History = (function() {
  'use strict';

  let elements = {};
  let statsPeriodDays = 7; // default 7 days

  function initElements() {
    elements = {
      totalCompletedTasks: document.getElementById('total-completed-tasks'),
      totalStudyHours: document.getElementById('total-study-hours'),
      allTimeStreak: document.getElementById('all-time-streak'),
      completionRate: document.getElementById('completion-rate'),
      productiveDay: document.getElementById('productive-day'),
      dailyAvgLabel: document.getElementById('daily-avg-label'),
      activityChartContainer: document.getElementById('activity-chart-container'),
      masteryOverview: document.getElementById('mastery-overview'),
      studyHistoryList: document.getElementById('study-history-list'),
      optimalWindowCard: document.getElementById('optimal-window-card'),
      optimalWindowText: document.getElementById('optimal-window-text')
    };
  }

  function getCutoffDate() {
    if (!statsPeriodDays) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (statsPeriodDays - 1));
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  }

  function getFilteredSessions() {
    const cutoff = getCutoffDate();
    if (!cutoff) return Storage.getSessions ? Storage.getSessions() : [];
    return Storage.getSessionsSince ? Storage.getSessionsSince(Storage.formatDate(cutoff)) : [];
  }

  function getFilteredTasks() {
    const tasks = Storage.loadData ? Storage.loadData(Storage.KEYS.TASKS, Storage.DEFAULTS.tasks) : [];
    const cutoff = getCutoffDate();
    if (!cutoff) return tasks;

    const startStr = Storage.formatDate(cutoff);
    const endStr = Storage.formatDate(new Date());

    return tasks.filter(t => {
      const compDate = t.completedAt ? t.completedAt.slice(0, 10) : null;
      const dueDate = t.dueDate;
      return (compDate && compDate >= startStr && compDate <= endStr) || (dueDate && dueDate >= startStr && dueDate <= endStr);
    });
  }

  function updateSummaryStats() {
    const filteredTasks = getFilteredTasks();
    const filteredSessions = getFilteredSessions();
    const workSessions = filteredSessions.filter(s => s.type === 'work');
    const stats = Storage.getStats ? Storage.getStats() : { streak: 0, bestStreak: 0 };

    const completedTasksCount = filteredTasks.filter(t => t.completed).length;
    const studyMinutes = workSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    const studyHours = (studyMinutes / 60).toFixed(1);

    if (elements.totalCompletedTasks) elements.totalCompletedTasks.textContent = completedTasksCount;
    if (elements.totalStudyHours) elements.totalStudyHours.textContent = `${studyHours}h`;
    if (elements.allTimeStreak) elements.allTimeStreak.textContent = stats.bestStreak || stats.streak || 0;

    const rate = filteredTasks.length > 0 ? Math.round((completedTasksCount / filteredTasks.length) * 100) : 0;
    if (elements.completionRate) elements.completionRate.textContent = `${rate}%`;

    const streakDelta = document.getElementById('streak-delta-label');
    if (streakDelta) {
      if (stats.streak > 0 && stats.streak >= stats.bestStreak) {
        streakDelta.textContent = 'Personal record';
      } else {
        streakDelta.textContent = `Best: ${stats.bestStreak}d`;
      }
    }

    // Daily Avg
    const days = statsPeriodDays || 30;
    const avgHours = (studyMinutes / 60 / days).toFixed(1);
    if (elements.dailyAvgLabel) elements.dailyAvgLabel.textContent = `${avgHours} hrs`;

    // Productive Day calculation
    if (elements.productiveDay) {
      const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      workSessions.forEach(s => {
        if (s.completedAt) {
          const d = new Date(s.completedAt);
          if (!isNaN(d.getTime())) dayCounts[d.getDay()] += (s.duration || 0);
        }
      });
      let maxIdx = 0, maxVal = 0;
      dayCounts.forEach((cnt, idx) => {
        if (cnt > maxVal) { maxVal = cnt; maxIdx = idx; }
      });
      elements.productiveDay.textContent = maxVal > 0 ? dayNames[maxIdx] : 'N/A';
    }

    // Optimal Deep Work Window
    if (elements.optimalWindowCard && elements.optimalWindowText) {
      if (workSessions.length >= 5) {
        const hourBins = new Array(24).fill(0);
        workSessions.forEach(s => {
          if (s.completedAt) {
            const d = new Date(s.completedAt);
            if (!isNaN(d.getTime())) hourBins[d.getHours()] += (s.duration || 0);
          }
        });
        let peakHour = 9, maxMins = 0;
        hourBins.forEach((mins, h) => {
          if (mins > maxMins) { maxMins = mins; peakHour = h; }
        });
        const startAmPm = peakHour >= 12 ? `${peakHour === 12 ? 12 : peakHour - 12}:00 PM` : `${peakHour === 0 ? 12 : peakHour}:00 AM`;
        const endHour = (peakHour + 2) % 24;
        const endAmPm = endHour >= 12 ? `${endHour === 12 ? 12 : endHour - 12}:00 PM` : `${endHour === 0 ? 12 : endHour}:00 AM`;

        elements.optimalWindowText.textContent = `Your peak retention happens between ${startAmPm} – ${endAmPm}`;
        elements.optimalWindowCard.classList.remove('hidden');
        elements.optimalWindowCard.classList.add('flex');
      } else {
        elements.optimalWindowCard.classList.add('hidden');
        elements.optimalWindowCard.classList.remove('flex');
      }
    }
  }

  function renderActivityChart() {
    if (!elements.activityChartContainer) return;

    const daysCount = statsPeriodDays || 30;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - (daysCount - 1));

    const workSessions = (Storage.getSessionsSince ? Storage.getSessionsSince(Storage.formatDate(cutoffDate)) : []).filter(s => s.type === 'work');

    const dailyMinutes = {};
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(cutoffDate);
      d.setDate(d.getDate() + i);
      const dateStr = Storage.formatDate(d);
      dailyMinutes[dateStr] = { date: d, minutes: 0 };
    }

    workSessions.forEach(s => {
      if (s.completedAt) {
        const dateStr = s.completedAt.slice(0, 10);
        if (dailyMinutes[dateStr]) {
          dailyMinutes[dateStr].minutes += (s.duration || 0);
        }
      }
    });

    const dateKeys = Object.keys(dailyMinutes);
    let maxMins = 0;
    dateKeys.forEach(k => {
      if (dailyMinutes[k].minutes > maxMins) maxMins = dailyMinutes[k].minutes;
    });
    if (maxMins === 0) maxMins = 120; // default 2h max scale

    const width = 320, height = 140;
    const paddingX = 15, paddingY = 20;
    const chartW = width - (paddingX * 2);
    const chartH = height - (paddingY * 2);

    const points = dateKeys.map((k, idx) => {
      const x = paddingX + (idx * (chartW / Math.max(1, dateKeys.length - 1)));
      const mins = dailyMinutes[k].minutes;
      const y = height - paddingY - ((mins / maxMins) * chartH);
      return { x, y, mins, dateStr: k, date: dailyMinutes[k].date };
    });

    // Build curve path
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const last = points[points.length - 1];
    const areaD = `${pathD} L ${last.x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

    // Find peak point
    let peakPt = points[0];
    points.forEach(p => {
      if (p.mins > peakPt.mins) peakPt = p;
    });

    const dayLabels = daysCount === 7
      ? points.map(p => p.date.toLocaleDateString('en-US', { weekday: 'short' }))
      : [points[0].dateStr.slice(5), points[Math.floor(points.length / 2)].dateStr.slice(5), points[points.length - 1].dateStr.slice(5)];

    elements.activityChartContainer.innerHTML = `
      ${peakPt.mins > 0 ? `
        <div class="absolute -top-1 px-2.5 py-0.5 rounded-full bg-surface-container-highest shadow-lg flex items-center gap-1 z-10 font-label-sm text-label-sm text-primary-container font-semibold" style="left: ${Math.min(80, Math.max(20, (peakPt.x / width) * 100))}%; transform: translateX(-50%);">
          Peak: ${(peakPt.mins / 60).toFixed(1)}h
        </div>
      ` : ''}
      <svg class="w-full h-full overflow-visible" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="blueGlowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#5b9bf0" stop-opacity="0.32"/>
            <stop offset="65%" stop-color="#5b9bf0" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#5b9bf0" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="0" y1="20" x2="${width}" y2="20" stroke="rgba(255, 255, 255, 0.05)" stroke-dasharray="3 3" stroke-width="1"/>
        <line x1="0" y1="65" x2="${width}" y2="65" stroke="rgba(255, 255, 255, 0.05)" stroke-dasharray="3 3" stroke-width="1"/>
        <line x1="0" y1="110" x2="${width}" y2="110" stroke="rgba(255, 255, 255, 0.05)" stroke-dasharray="3 3" stroke-width="1"/>

        <path d="${areaD}" fill="url(#blueGlowGradient)"/>
        <path d="${pathD}" fill="none" stroke="#5b9bf0" stroke-width="2.5" stroke-linecap="round"/>

        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="${p === peakPt && p.mins > 0 ? 4.5 : 2}" fill="#5b9bf0" stroke="#090D12" stroke-width="1.5">
            <title>${p.dateStr}: ${(p.mins / 60).toFixed(1)} hrs</title>
          </circle>
        `).join('')}
      </svg>
      <div class="flex justify-between items-center px-1 font-label-sm text-label-sm text-text-secondary select-none mt-1">
        ${dayLabels.map(l => `<span>${App.escapeHtml(l)}</span>`).join('')}
      </div>
    `;
  }

  function updateMasteryOverview() {
    if (!elements.masteryOverview) return;

    const stats = Storage.getSubjectMasteryStats ? Storage.getSubjectMasteryStats() : [];
    if (stats.length === 0) {
      elements.masteryOverview.innerHTML = App.createEmptyStateHtml({
        title: 'No Subjects Configured',
        text: 'Set up subjects in settings to track your focus distribution.',
        icon: 'pie_chart'
      });
      return;
    }

    const filteredSessions = getFilteredSessions().filter(s => s.type === 'work');
    const totalMins = filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0);

    const subjectMins = {};
    // OPTIMIZATION: Query raw tasks once and construct a Map for O(1) lookups instead of calling Storage.getTaskById(s.taskId) inside session loop.
    const rawTasks = Storage.loadData ? Storage.loadData(Storage.KEYS.TASKS, Storage.DEFAULTS.tasks) : [];
    const taskMap = new Map();
    for (let i = 0; i < rawTasks.length; i++) {
      taskMap.set(rawTasks[i].id, rawTasks[i]);
    }

    filteredSessions.forEach(s => {
      const task = s.taskId ? taskMap.get(s.taskId) : null;
      const subName = task ? task.subject : 'Other';
      subjectMins[subName] = (subjectMins[subName] || 0) + (s.duration || 0);
    });

    elements.masteryOverview.innerHTML = stats.map(s => {
      const mins = subjectMins[s.name] || 0;
      const hours = (mins / 60).toFixed(1);
      const sharePct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : s.percentage;
      const safeColor = App.isValidHexColor(s.color) ? s.color : '#2563EB';

      return `
        <div class="flex flex-col gap-1.5 p-2 rounded bg-surface-container-low/60 hover:bg-surface-container-high transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" style="background-color: ${App.escapeHtml(safeColor)};"></span>
              <span class="font-body-md text-body-md text-text-primary font-medium">${App.escapeHtml(s.name)}</span>
            </div>
            <span class="font-label-md text-label-md text-text-primary font-semibold">${sharePct}%</span>
          </div>
          <div class="flex items-center justify-between text-text-secondary font-label-sm text-[12px] mb-0.5">
            <span>${hours}h logged</span>
            <span class="text-primary-container">${s.completed}/${s.total} tasks</span>
          </div>
          <div class="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${sharePct}%; background-color: ${App.escapeHtml(safeColor)};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderStudyHistory() {
    if (!elements.studyHistoryList) return;

    const filteredSessions = getFilteredSessions().filter(s => s.type === 'work' && s.completedAt);
    const sorted = [...filteredSessions].sort((a, b) => {
      const aVal = a.completedAt || '';
      const bVal = b.completedAt || '';
      return bVal < aVal ? -1 : (bVal > aVal ? 1 : 0);
    });

    if (sorted.length === 0) {
      elements.studyHistoryList.innerHTML = App.createEmptyStateHtml({
        title: 'No Focus Sessions',
        text: 'Completed focus sessions will appear in your timeline.',
        icon: 'timer'
      });
      return;
    }

    // OPTIMIZATION: Build a Map for O(1) task lookups and use fast Date component getters instead of expensive toLocaleTimeString / toLocaleDateString Intl calls.
    const rawTasks = Storage.loadData ? Storage.loadData(Storage.KEYS.TASKS, Storage.DEFAULTS.tasks) : [];
    const taskMap = new Map();
    for (let i = 0; i < rawTasks.length; i++) {
      taskMap.set(rawTasks[i].id, rawTasks[i]);
    }
    const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    elements.studyHistoryList.innerHTML = sorted.map(s => {
      const task = s.taskId ? taskMap.get(s.taskId) : null;
      const title = task ? task.title : 'General Focus';
      const subject = task ? task.subject : 'General';
      let timeStr = 'N/A', dateStr = '';
      if (s.completedAt) {
        const d = new Date(s.completedAt);
        if (!isNaN(d.getTime())) {
          let hours = d.getHours();
          const minutes = d.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours = hours % 12 || 12;
          timeStr = hours + ':' + (minutes < 10 ? '0' + minutes : minutes) + ' ' + ampm;
          dateStr = MONTH_NAMES_SHORT[d.getMonth()] + ' ' + d.getDate();
        }
      }

      return `
        <div class="p-3.5 rounded-2xl bg-surface-container-low/70 flex items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-9 h-9 rounded-full bg-primary-container/20 text-primary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-[18px]">timelapse</span>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-label-md text-label-md text-text-primary truncate">${App.escapeHtml(title)}</span>
              <span class="font-label-sm text-[11px] text-text-secondary">${App.escapeHtml(subject)} · ${s.duration || 25} mins</span>
            </div>
          </div>
          <div class="flex flex-col items-end shrink-0 text-right">
            <span class="font-label-sm text-label-sm text-text-primary font-medium">${App.escapeHtml(timeStr)}</span>
            <span class="font-label-sm text-[11px] text-text-muted">${App.escapeHtml(dateStr)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function setupTimeframeTabs() {
    const tabs = [
      { id: 'tab-7d', period: 7 },
      { id: 'tab-30d', period: 30 },
      { id: 'tab-all', period: null }
    ];

    tabs.forEach(t => {
      const btn = document.getElementById(t.id);
      if (btn) {
        btn.addEventListener('click', () => {
          tabs.forEach(other => {
            const b = document.getElementById(other.id);
            if (b) {
              b.className = 'timeframe-btn flex-1 py-1.5 rounded-full font-label-md text-label-md text-text-secondary hover:text-text-primary transition-all text-center';
              b.setAttribute('aria-selected', 'false');
            }
          });
          btn.className = 'timeframe-btn flex-1 py-1.5 rounded-full font-label-md text-label-md text-surface-base bg-primary-container font-semibold transition-all text-center';
          btn.setAttribute('aria-selected', 'true');

          statsPeriodDays = t.period;
          renderAnalytics();
        });
      }
    });
  }

  function renderAnalytics() {
    updateSummaryStats();
    renderActivityChart();
    updateMasteryOverview();
    renderStudyHistory();
  }

  function init() {
    initElements();
    setupTimeframeTabs();
    renderAnalytics();

    window.addEventListener('studyflow_taskDataChanged', renderAnalytics);
  }

  return { init, renderAnalytics };
})();

window.History = History;
