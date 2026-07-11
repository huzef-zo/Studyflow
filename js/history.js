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
      progressPercentage: document.getElementById('progress-percentage'),
      reflectionsLog: document.getElementById('reflections-log')
    };
  }

  function init() {
    initElements();

    document.querySelectorAll('[data-period]').forEach(tab => {
      const toggleFn = (e) => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        document.querySelectorAll('[data-period]').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        statsPeriodDays = tab.dataset.period === 'all' ? null : parseInt(tab.dataset.period);
        updateSummaryStats();
        renderFrequencyGraph();
        updateMasteryOverview();
      };
      tab.addEventListener('click', toggleFn);
      tab.addEventListener('keydown', toggleFn);
    });

    updateSummaryStats();
    renderFrequencyGraph();
    updateMasteryOverview();
    updateWeeklyProgress();
    renderReflections();
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
    if (!cutoff) return Storage.getSessions();
    // OPTIMIZATION: Use binary search via getSessionsSince for O(log N) retrieval
    // We pass the formatted date string to ensure consistency with other Storage calls
    return Storage.getSessionsSince(Storage.formatDate(cutoff));
  }

  function getFilteredTasks() {
    const tasks = Storage.getTasks();
    const cutoff = getCutoffDate();
    if (!cutoff) {
      // For "All Time", we need a reference start date for repeating tasks
      const user = Storage.getUser();
      const start = user && user.created_at ? new Date(user.created_at) : new Date();
      start.setHours(0, 0, 0, 0);
      return expandTaskOccurrences(tasks, start, new Date());
    }
    const today = new Date();
    return expandTaskOccurrences(tasks, cutoff, today);
  }

  /**
   * Expands repeating tasks into individual occurrences for the given period.
   * OPTIMIZATION: Uses a single-pass date loop and a day-of-week lookup for repeating tasks.
   * This reduces complexity from O(Tasks * Days) to O(Days + Total Occurrences).
   */
  function expandTaskOccurrences(tasks, startDate, endDate) {
    const occurrences = [];
    const startStr = Storage.formatDate(startDate);
    const endStr = Storage.formatDate(endDate);

    // Group repeating tasks by day of week for faster lookup
    const repeatingByDay = [[], [], [], [], [], [], []]; // 0=Sun, 1=Mon...

    tasks.forEach(t => {
      if (t.type !== 'repeating') {
        const completedAt = t.completedAt ? Storage.formatDate(new Date(t.completedAt)) : null;
        const dueDate = t.dueDate;

        // Include if completed in period OR due in period (and not completed before)
        const completedInPeriod = completedAt && completedAt >= startStr && completedAt <= endStr;
        const dueInPeriod = dueDate && dueDate >= startStr && dueDate <= endStr;

        if (completedInPeriod || dueInPeriod) {
          occurrences.push(t);
        }
      } else if (t.repeatDays && t.repeatDays.length > 0) {
        t.repeatDays.forEach(day => {
          if (day >= 0 && day <= 6) repeatingByDay[day].push(t);
        });
      }
    });

    // Single pass through the date range to expand repeating tasks
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      const scheduledTasks = repeatingByDay[dayOfWeek];
      if (scheduledTasks.length > 0) {
        const dateStr = Storage.formatDate(cur);
        scheduledTasks.forEach(t => {
          occurrences.push({
            ...t,
            _occurrenceDate: dateStr
          });
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return occurrences;
  }

  function getCompletedTasksInPeriod() {
    const tasks = Storage.getTasks();
    const cutoff = getCutoffDate();
    const cutoffTime = cutoff ? cutoff.getTime() : 0;
    const cutoffStr = cutoff ? Storage.formatDate(cutoff) : null;

    // One-time tasks
    const completedOneTime = tasks.filter(t => {
      if (t.type === 'repeating') return false;
      if (!t.completed) return false;
      if (!cutoff) return true;
      // OPTIMIZATION: Use Date.parse() for numeric comparison instead of new Date()
      const compTime = typeof t.completedAt === 'number' ? t.completedAt : (t.completedAt ? Date.parse(t.completedAt) : 0);
      return compTime >= cutoffTime;
    }).map(t => ({ ...t, _date: t.completedAt }));

    // Repeating tasks
    const completedRepeating = [];
    const repeatingCompletions = Storage.getRepeatingCompletions();
    Object.keys(repeatingCompletions).forEach(key => {
      const dateStr = key.slice(-10);
      if (!cutoffStr || dateStr >= cutoffStr) {
        completedRepeating.push({ _date: dateStr });
      }
    });

    return [...completedOneTime, ...completedRepeating];
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
      const isWeekly = statsPeriodDays === 7;
      const activity = {}; // Key: day index (0-6) for weekly, date string for others
      const reusableDate = new Date();

      // Aggregate focus sessions (weighted by 15-min intervals)
      filteredSessions.forEach(s => {
        if (s.type === 'work' && s.completedAt) {
          // OPTIMIZATION: Use string slicing for date and reusableDate for getDay()
          let key;
          if (isWeekly) {
            reusableDate.setTime(typeof s.completedAt === 'number' ? s.completedAt : Date.parse(s.completedAt));
            key = reusableDate.getDay();
          } else {
            key = (typeof s.completedAt === 'string') ? s.completedAt.slice(0, 10) : Storage.formatDate(s.completedAt);
          }
          activity[key] = (activity[key] || 0) + Math.max(1, Math.round(s.duration / 15));
        }
      });

      // Aggregate task completions (weighted as 1 unit)
      completedTasksInPeriod.forEach(t => {
        if (t._date) {
          // OPTIMIZATION: Use string slicing for date and reusableDate for getDay()
          let key;
          if (isWeekly) {
            if (t._date.length === 10) {
              const d = Storage.parseLocalDate(t._date);
              key = d ? d.getDay() : 0;
            } else {
              reusableDate.setTime(typeof t._date === 'number' ? t._date : Date.parse(t._date));
              key = reusableDate.getDay();
            }
          } else {
            key = (typeof t._date === 'string') ? t._date.slice(0, 10) : Storage.formatDate(t._date);
          }
          activity[key] = (activity[key] || 0) + 1;
        }
      });

      let peakKey = null, maxVal = -1;
      Object.keys(activity).forEach(key => {
        if (activity[key] > maxVal) {
          maxVal = activity[key];
          peakKey = key;
        }
      });

      if (maxVal > 0 && peakKey !== null) {
        if (isWeekly) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          elements.productiveDay.textContent = dayNames[peakKey];
        } else {
          const date = new Date(peakKey + 'T00:00:00');
          const options = statsPeriodDays === 30
            ? { month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' };
          elements.productiveDay.textContent = date.toLocaleDateString('en-US', options);
        }
      } else {
        elements.productiveDay.textContent = 'N/A';
      }
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
      <a href="tasks.html?subject=${encodeURIComponent(subject.name)}" class="mastery-card u-no-underline">
        <div class="mastery-subject-name" title="${App.escapeHtml(subject.name)}">${App.escapeHtml(subject.name)}</div>
        <div class="mastery-progress-mini">
          <div class="mastery-progress-mini-fill" style="width:${subject.percentage}%;background-color:${App.escapeHtml(subject.color)};"></div>
        </div>
        <div class="mastery-stats"><span>${subject.percentage}%</span><span>${subject.completed}/${subject.total}</span></div>
      </a>
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
    const reusableDate = new Date(today);
    for (let i = 0; i < daysCount; i++) {
      // OPTIMIZATION: Use reusableDate and modify it
      reusableDate.setTime(today.getTime());
      reusableDate.setDate(today.getDate() - i);
      activityData[Storage.formatDate(reusableDate)] = { count: 0, notes: [] };
    }
    tasks.forEach(t => {
      if (t.type !== 'repeating' && t.completed && t.completedAt) {
        // OPTIMIZATION: Use string slicing for fast date extraction
        const dateStr = (typeof t.completedAt === 'string') ? t.completedAt.slice(0, 10) : Storage.formatDate(t.completedAt);
        if (activityData.hasOwnProperty(dateStr)) activityData[dateStr].count += 1;
      }
    });

    const repeatingCompletions = Storage.getRepeatingCompletions();
    Object.keys(repeatingCompletions).forEach(key => {
      const dateStr = key.slice(-10);
      if (activityData.hasOwnProperty(dateStr)) {
        activityData[dateStr].count += 1;
      }
    });

    sessions.forEach(s => {
      if (s.type === 'work' && s.completedAt) {
        // OPTIMIZATION: Use string slicing for fast date extraction
        const dateStr = (typeof s.completedAt === 'string') ? s.completedAt.slice(0, 10) : Storage.formatDate(s.completedAt);
        if (activityData.hasOwnProperty(dateStr)) {
          activityData[dateStr].count += Math.max(1, Math.round(s.duration / 15));
          if (s.notes) activityData[dateStr].notes.push(s.notes);
        }
      }
    });
    return activityData;
  }

  function renderReflections() {
    if (!elements.reflectionsLog) return;
    const reflections = Storage.loadData(Storage.KEYS.REFLECTIONS, Storage.DEFAULTS.reflections || []);

    if (reflections.length === 0) {
      elements.reflectionsLog.innerHTML = '<p class="text-secondary text-center">No tactical reflections recorded yet.</p>';
      return;
    }

    elements.reflectionsLog.innerHTML = reflections.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
      <div class="card" style="padding: 1rem; background: rgba(255,255,255,0.02);">
        <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 0.5rem;">
          ${Storage.formatDisplayDate(r.date)}
        </div>
        <div style="font-size: 0.875rem; color: white; line-height: 1.5;">
          ${App.escapeHtml(r.text)}
        </div>
      </div>
    `).join('');
  }

  function renderFrequencyGraph() {
    if (!elements.frequencyGraph) return;

    let daysCount = statsPeriodDays || 30;

    if (!statsPeriodDays) {
      const user = Storage.getUser();
      if (user && user.created_at) {
        const createdDate = new Date(user.created_at);
        createdDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today - createdDate);
        daysCount = Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
      }
    }

    const data = getActivityData(daysCount);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    let maxCount = 0;
    const days = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const date = new Date(today); date.setDate(today.getDate() - i);
      const dayData = data[Storage.formatDate(date)] || { count: 0, notes: [] };
      const count = dayData.count;
      if (count > maxCount) maxCount = count;
      days.push({ date, count, notes: dayData.notes });
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
      date: day.date,
      notes: day.notes
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
          ${points.map(p => {
            const notesStr = p.notes && p.notes.length > 0 ? `\n\nNotes:\n- ${p.notes.join('\n- ')}` : '';
            return `<circle cx="${p.x}" cy="${p.y}" r="4" class="graph-dot"><title>${p.count} activities on ${p.date.toLocaleDateString()}${App.escapeHtml(notesStr)}</title></circle>`;
          }).join('')}
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
