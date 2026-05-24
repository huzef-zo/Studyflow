/**
 * StudyFlow - Habit Tracker Module
 */

const Habits = (function() {
  'use strict';

  let elements = {};

  function initElements() {
    elements = {
      habitList: document.getElementById('habit-list'),
      addHabitBtn: document.getElementById('add-habit-btn')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    renderHabits();
  }

  function setupEventListeners() {
    elements.addHabitBtn?.addEventListener('click', openAddHabitModal);
  }

  function getWeekDays() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(today.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function renderHabits() {
    const habits = Storage.loadData(Storage.KEYS.HABITS, Storage.DEFAULTS.habits || []);
    const weekDays = getWeekDays();
    const todayStr = Storage.formatDate(new Date());

    if (habits.length === 0) {
      elements.habitList.innerHTML = App.createEmptyStateHtml({
        title: 'No Habits Tracked',
        text: 'Initiate daily consistency protocols to reinforce your learning discipline.',
        icon: 'target',
        actionText: 'Add First Habit',
        actionId: 'empty-add-habit'
      });
      document.getElementById('empty-add-habit')?.addEventListener('click', openAddHabitModal);
      return;
    }

    elements.habitList.innerHTML = habits.map(habit => {
      const currentStreak = calculateHabitStreak(habit);

      return `
        <div class="card habit-card animate-fade-in">
          <div class="habit-row">
            <div class="flex-1">
              <div style="font-weight: 700; color: white;">${App.escapeHtml(habit.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${currentStreak} day streak</div>
            </div>
            <div class="habit-days">
              ${weekDays.map(day => {
                const dateStr = Storage.formatDate(day);
                const isCompleted = habit.completions && habit.completions[dateStr];
                const isToday = dateStr === todayStr;
                const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()];

                return `<div class="habit-day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}"
                             onclick="Habits.toggleHabit('${habit.id}', '${dateStr}')">
                          ${dayLabel}
                        </div>`;
              }).join('')}
            </div>
            <button class="btn btn-ghost btn-icon btn-sm del-habit" style="margin-left: 1rem;" onclick="Habits.deleteHabit('${habit.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function calculateHabitStreak(habit) {
    if (!habit.completions) return 0;
    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const dateStr = Storage.formatDate(checkDate);
      if (habit.completions[dateStr]) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // If it's today and not yet completed, don't break the streak yet, check yesterday
        if (i === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }
    }
    return streak;
  }

  function openAddHabitModal() {
    const content = `
      <form id="add-habit-form">
        <div class="form-group">
          <label class="form-label">Habit Title</label>
          <input type="text" name="title" class="form-input" placeholder="e.g. Solve 5 LeetCode problems" required>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: 'New Habit Protocol',
      content,
      footer: `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-primary" id="save-habit">Initiate</button>`
    });

    modal.querySelector('#save-habit').onclick = () => {
      const form = modal.querySelector('#add-habit-form');
      const data = App.getFormData(form);
      if (data.title) {
        const habits = Storage.loadData(Storage.KEYS.HABITS, Storage.DEFAULTS.habits || []);
        habits.push({
          id: 'habit_' + Storage.generateId(),
          title: data.title,
          completions: {},
          createdAt: new Date().toISOString()
        });
        Storage.saveData(Storage.KEYS.HABITS, habits);
        App.closeModal();
        renderHabits();
      }
    };

    modal.querySelector('[data-action="cancel"]').onclick = () => App.closeModal();
    App.openModal(modal);
  }

  function toggleHabit(habitId, dateStr) {
    const habits = Storage.loadData(Storage.KEYS.HABITS, []);
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    if (!habit.completions) habit.completions = {};
    const isCompleting = !habit.completions[dateStr];

    if (isCompleting) {
      habit.completions[dateStr] = true;
      if (typeof Achievements !== 'undefined') {
        Achievements.awardXP(5, 'Habit Reinforcement');
      }
    } else {
      delete habit.completions[dateStr];
    }

    Storage.saveData(Storage.KEYS.HABITS, habits);
    renderHabits();
  }

  async function deleteHabit(id) {
    if (await App.confirm({ title: 'Purge Protocol?', message: 'This habit data will be erased.', confirmText: 'Purge', danger: true })) {
      const habits = Storage.loadData(Storage.KEYS.HABITS, []);
      Storage.saveData(Storage.KEYS.HABITS, habits.filter(h => h.id !== id));
      renderHabits();
    }
  }

  return { init, toggleHabit, deleteHabit };
})();

window.Habits = Habits;
