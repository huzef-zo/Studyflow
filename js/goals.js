/**
 * StudyFlow - Goals Module
 * Handles weekly goals tracking and display
 */

const Goals = (function() {
  'use strict';

  // DOM Elements
  let elements = {};

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      tasksGoalValue: document.getElementById('tasks-goal-value'),
      tasksGoalMax: document.getElementById('tasks-goal-max'),
      tasksProgressBar: document.getElementById('tasks-progress-bar'),
      tasksPercent: document.getElementById('tasks-percent'),
      hoursGoalValue: document.getElementById('hours-goal-value'),
      hoursGoalMax: document.getElementById('hours-goal-max'),
      hoursProgressBar: document.getElementById('hours-progress-bar'),
      hoursPercent: document.getElementById('hours-percent'),
      weekDates: document.getElementById('week-dates'),
      dailyProgress: document.getElementById('daily-progress'),
      editGoalsBtn: document.getElementById('edit-goals-btn'),
      tasksGoalInput: document.getElementById('tasks-goal-input'),
      hoursGoalInput: document.getElementById('hours-goal-input'),
      saveGoalsBtn: document.getElementById('save-goals-btn')
    };
  }

  /**
   * Update goals display
   */
  function updateGoalsDisplay() {
    const goals = Storage.getGoals();
    const stats = Storage.getStats();
    
    // Tasks goal progress
    const tasksPercent = goals.weekly_tasks > 0 
      ? Math.min(100, Math.round((goals.current_tasks / goals.weekly_tasks) * 100)) 
      : 0;
    
    if (elements.tasksGoalValue) {
      elements.tasksGoalValue.textContent = goals.current_tasks;
    }
    if (elements.tasksGoalMax) {
      elements.tasksGoalMax.textContent = goals.weekly_tasks;
    }
    if (elements.tasksProgressBar) {
      elements.tasksProgressBar.style.width = `${tasksPercent}%`;
      
      // Update color based on progress
      elements.tasksProgressBar.classList.remove('success', 'warning', 'danger');
      if (tasksPercent >= 100) {
        elements.tasksProgressBar.classList.add('success');
      } else if (tasksPercent >= 75) {
        elements.tasksProgressBar.classList.add('success');
      }
    }
    if (elements.tasksPercent) {
      elements.tasksPercent.textContent = `${tasksPercent}%`;
    }
    
    // Hours goal progress
    const currentHours = Math.round(goals.current_hours * 10) / 10;
    const hoursPercent = goals.weekly_hours > 0 
      ? Math.min(100, Math.round((currentHours / goals.weekly_hours) * 100)) 
      : 0;
    
    if (elements.hoursGoalValue) {
      elements.hoursGoalValue.textContent = currentHours.toFixed(1);
    }
    if (elements.hoursGoalMax) {
      elements.hoursGoalMax.textContent = goals.weekly_hours;
    }
    if (elements.hoursProgressBar) {
      elements.hoursProgressBar.style.width = `${hoursPercent}%`;
      
      // Update color based on progress
      elements.hoursProgressBar.classList.remove('success', 'warning', 'danger');
      if (hoursPercent >= 100) {
        elements.hoursProgressBar.classList.add('success');
      } else if (hoursPercent >= 75) {
        elements.hoursProgressBar.classList.add('success');
      }
    }
    if (elements.hoursPercent) {
      elements.hoursPercent.textContent = `${hoursPercent}%`;
    }
  }

  /**
   * Render week dates
   */
  function renderWeekDates() {
    if (!elements.weekDates) return;
    
    const weekStart = Storage.getWeekStart(new Date());
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = Storage.formatDate(new Date());
    
    let html = '';
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = Storage.formatDate(date);
      const isToday = dateStr === today;
      const dayNum = date.getDate();
      
      html += `
        <div class="week-day ${isToday ? 'today' : ''}">
          <div class="week-day-name">${days[i]}</div>
          <div class="week-day-number">${dayNum}</div>
        </div>
      `;
    }
    
    elements.weekDates.innerHTML = html;
  }

  /**
   * Render daily progress
   */
  function renderDailyProgress() {
    if (!elements.dailyProgress) return;
    
    const weekStart = Storage.getWeekStart(new Date());
    const tasks = Storage.getTasks();
    const sessions = Storage.getSessions();
    const goals = Storage.getGoals();
    const today = Storage.formatDate(new Date());
    
    // Organize data by day
    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = Storage.formatDate(date);
      dailyData[dateStr] = {
        tasks: 0,
        minutes: 0,
        isToday: dateStr === today,
        isFuture: date > new Date()
      };
    }
    
    // Count completed tasks per day
    tasks.forEach(task => {
      if (task.completed && task.completedAt) {
        const dateStr = Storage.formatDate(new Date(task.completedAt));
        if (dailyData[dateStr]) {
          dailyData[dateStr].tasks++;
        }
      }
    });
    
    // Count study minutes per day
    sessions.forEach(session => {
      if (session.type === 'work') {
        const dateStr = Storage.formatDate(new Date(session.completedAt));
        if (dailyData[dateStr]) {
          dailyData[dateStr].minutes += session.duration;
        }
      }
    });
    
    // Use goals from storage
    const dailyTaskTarget = goals.daily_tasks;
    const dailyMinuteTarget = goals.daily_hours * 60;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    let html = '';
    Object.keys(dailyData).forEach((dateStr, index) => {
      const day = dailyData[dateStr];
      
      // Task progress
      const taskPercent = dailyTaskTarget > 0 
        ? Math.min(100, (day.tasks / dailyTaskTarget) * 100) 
        : 0;
      
      // Hours progress
      const minutePercent = dailyMinuteTarget > 0 
        ? Math.min(100, (day.minutes / dailyMinuteTarget) * 100) 
        : 0;
      
      // Average progress
      const avgPercent = Math.round((taskPercent + minutePercent) / 2);
      
      let statusClass = '';
      if (avgPercent >= 100) {
        statusClass = 'complete';
      } else if (avgPercent >= 50) {
        statusClass = 'partial';
      }
      
      if (day.isFuture) {
        statusClass = 'future';
      }
      
      html += `
        <div class="daily-progress-item ${statusClass} ${day.isToday ? 'today' : ''}">
          <div class="daily-progress-day" style="margin-bottom: 1rem;">${days[index]}</div>
          <div class="daily-progress-circle">
            <svg viewBox="0 0 36 36">
              <circle 
                cx="18" 
                cy="18" 
                r="15.9155" 
                fill="none" 
                stroke="var(--bg-tertiary)" 
                stroke-width="3"
              />
              <circle 
                cx="18" 
                cy="18" 
                r="15.9155" 
                fill="none" 
                stroke="${avgPercent >= 100 ? 'var(--success)' : 'var(--primary)'}" 
                stroke-width="3"
                stroke-dasharray="${avgPercent}, 100"
                stroke-linecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span class="daily-progress-value">${day.isFuture ? '-' : avgPercent + '%'}</span>
          </div>
          <div class="daily-progress-label" style="line-height: 2; margin-top: 1rem;">
            ${day.tasks}/${dailyTaskTarget} tasks<br>
            ${Math.round(day.minutes / 60 * 10) / 10}h
          </div>
        </div>
      `;
    });
    
    elements.dailyProgress.innerHTML = html;
  }

  /**
   * Open edit goals modal
   */
  function openEditGoalsModal() {
    const goals = Storage.getGoals();
    
    const content = `
      <form id="goals-form">
        <h4 class="mb-sm">Weekly Goals</h4>
        <div class="form-group">
          <label class="form-label" for="weekly-tasks">Weekly Task Goal</label>
          <input type="number" 
                 class="form-input" 
                 id="weekly-tasks" 
                 name="weekly_tasks" 
                 min="1" 
                 max="100"
                 value="${goals.weekly_tasks}"
                 required>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="weekly-hours">Weekly Study Hours Goal</label>
          <input type="number" 
                 class="form-input" 
                 id="weekly-hours" 
                 name="weekly_hours" 
                 min="1" 
                 max="168"
                 step="0.5"
                 value="${goals.weekly_hours}"
                 required>
        </div>

        <h4 class="mb-sm mt-md">Daily Goals</h4>
        <div class="form-group">
          <label class="form-label" for="daily-tasks">Daily Task Goal</label>
          <input type="number"
                 class="form-input"
                 id="daily-tasks"
                 name="daily_tasks"
                 min="1"
                 max="50"
                 value="${goals.daily_tasks}"
                 required>
        </div>

        <div class="form-group">
          <label class="form-label" for="daily-hours">Daily Study Hours Goal</label>
          <input type="number"
                 class="form-input"
                 id="daily-hours"
                 name="daily_hours"
                 min="1"
                 max="24"
                 step="0.5"
                 value="${goals.daily_hours}"
                 required>
        </div>
      </form>
    `;
    
    const modal = App.createModal({
      id: 'goals-modal',
      title: 'Set Weekly Goals',
      content: content,
      footer: `
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button type="submit" form="goals-form" class="btn btn-primary">Save Goals</button>
      `
    });
    
    const form = modal.querySelector('#goals-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = App.getFormData(form);
      
      Storage.updateGoals({
        weekly_tasks: parseInt(data.weekly_tasks, 10),
        weekly_hours: parseFloat(data.weekly_hours),
        daily_tasks: parseInt(data.daily_tasks, 10),
        daily_hours: parseFloat(data.daily_hours)
      });
      
      App.showToast('Goals updated!', 'success');
      App.closeModal();
      updateGoalsDisplay();
      renderDailyProgress();
    });
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      App.closeModal(modal);
    });
    
    App.openModal(modal);
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    elements.editGoalsBtn?.addEventListener('click', openEditGoalsModal);
  }

  /**
   * Initialize Goals module
   */
  function init() {
    initElements();
    setupEventListeners();
    updateGoalsDisplay();
    renderWeekDates();
    renderDailyProgress();
  }

  // Public API
  return {
    init,
    updateGoalsDisplay,
    renderWeekDates,
    renderDailyProgress,
    openEditGoalsModal
  };
})();

// Make Goals available globally
window.Goals = Goals;
