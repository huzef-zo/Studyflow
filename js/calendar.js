/**
 * StudyFlow - Calendar Module
 * Handles calendar view and date-based task display
 */

const Calendar = (function() {
  'use strict';

  // State
  let currentDate = new Date();
  let selectedDate = null;
  
  // DOM Elements
  let elements = {};

  // Day names
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      calendarGrid: document.getElementById('calendar-grid'),
      calendarTitle: document.getElementById('calendar-title'),
      prevMonthBtn: document.getElementById('prev-month'),
      nextMonthBtn: document.getElementById('next-month'),
      todayBtn: document.getElementById('today-btn'),
      selectedDateTitle: document.getElementById('selected-date-title'),
      dayTasks: document.getElementById('day-tasks')
    };
  }

  /**
   * Get tasks for a specific date
   */
  function getTasksForDate(dateStr) {
    return Storage.getTasksByDate(dateStr);
  }

  /**
   * Get all tasks with dates for the current month view
   */
  function getTasksForMonth(year, month) {
    const tasks = Storage.getTasks();
    const monthTasks = {};
    
    // Get start and end of the month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    tasks.forEach(task => {
      if (task.type === 'repeating') {
        // Iterate through each day of the month
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = Storage.formatDate(d);
          if (task.repeatDays && task.repeatDays.includes(d.getDay())) {
            if (!monthTasks[dateStr]) {
              monthTasks[dateStr] = [];
            }
            monthTasks[dateStr].push(task);
          }
        }
      } else if (task.dueDate) {
        const startDateStr = task.startDate || task.dueDate;

        // Iterate through each day of the month and see if task falls in it
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = Storage.formatDate(d);
          if (dateStr >= startDateStr && dateStr <= task.dueDate) {
            if (!monthTasks[dateStr]) {
              monthTasks[dateStr] = [];
            }
            monthTasks[dateStr].push(task);
          }
        }
      }
    });
    
    return monthTasks;
  }

  /**
   * Render the calendar grid
   */
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update title
    elements.calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    // Get previous month's last days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // Get tasks for this month
    const monthTasks = getTasksForMonth(year, month);
    
    // Build calendar HTML
    let html = '';
    
    // Day headers
    DAY_NAMES.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Previous month's days
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }
    
    // Current month's days
    const today = Storage.formatDate(new Date());
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tasks = monthTasks[dateStr] || [];
      const isToday = dateStr === today;
      const isSelected = selectedDate === dateStr;
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      
      let indicatorsHtml = '';
      if (tasks.length > 0) {
        indicatorsHtml = `
          <div class="calendar-day-indicators">
            ${tasks.slice(0, 3).map(t => {
              const color = t.completed ? 'var(--success)' : App.getSubjectColor(t.subject);
              return `<div class="calendar-task-dot" style="background-color: ${color};"></div>`;
            }).join('')}
          </div>
        `;
      }
      
      html += `
        <div class="${classes}" data-date="${dateStr}">
          <span class="calendar-day-number">${day}</span>
          ${indicatorsHtml}
        </div>
      `;
    }
    
    // Next month's days
    const remainingCells = 42 - (startingDay + totalDays);
    for (let day = 1; day <= remainingCells; day++) {
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }
    
    elements.calendarGrid.innerHTML = html;
    
    // Attach click listeners
    elements.calendarGrid.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
      dayEl.addEventListener('click', () => handleDayClick(dayEl.dataset.date));
    });
  }

  /**
   * Handle day click
   */
  function handleDayClick(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderSelectedDayTasks();
  }

  /**
   * Render tasks for selected day
   */
  function renderSelectedDayTasks() {
    if (!selectedDate) {
      elements.selectedDateTitle.textContent = 'Select a date';
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({
        title: 'Select a Date',
        text: 'Choose a date from the calendar to view scheduled missions.',
        icon: 'calendar',
        padding: '2rem'
      });
      return;
    }
    
    const date = new Date(selectedDate);
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    elements.selectedDateTitle.textContent = date.toLocaleDateString('en-US', options);
    
    const tasks = getTasksForDate(selectedDate);
    
    if (tasks.length === 0) {
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({
        title: 'Clear Schedule',
        text: 'No missions scheduled for this day. Enjoy your free time or plan ahead.',
        icon: 'check',
        actionText: 'Schedule Mission',
        actionId: 'add-task-day',
        padding: '2rem'
      });
      
      document.getElementById('add-task-day')?.addEventListener('click', () => {
        openAddTaskForDate(selectedDate);
      });
      return;
    }
    
    elements.dayTasks.innerHTML = tasks.map(task => {
      const subjectColor = App.getSubjectColor(task.subject);
      const priorityClass = `priority-${task.priority}`;
      
      return `
        <div class="task-card ${priorityClass} ${task.completed ? 'completed' : ''}"
             data-id="${task.id}"
             style="--priority-color: ${App.hexToRgb(subjectColor)};">
          <div class="flex items-start gap-md w-full">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
            <div class="flex-1">
              <div class="flex items-center gap-md mb-xs">
                <div class="subject-pill" style="--tag-color: ${App.hexToRgb(subjectColor)}">${App.escapeHtml(task.subject)}</div>
              </div>
              <div class="task-title-text" style="${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${App.escapeHtml(task.title)}</div>
              <div class="task-meta-text">
                ${task.dueTime ? `Time: ${task.dueTime}` : 'All Day'}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach checkbox listeners
    elements.dayTasks.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.onclick = (e) => {
        e.stopPropagation();
        const id = cb.dataset.id;
        const task = Storage.getTaskById(id);
        task.completed ? Storage.uncompleteTask(id) : Storage.completeTask(id);
        if (!task.completed) App.showToast('Task completed!', 'success');
        renderCalendar();
        renderSelectedDayTasks();
      };
    });
  }

  /**
   * Open add task modal with pre-filled date
   */
  function openAddTaskForDate(dateStr) {
    const subjects = Storage.getSubjects();
    
    const content = `
      <form id="calendar-task-form">
        <div class="form-group">
          <label class="form-label" for="cal-task-title">Task Title *</label>
          <input type="text" 
                 class="form-input" 
                 id="cal-task-title" 
                 name="title" 
                 placeholder="What needs to be done?"
                 required>
        </div>

        <div class="form-group">
          <label class="form-label">Task Type</label>
          <div class="task-type-selector">
            <label class="task-type-option">
              <span class="task-type-label">Repeating Task</span>
              <input type="radio" name="type" value="repeating">
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">One-time Task</span>
              <input type="radio" name="type" value="one-time" checked>
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">Date Range Task</span>
              <input type="radio" name="type" value="date-range">
              <span class="radio-circle"></span>
            </label>
          </div>
        </div>
        
        <div id="cal-date-inputs-container">
          <!-- Dynamically filled -->
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="cal-task-priority">Priority</label>
            <select class="form-select" id="cal-task-priority" name="priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="cal-task-subject">Subject</label>
            <select class="form-select" id="cal-task-subject" name="subject">
              ${subjects.map(s => `
                <option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </form>
    `;
    
    const modal = App.createModal({
      id: 'calendar-task-modal',
      title: 'Add Task',
      content: content,
      footer: `
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button type="submit" form="calendar-task-form" class="btn btn-primary">Add Task</button>
      `
    });
    
    const form = modal.querySelector('#calendar-task-form');
    const dateContainer = modal.querySelector('#cal-date-inputs-container');

    function updateDateInputs(type) {
      if (type === 'repeating') {
        const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const selectedDay = new Date(dateStr).getDay();
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Repeat On:</label>
            <div class="repeat-days-grid">
              ${days.map((day, i) => `
                <div class="day-toggle ${i === selectedDay ? 'active' : ''}" data-day="${i}">${day}</div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-sm" id="cal-select-every-day">Select Every Day</button>
          </div>
        `;
        dateContainer.querySelectorAll('.day-toggle').forEach(el => {
          el.addEventListener('click', () => el.classList.toggle('active'));
        });
        dateContainer.querySelector('#cal-select-every-day').addEventListener('click', () => {
          dateContainer.querySelectorAll('.day-toggle').forEach(el => el.classList.add('active'));
        });
      } else if (type === 'date-range') {
        dateContainer.innerHTML = `
          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label" for="cal-task-start-date">Start Date</label>
              <input type="date" class="form-input" id="cal-task-start-date" name="startDate" value="${dateStr}">
            </div>
            <div class="form-group">
              <label class="form-label" for="cal-task-due-date">Due Date</label>
              <input type="date" class="form-input" id="cal-task-due-date" name="dueDate" value="${dateStr}">
            </div>
          </div>
        `;
      } else {
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label" for="cal-task-due-date">Due Date</label>
            <input type="date" class="form-input" id="cal-task-due-date" name="dueDate" value="${dateStr}">
          </div>
        `;
      }
    }

    modal.querySelectorAll('input[name="type"]').forEach(radio => {
      radio.addEventListener('change', (e) => updateDateInputs(e.target.value));
    });

    updateDateInputs('one-time');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = App.getFormData(form);
      const type = form.querySelector('input[name="type"]:checked').value;
      
      if (!data.title.trim()) {
        App.showToast('Please enter a task title', 'error');
        return;
      }
      
      let repeatDays = [];
      if (type === 'repeating') {
        const activeDays = form.querySelectorAll('.day-toggle.active');
        repeatDays = Array.from(activeDays).map(el => parseInt(el.dataset.day));
        if (repeatDays.length === 0) {
          App.showToast('Please select at least one day for repeating task', 'error');
          return;
        }
      }

      if (type === 'date-range' && data.startDate && data.dueDate && data.startDate > data.dueDate) {
        App.showToast('Start date cannot be after due date', 'error');
        return;
      }

      Storage.addTask({
        title: data.title.trim(),
        type: type,
        startDate: type === 'date-range' ? (data.startDate || data.dueDate) : (type === 'one-time' ? data.dueDate : null),
        dueDate: (type === 'repeating') ? null : (data.dueDate || data.startDate),
        priority: data.priority,
        subject: data.subject,
        repeatDays: repeatDays
      });
      
      App.showToast('Task added', 'success');
      App.closeModal();
      renderCalendar();
      renderSelectedDayTasks();
    });
    
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      App.closeModal(modal);
    });
    
    App.openModal(modal);
    document.getElementById('cal-task-title').focus();
  }

  /**
   * Navigate to previous month
   */
  function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  }

  /**
   * Navigate to next month
   */
  function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  }

  /**
   * Go to today
   */
  function goToToday() {
    currentDate = new Date();
    selectedDate = Storage.formatDate(new Date());
    renderCalendar();
    renderSelectedDayTasks();
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    elements.prevMonthBtn?.addEventListener('click', prevMonth);
    elements.nextMonthBtn?.addEventListener('click', nextMonth);
    elements.todayBtn?.addEventListener('click', goToToday);
  }

  /**
   * Initialize Calendar module
   */
  function init() {
    initElements();
    setupEventListeners();
    
    // Select today by default
    selectedDate = Storage.formatDate(new Date());
    
    renderCalendar();
    renderSelectedDayTasks();
  }

  // Public API
  return {
    init,
    renderCalendar,
    renderSelectedDayTasks
  };
})();

// Make Calendar available globally
window.Calendar = Calendar;
