/**
 * StudyFlow - Calendar Module
 * FIX: After adding a task from the calendar "add task" modal, the selected
 *      date is now preserved and the day task list re-renders automatically.
 *      Previously the date was cleared and the user had to re-click to confirm.
 */

const Calendar = (function() {
  'use strict';

  let currentDate = new Date();
  let selectedDate = null;
  let elements = {};

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function initElements() {
    elements = {
      calendarGrid: document.getElementById('calendar-grid'),
      calendarTitle: document.getElementById('calendar-title'),
      prevMonthBtn: document.getElementById('prev-month'),
      nextMonthBtn: document.getElementById('next-month'),
      todayBtn: document.getElementById('today-btn'),
      selectedDateTitle: document.getElementById('selected-date-title'),
      dayTasks: document.getElementById('day-tasks'),
      dayTimeline: document.getElementById('day-timeline')
    };
  }

  function getTasksForDate(dateStr) {
    return Storage.getTasksByDate(dateStr);
  }

  /**
   * Expands tasks into a map of dates for the given month.
   * OPTIMIZATION: Uses a single-pass date loop for repeating tasks and skips defensive copies.
   * Reduces complexity from O(Tasks * Days) to O(Tasks + Days) by grouping.
   */
  function getTasksForMonth(year, month) {
    const tasks = Storage.getTasks();
    const monthTasks = {};
    const monthEndDate = new Date(year, month + 1, 0);
    const numDays = monthEndDate.getDate();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthStartStr = monthPrefix + '01';
    const monthEndStr = Storage.formatDate(monthEndDate);

    // Pre-initialize month map
    for (let day = 1; day <= numDays; day++) {
      monthTasks[monthPrefix + String(day).padStart(2, '0')] = [];
    }

    const repeatingByDay = [[], [], [], [], [], [], []]; // 0=Sun, 1=Mon...
    const inRangeTasks = [];

    // Categorize tasks in one pass
    tasks.forEach(task => {
      if (task.type === 'repeating') {
        if (task.repeatDays) task.repeatDays.forEach(d => {
          if (repeatingByDay[d]) repeatingByDay[d].push(task);
        });
      } else if (task.dueDate) {
        const taskStart = task.startDate || task.dueDate;
        // Basic range overlap check
        if (!(task.dueDate < monthStartStr || taskStart > monthEndStr)) {
          if (!(task.startDate && task.dueDate && task.startDate > task.dueDate)) {
            inRangeTasks.push(task);
          }
        }
      }
    });

    // Expand repeating tasks using a single loop over the month's days
    const iterDate = new Date(year, month, 1);
    for (let day = 1; day <= numDays; day++) {
      iterDate.setDate(day);
      const dayOfWeek = iterDate.getDay();
      const dateStr = monthPrefix + String(day).padStart(2, '0');
      const scheduled = repeatingByDay[dayOfWeek];
      if (scheduled.length > 0) {
        scheduled.forEach(t => monthTasks[dateStr].push(t));
      }
    }

    // Expand one-time and range tasks
    inRangeTasks.forEach(task => {
      const taskStart = task.startDate || task.dueDate;
      const startDay = Math.max(1, taskStart > monthStartStr ? parseInt(taskStart.split('-')[2], 10) : 1);
      const endDay = Math.min(numDays, task.dueDate < monthEndStr ? parseInt(task.dueDate.split('-')[2], 10) : numDays);
      for (let d = startDay; d <= endDay; d++) {
        monthTasks[monthPrefix + String(d).padStart(2, '0')].push(task);
      }
    });

    return monthTasks;
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    elements.calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const monthTasks = getTasksForMonth(year, month);

    let html = '';
    DAY_NAMES.forEach(day => { html += `<div class="calendar-day-header">${day}</div>`; });

    for (let i = startingDay - 1; i >= 0; i--) {
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${prevMonthLastDay - i}</span></div>`;
    }

    const today = Storage.formatDate(new Date());
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const tasks = monthTasks[dateStr] || [];
      const isToday = dateStr === today;
      const isSelected = selectedDate === dateStr;
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' selected';
      let indicatorsHtml = '';
      if (tasks.length > 0) {
        indicatorsHtml = `<div class="calendar-day-indicators">${tasks.slice(0,3).map(t => {
          const color = t.completed ? 'var(--success)' : App.getSubjectColor(t.subject);
          return `<div class="calendar-task-dot" style="background-color:${App.escapeHtml(color)};"></div>`;
        }).join('')}</div>`;
      }
      const ariaLabel = `${day} ${MONTH_NAMES[month]} ${year}${isToday ? ', Today' : ''}${tasks.length > 0 ? `, ${tasks.length} missions` : ''}`;
      html += `<div class="${classes}" data-date="${dateStr}" tabindex="0" role="button" aria-label="${ariaLabel}"><span class="calendar-day-number">${day}</span>${indicatorsHtml}</div>`;
    }

    const remainingCells = 42 - (startingDay + totalDays);
    for (let day = 1; day <= remainingCells; day++) {
      html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
    }

    elements.calendarGrid.innerHTML = html;
    elements.calendarGrid.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
      const clickHandler = () => handleDayClick(dayEl.dataset.date);
      dayEl.addEventListener('click', clickHandler);
      dayEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      });
    });
  }

  function handleDayClick(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderSelectedDayTasks();
  }

  function renderSelectedDayTasks() {
    if (!selectedDate) {
      elements.selectedDateTitle.textContent = 'Select a date';
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({ title: 'Select a Date', text: 'Choose a date from the calendar to view scheduled missions.', icon: 'calendar', padding: '2rem' });
      if (elements.dayTimeline) elements.dayTimeline.innerHTML = '';
      return;
    }

    const date = new Date(selectedDate);
    elements.selectedDateTitle.textContent = date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

    renderDayTimeline(selectedDate);

    const tasks = getTasksForDate(selectedDate);
    if (tasks.length === 0) {
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({ title: 'Clear Schedule', text: 'No missions scheduled for this day.', icon: 'check', actionText: 'Schedule Mission', actionId: 'add-task-day', padding: '2rem' });
      document.getElementById('add-task-day')?.addEventListener('click', () => openAddTaskForDate(selectedDate));
      return;
    }

    elements.dayTasks.innerHTML = tasks.map(task => {
      const subjectColor = App.getSubjectColor(task.subject);
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, selectedDate) : task.completed;
      return `
        <div class="task-card priority-${App.escapeHtml(task.priority)} ${isDone ? 'completed' : ''}" data-id="${App.escapeHtml(task.id)}" style="--priority-color:${App.hexToRgb(subjectColor)};">
          <div class="flex items-start gap-md w-full">
            <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${App.escapeHtml(task.id)}" tabindex="0" role="checkbox" aria-checked="${isDone}" aria-label="${isDone ? 'Mark as incomplete' : 'Mark as complete'}: ${App.escapeHtml(task.title)}"></div>
            <div class="flex-1">
              <div class="flex items-center gap-md mb-xs">
                <div class="subject-pill" style="--tag-color:${App.hexToRgb(subjectColor)}">${App.escapeHtml(task.subject)}</div>
              </div>
              <div class="task-title-text" style="${isDone ? 'text-decoration:line-through;opacity:0.5;' : ''}">${App.escapeHtml(task.title)}</div>
              <div class="task-meta-text">${task.dueTime ? `Time: ${App.escapeHtml(task.dueTime)}` : 'All Day'}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    elements.dayTasks.querySelectorAll('.task-checkbox').forEach(cb => {
      const toggleFn = (e) => {
        e.stopPropagation();
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        const id = cb.dataset.id;
        const task = Storage.getTaskById(id);

        if (task.type === 'repeating') {
          // Use per-day tracking for repeating tasks
          const isCurrentlyDone = Storage.isRepeatingTaskCompletedOnDate(id, selectedDate);
          Storage.setRepeatingTaskCompletedOnDate(id, selectedDate, !isCurrentlyDone);
          if (!isCurrentlyDone) App.showToast('Task completed!', 'success');
        } else {
          task.completed ? Storage.uncompleteTask(id) : Storage.completeTask(id);
          if (!task.completed) App.showToast('Task completed!', 'success');
        }
        renderCalendar();
        renderSelectedDayTasks();
      };
      cb.onclick = toggleFn;
      cb.onkeydown = toggleFn;
    });
  }

  function openAddTaskForDate(dateStr) {
    const subjects = Storage.getSubjects();
    const content = `
      <form id="calendar-task-form">
        <div class="form-group">
          <label class="form-label" for="cal-task-title">Task Title *</label>
          <input type="text" class="form-input" id="cal-task-title" name="title" placeholder="What needs to be done?" required>
        </div>
        <div class="form-group">
          <label class="form-label">Task Type</label>
          <select name="type" class="form-select" id="cal-task-type">
            <option value="one-time" selected>One-time Task</option>
            <option value="repeating">Repeating Task</option>
            <option value="date-range">Date Range Task</option>
          </select>
        </div>
        <div id="cal-date-inputs-container"></div>
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="cal-task-priority">Priority</label>
            <select class="form-input" id="cal-task-priority" name="priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cal-task-subject">Subject</label>
            <select class="form-input" id="cal-task-subject" name="subject">
              ${subjects.map(s => `<option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </form>
    `;

    const modal = App.createModal({
      id: 'calendar-task-modal',
      title: 'Add Task',
      content,
      footer: `<button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button><button type="submit" form="calendar-task-form" class="btn btn-primary">Add Task</button>`
    });

    const form = modal.querySelector('#calendar-task-form');
    const dateContainer = modal.querySelector('#cal-date-inputs-container');

    function updateDateInputs(type) {
      if (type === 'repeating') {
        const days = ['S','M','T','W','T','F','S'];
        const selectedDay = new Date(dateStr).getDay();
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Repeat On:</label>
            <div class="repeat-days-grid">
              ${days.map((day, i) => `<div class="day-toggle ${i===selectedDay?'active':''}" data-day="${i}">${day}</div>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-sm" id="cal-select-every-day">Select Every Day</button>
          </div>
        `;
        dateContainer.querySelectorAll('.day-toggle').forEach(el => el.addEventListener('click', () => el.classList.toggle('active')));
        dateContainer.querySelector('#cal-select-every-day').addEventListener('click', () => dateContainer.querySelectorAll('.day-toggle').forEach(el => el.classList.add('active')));
      } else if (type === 'date-range') {
        dateContainer.innerHTML = `
          <div class="grid grid-2">
            <div class="form-group"><label class="form-label" for="cal-task-start-date">Start Date</label><input type="date" class="form-input" id="cal-task-start-date" name="startDate" value="${dateStr}"></div>
            <div class="form-group"><label class="form-label" for="cal-task-due-date">Due Date</label><input type="date" class="form-input" id="cal-task-due-date" name="dueDate" value="${dateStr}"></div>
          </div>
        `;
      } else {
        dateContainer.innerHTML = `<div class="form-group"><label class="form-label" for="cal-task-due-date">Due Date</label><input type="date" class="form-input" id="cal-task-due-date" name="dueDate" value="${dateStr}"></div>`;
      }
    }

    modal.querySelector('select[name="type"]').addEventListener('change', (e) => updateDateInputs(e.target.value));
    updateDateInputs('one-time');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = App.getFormData(form);
      const type = form.querySelector('select[name="type"]').value;
      if (!data.title.trim()) { App.showToast('Please enter a task title', 'error'); return; }
      let repeatDays = [];
      if (type === 'repeating') {
        repeatDays = Array.from(form.querySelectorAll('.day-toggle.active')).map(el => parseInt(el.dataset.day));
        if (repeatDays.length === 0) { App.showToast('Please select at least one day', 'error'); return; }
      }
      if (type === 'date-range' && data.startDate && data.dueDate && data.startDate > data.dueDate) {
        App.showToast('Start date cannot be after due date', 'error'); return;
      }

      const savedTask = Storage.addTask({
        title: data.title.trim(), type,
        startDate: type === 'date-range' ? (data.startDate || data.dueDate) : (type === 'one-time' ? data.dueDate : null),
        dueDate: type === 'repeating' ? null : (data.dueDate || data.startDate),
        priority: data.priority, subject: data.subject, repeatDays
      });

      App.showToast('Task added', 'success');
      App.closeModal();

      // FIX: Preserve the selected date so the user sees the newly added task immediately
      // Previously selectedDate was not re-set here and the list appeared empty.
      selectedDate = savedTask.dueDate || dateStr;
      renderCalendar();
      renderSelectedDayTasks();
    });

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => App.closeModal(modal));
    App.openModal(modal);
    document.getElementById('cal-task-title').focus();
  }

  function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
  function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }

  function renderDayTimeline(dateStr) {
    if (!elements.dayTimeline) return;

    const timeBlocks = Storage.loadData(Storage.KEYS.TIME_BLOCKS, Storage.DEFAULTS.timeBlocks || [])
      .filter(b => b.date === dateStr);

    let html = '<div style="position:relative;height:480px;background:rgba(255,255,255,0.02);border-radius:12px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);">';

    // Draw hour lines
    for (let i = 0; i < 24; i++) {
      html += `<div style="position:absolute;top:${i * 40}px;left:0;width:100%;height:1px;background:rgba(255,255,255,0.05);display:flex;align-items:center;">
        <span style="font-size:9px;color:rgba(255,255,255,0.2);padding-left:4px;">${i.toString().padStart(2, '0')}:00</span>
      </div>`;
    }

    // Draw blocks
    timeBlocks.forEach(block => {
      const startParts = block.startTime.split(':');
      const endParts = block.endTime.split(':');
      const startTop = (parseInt(startParts[0]) * 60 + parseInt(startParts[1])) / 60 * 40;
      const endTop = (parseInt(endParts[0]) * 60 + parseInt(endParts[1])) / 60 * 40;
      const height = Math.max(20, endTop - startTop);

      html += `
        <div class="card" style="position:absolute;top:${startTop}px;left:50px;width:calc(100% - 60px);height:${height}px;background:var(--primary-glow);border-left:3px solid var(--primary);padding:4px 8px;font-size:11px;overflow:hidden;margin:0;">
          <div style="font-weight:700;color:white;">${App.escapeHtml(block.label)}</div>
          <div style="font-size:9px;opacity:0.7;color:white;">${block.startTime} - ${block.endTime}</div>
        </div>
      `;
    });

    if (timeBlocks.length === 0) {
      html += '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem;">No time blocks for this day</div>';
    }

    html += '</div>';
    elements.dayTimeline.innerHTML = html;
  }

  function goToToday() {
    currentDate = new Date();
    selectedDate = Storage.formatDate(new Date());
    renderCalendar();
    renderSelectedDayTasks();
  }

  function setupEventListeners() {
    elements.prevMonthBtn?.addEventListener('click', prevMonth);
    elements.nextMonthBtn?.addEventListener('click', nextMonth);
    elements.todayBtn?.addEventListener('click', goToToday);
  }

  function init() {
    initElements();
    setupEventListeners();
    selectedDate = Storage.formatDate(new Date());
    renderCalendar();
    renderSelectedDayTasks();
  }

  return { init, renderCalendar, renderSelectedDayTasks };
})();

window.Calendar = Calendar;
