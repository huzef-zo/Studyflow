/**
 * StudyFlow - Goals Module
 * Fully aligned with Stitch design system.
 */

const Goals = (function() {
  'use strict';

  let elements = {};

  function initElements() {
    elements = {
      weekSubtitle: document.getElementById('week-number-subtitle'),
      editGoalsBtn: document.getElementById('edit-goals-btn'),
      weekStrip: document.getElementById('week-strip-container'),
      tasksGoalValue: document.getElementById('tasks-goal-value'),
      tasksGoalMax: document.getElementById('tasks-goal-max'),
      tasksDonutFill: document.getElementById('tasks-donut-fill'),
      tasksPercentLabel: document.getElementById('tasks-percent-label'),
      hoursGoalValue: document.getElementById('hours-goal-value'),
      hoursDonutFill: document.getElementById('hours-donut-fill'),
      hoursPercentLabel: document.getElementById('hours-percent-label'),
      dailyProgressContainer: document.getElementById('daily-progress-container'),
      avgDailyPct: document.getElementById('avg-daily-pct'),
      streakTitle: document.getElementById('streak-card-title'),
      freezeCountLabel: document.getElementById('freeze-count-label'),
      motivationalCopy: document.getElementById('motivational-copy'),
      streakDotsContainer: document.getElementById('streak-dots-container')
    };
  }

  function updateCircle(element, percentage) {
    if (!element) return;
    const circumference = 188.5; // 2 * Math.PI * 30
    const offset = circumference - (percentage / 100) * circumference;
    element.setAttribute('stroke-dasharray', circumference);
    element.setAttribute('stroke-dashoffset', Math.max(0, offset));
  }

  function renderGoalsDisplay() {
    const goals = Storage.getGoals ? Storage.getGoals() : {};
    const stats = Storage.getStats ? Storage.getStats() : { streak: 0 };
    const currentWeek = Storage.getWeekNumber ? Storage.getWeekNumber(new Date()) : 1;

    if (elements.weekSubtitle) {
      elements.weekSubtitle.textContent = `Week ${currentWeek}`;
    }

    // Tasks Target
    const currentTasks = Number.isFinite(Number(goals.current_tasks)) ? Number(goals.current_tasks) : 0;
    const weeklyTasksTarget = Number.isFinite(Number(goals.weekly_tasks)) ? Number(goals.weekly_tasks) : 10;
    const tasksPct = weeklyTasksTarget > 0 ? Math.min(100, Math.round((currentTasks / weeklyTasksTarget) * 100)) : 0;

    if (elements.tasksGoalValue) elements.tasksGoalValue.textContent = currentTasks;
    if (elements.tasksGoalMax) elements.tasksGoalMax.textContent = weeklyTasksTarget;
    if (elements.tasksDonutFill) updateCircle(elements.tasksDonutFill, tasksPct);
    if (elements.tasksPercentLabel) elements.tasksPercentLabel.textContent = `${tasksPct}% target reached`;

    // Hours Target
    const rawHours = Number.isFinite(Number(goals.current_hours)) ? Number(goals.current_hours) : 0;
    const currentHours = Math.round(rawHours * 10) / 10;
    const weeklyHoursTarget = Number.isFinite(Number(goals.weekly_hours)) ? Number(goals.weekly_hours) : 20;
    const hoursPct = weeklyHoursTarget > 0 ? Math.min(100, Math.round((currentHours / weeklyHoursTarget) * 100)) : 0;

    if (elements.hoursGoalValue) elements.hoursGoalValue.textContent = currentHours;
    if (elements.hoursDonutFill) updateCircle(elements.hoursDonutFill, hoursPct);
    if (elements.hoursPercentLabel) elements.hoursPercentLabel.textContent = `${currentHours} of ${weeklyHoursTarget}h logged`;

    // Streak
    if (elements.streakTitle) elements.streakTitle.textContent = `${stats.streak || 0}-day streak`;
    if (elements.freezeCountLabel) elements.freezeCountLabel.textContent = `${goals.freezeCount || 0} freeze(s) left`;
  }

  function renderWeekStrip() {
    if (!elements.weekStrip) return;
    const weekStart = Storage.getWeekStart ? Storage.getWeekStart(new Date()) : new Date();
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const todayStr = Storage.formatDate(new Date());

    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = Storage.formatDate(d);
      const isToday = dateStr === todayStr;
      const dayNum = d.getDate();
      const sessions = Storage.getSessionsSince ? Storage.getSessionsSince(dateStr) : [];
      const hasWorked = sessions.some(s => s.completedAt && s.completedAt.slice(0, 10) === dateStr && s.type === 'work');

      if (isToday) {
        html += `
          <div class="flex flex-col items-center justify-center py-2 px-1.5 rounded-full w-10 text-center bg-primary-container text-on-primary-container shadow-md transition-transform scale-105">
            <span class="font-label-sm text-[10px] font-bold uppercase tracking-wider opacity-90">${dayNames[i]}</span>
            <span class="font-headline-sm text-[14px] font-bold mt-0.5">${dayNum}</span>
            <div class="w-1.5 h-1.5 rounded-full bg-on-primary-container mt-1"></div>
          </div>
        `;
      } else {
        html += `
          <div class="flex flex-col items-center justify-center py-2 px-1.5 rounded-full w-10 text-center transition-all bg-surface-container-lowest/60">
            <span class="font-label-sm text-[11px] text-text-secondary font-medium">${dayNames[i]}</span>
            <span class="font-headline-sm text-[13px] text-text-primary font-semibold mt-0.5">${dayNum}</span>
            ${hasWorked ? '<span class="material-symbols-outlined text-[12px] text-primary-container mt-1">check</span>' : '<div class="w-1 h-1 rounded-full bg-surface-variant mt-1.5"></div>'}
          </div>
        `;
      }
    }

    elements.weekStrip.innerHTML = html;
  }

  function renderDailyProgress() {
    if (!elements.dailyProgressContainer) return;

    const weekStart = Storage.getWeekStart ? Storage.getWeekStart(new Date()) : new Date();
    const weekStartStr = Storage.formatDate(weekStart);
    const tasks = Storage.getTasks ? Storage.getTasks() : [];
    const sessions = Storage.getSessionsSince ? Storage.getSessionsSince(weekStartStr) : [];
    const goals = Storage.getGoals ? Storage.getGoals() : {};
    const todayStr = Storage.formatDate(new Date());

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dailyData = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = Storage.formatDate(d);
      dailyData[dateStr] = {
        dateStr,
        dayNum: d.getDate(),
        dayLabel: dayLabels[i],
        isWeekend: i >= 5,
        isToday: dateStr === todayStr,
        isFuture: d > new Date(),
        completedTasks: 0,
        workMinutes: 0
      };
    }

    tasks.forEach(t => {
      if (t.completed && t.completedAt) {
        const dStr = t.completedAt.slice(0, 10);
        if (dailyData[dStr]) dailyData[dStr].completedTasks++;
      }
    });

    sessions.forEach(s => {
      if (s.type === 'work' && s.completedAt) {
        const dStr = s.completedAt.slice(0, 10);
        if (dailyData[dStr]) dailyData[dStr].workMinutes += (s.duration || 0);
      }
    });

    let totalPctSum = 0;
    const CircumferenceDay = 87.96; // 2 * Math.PI * 14

    const html = Object.keys(dailyData).map(dateStr => {
      const day = dailyData[dateStr];
      const taskTarget = day.isWeekend ? (goals.weekend_daily_tasks || 1) : (goals.daily_tasks || 2);
      const hourTarget = day.isWeekend ? (goals.weekend_daily_hours || 1.5) : (goals.daily_hours || 3);
      const minuteTarget = hourTarget * 60;

      const tPct = taskTarget > 0 ? Math.min(100, (day.completedTasks / taskTarget) * 100) : 0;
      const mPct = minuteTarget > 0 ? Math.min(100, (day.workMinutes / minuteTarget) * 100) : 0;
      const avgPct = day.isFuture ? 0 : Math.round((tPct + mPct) / 2);
      totalPctSum += avgPct;

      const dashoffset = CircumferenceDay - (avgPct / 100) * CircumferenceDay;

      return `
        <div class="flex-shrink-0 w-[68px] ${day.isToday ? 'bg-surface-glass-active border border-primary-container/30' : 'bg-surface-glass'} backdrop-blur-lg rounded-2xl p-2.5 flex flex-col items-center text-center shadow-sm">
          <span class="font-label-sm text-[11px] ${day.isToday ? 'text-primary-container font-semibold' : 'text-text-secondary'}">${day.dayLabel}</span>
          <span class="font-headline-sm text-[13px] font-semibold text-text-primary mb-2">${day.dayNum}</span>
          <div class="relative w-9 h-9 flex items-center justify-center my-1">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle class="text-surface-container-high" cx="18" cy="18" fill="none" r="14" stroke="currentColor" stroke-width="3"></circle>
              <circle class="text-primary-container" cx="18" cy="18" fill="none" r="14" stroke="currentColor" stroke-dasharray="87.96" stroke-dashoffset="${Math.max(0, dashoffset)}" stroke-linecap="round" stroke-width="3"></circle>
            </svg>
            ${avgPct >= 100 ? '<span class="material-symbols-outlined text-[13px] text-primary-container absolute">check</span>' : `<span class="font-label-sm text-[9px] text-text-secondary absolute">${day.isFuture ? '-' : avgPct + '%'}</span>`}
          </div>
          <span class="font-label-sm text-[11px] ${day.isToday ? 'text-primary-container font-semibold' : 'text-text-primary'} font-medium mt-1">${day.isFuture ? '-' : avgPct + '%'}</span>
        </div>
      `;
    }).join('');

    elements.dailyProgressContainer.innerHTML = html;
    if (elements.avgDailyPct) {
      elements.avgDailyPct.textContent = `Avg ${Math.round(totalPctSum / 7)}%`;
    }
  }

  function renderStreakDots() {
    if (!elements.streakDotsContainer) return;
    const weekStart = Storage.getWeekStart ? Storage.getWeekStart(new Date()) : new Date();
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const todayStr = Storage.formatDate(new Date());

    let html = '<div class="flex items-center gap-2 w-full justify-between">';
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = Storage.formatDate(d);
      const isPastOrToday = dateStr <= todayStr;
      const sessions = Storage.getSessionsSince ? Storage.getSessionsSince(dateStr) : [];
      const hasWorked = sessions.some(s => s.completedAt && s.completedAt.slice(0, 10) === dateStr && s.type === 'work');

      html += `
        <div class="flex flex-col items-center gap-1">
          <div class="w-7 h-7 rounded-full ${hasWorked ? 'bg-primary-container text-surface-base' : 'bg-surface-container text-text-secondary'} flex items-center justify-center shadow-sm">
            ${hasWorked ? '<span class="material-symbols-outlined text-[14px] font-bold">check</span>' : '<span class="material-symbols-outlined text-[13px] text-primary-container">local_fire_department</span>'}
          </div>
          <span class="font-label-sm text-[10px] text-text-secondary">${dayLabels[i]}</span>
        </div>
      `;
      if (i < 6) {
        html += `<div class="h-0.5 flex-1 ${hasWorked ? 'bg-primary-container/40' : 'bg-surface-container'} mb-3"></div>`;
      }
    }
    html += '</div>';

    elements.streakDotsContainer.innerHTML = html;
  }

  function openEditGoalsModal() {
    const goals = Storage.getGoals ? Storage.getGoals() : {};

    const content = `
      <form id="goals-form" class="flex flex-col gap-3">
        <h4 class="font-headline-sm text-headline-sm text-text-primary mb-1">Weekly Goals</h4>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="weekly-tasks">Weekly Task Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="weekly-tasks" name="weekly_tasks" min="1" max="100" value="${goals.weekly_tasks || 10}" required>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="weekly-hours">Weekly Study Hours Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="weekly-hours" name="weekly_hours" min="1" max="168" step="0.5" value="${goals.weekly_hours || 20}" required>
        </div>

        <h4 class="font-headline-sm text-headline-sm text-text-primary mb-1 mt-2">Daily Goals</h4>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="daily-tasks">Daily Task Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="daily-tasks" name="daily_tasks" min="1" max="50" value="${goals.daily_tasks || 2}" required>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="daily-hours">Daily Study Hours Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="daily-hours" name="daily_hours" min="1" max="24" step="0.5" value="${goals.daily_hours || 3}" required>
        </div>

        <h4 class="font-headline-sm text-headline-sm text-text-primary mb-1 mt-2">Weekend Goals</h4>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="weekend-daily-tasks">Weekend Task Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="weekend-daily-tasks" name="weekend_daily_tasks" min="1" max="50" value="${goals.weekend_daily_tasks || 1}" required>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="weekend-daily-hours">Weekend Study Hours Goal</label>
          <input type="number" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container" id="weekend-daily-hours" name="weekend_daily_hours" min="1" max="24" step="0.5" value="${goals.weekend_daily_hours || 1.5}" required>
        </div>
      </form>
    `;

    const modal = App.createModal({
      id: 'goals-modal',
      title: 'Set Weekly Goals',
      content,
      footer: `
        <button type="button" class="px-4 py-2 rounded-full font-label-md text-text-secondary hover:text-text-primary transition-colors" data-action="cancel">Cancel</button>
        <button type="submit" form="goals-form" class="px-4 py-2 rounded-full font-label-md bg-primary-container text-surface-base hover:bg-accent-hover font-semibold transition-colors">Save Goals</button>
      `
    });

    const form = modal.querySelector('#goals-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      Storage.updateGoals({
        weekly_tasks: parseInt(formData.get('weekly_tasks'), 10),
        weekly_hours: parseFloat(formData.get('weekly_hours')),
        daily_tasks: parseInt(formData.get('daily_tasks'), 10),
        daily_hours: parseFloat(formData.get('daily_hours')),
        weekend_daily_tasks: parseInt(formData.get('weekend_daily_tasks'), 10),
        weekend_daily_hours: parseFloat(formData.get('weekend_daily_hours'))
      });

      App.showToast('Goals updated!', 'success');
      App.closeModal(modal);
      renderGoalsDisplay();
      renderDailyProgress();
    });

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      App.closeModal(modal);
    });

    App.openModal(modal);
  }

  function setupEventListeners() {
    if (elements.editGoalsBtn) {
      elements.editGoalsBtn.onclick = openEditGoalsModal;
    }
    window.addEventListener('studyflow_taskDataChanged', () => {
      renderGoalsDisplay();
      renderWeekStrip();
      renderDailyProgress();
      renderStreakDots();
    });
  }

  function init() {
    initElements();
    setupEventListeners();
    renderGoalsDisplay();
    renderWeekStrip();
    renderDailyProgress();
    renderStreakDots();
  }

  return { init, renderGoalsDisplay, renderWeekStrip, renderDailyProgress, openEditGoalsModal };
})();

window.Goals = Goals;
