/**
 * StudyFlow - Calendar Module
 * Monday-first grid implementation matching Stitch design.
 */

const Calendar = (function() {
  'use strict';

  let currentDate = new Date();
  let selectedDate = null;
  let elements = {};

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function initElements() {
    elements = {
      calendarGrid: document.getElementById('calendar-grid'),
      calendarTitle: document.getElementById('calendar-title'),
      prevMonthBtn: document.getElementById('prev-month'),
      nextMonthBtn: document.getElementById('next-month'),
      todayBtn: document.getElementById('today-snap-btn'),
      selectedDateTitle: document.getElementById('selected-date-title'),
      selectedCountBadge: document.getElementById('selected-count-badge'),
      dayTasks: document.getElementById('day-tasks'),
      addTaskBtn: document.getElementById('add-task-btn'),
      dailyPaceRatio: document.getElementById('daily-pace-ratio'),
      dailyPaceSubtext: document.getElementById('daily-pace-subtext')
    };
  }

  function getTasksForDate(dateStr) {
    return Storage.getTasksByDate ? Storage.getTasksByDate(dateStr) : [];
  }

  function getTasksForMonth(year, month) {
    const tasks = Storage.getTasks ? Storage.getTasks() : [];
    const monthTasks = {};
    const monthEndDate = new Date(year, month + 1, 0);
    const numDays = monthEndDate.getDate();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthStartStr = monthPrefix + '01';
    const monthEndStr = Storage.formatDate(monthEndDate);

    for (let day = 1; day <= numDays; day++) {
      monthTasks[monthPrefix + String(day).padStart(2, '0')] = [];
    }

    const repeatingByDay = [[], [], [], [], [], [], []]; // 0=Sun, 1=Mon...
    const inRangeTasks = [];

    tasks.forEach(task => {
      if (task.type === 'repeating') {
        if (task.repeatDays) task.repeatDays.forEach(d => {
          if (repeatingByDay[d]) repeatingByDay[d].push(task);
        });
      } else if (task.dueDate) {
        const taskStart = task.startDate || task.dueDate;
        if (!(task.dueDate < monthStartStr || taskStart > monthEndStr)) {
          inRangeTasks.push(task);
        }
      }
    });

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
    if (!elements.calendarGrid) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    if (elements.calendarTitle) {
      elements.calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-first offset: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const firstDayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = (firstDayOfWeek + 6) % 7;

    const totalDays = lastDay.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const monthTasks = getTasksForMonth(year, month);
    const today = Storage.formatDate(new Date());

    let html = '';

    // Prev month padding
    for (let i = mondayOffset - 1; i >= 0; i--) {
      const prevDayNum = prevMonthLastDay - i;
      html += `
        <div class="flex flex-col items-center justify-center w-9 h-11 py-1 opacity-25">
          <span class="font-label-md text-label-md text-text-secondary">${prevDayNum}</span>
          <span class="w-1 h-1 rounded-full mt-1 opacity-0"></span>
        </div>
      `;
    }

    // Days of current month
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const tasks = monthTasks[dateStr] || [];
      const isToday = dateStr === today;
      const isSelected = selectedDate === dateStr;
      const hasTasks = tasks.length > 0;

      if (isSelected) {
        html += `
          <button class="flex flex-col items-center justify-center w-9 h-11 py-1 rounded-xl bg-primary-container text-surface-base shadow-[0_4px_12px_rgba(91,155,240,0.35)] transition-all duration-150 active:scale-95" data-date="${dateStr}" type="button">
            <span class="font-headline-sm text-headline-sm leading-none font-bold text-surface-base">${day}</span>
            <span class="w-1 h-1 rounded-full ${hasTasks ? 'bg-surface-base' : 'opacity-0'} mt-1"></span>
          </button>
        `;
      } else if (isToday) {
        html += `
          <button class="flex flex-col items-center justify-center w-9 h-11 py-1 rounded-xl bg-secondary-container/30 text-primary font-bold shadow-sm transition-all duration-150 active:scale-95" data-date="${dateStr}" type="button">
            <span class="font-label-md text-label-md text-primary">${day}</span>
            <span class="w-1 h-1 rounded-full bg-primary mt-1"></span>
          </button>
        `;
      } else {
        html += `
          <button class="flex flex-col items-center justify-center w-9 h-11 py-1 rounded-xl transition-all duration-150 active:scale-95 text-text-secondary hover:text-text-primary hover:bg-surface-container" data-date="${dateStr}" type="button">
            <span class="font-label-md text-label-md">${day}</span>
            <span class="w-1 h-1 rounded-full ${hasTasks ? 'bg-primary-container' : 'opacity-0'} mt-1"></span>
          </button>
        `;
      }
    }

    // Next month padding to fill grid
    const totalCells = mondayOffset + totalDays;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let day = 1; day <= remainingCells; day++) {
      html += `
        <div class="flex flex-col items-center justify-center w-9 h-11 py-1 opacity-25">
          <span class="font-label-md text-label-md text-text-secondary">${day}</span>
          <span class="w-1 h-1 rounded-full mt-1 opacity-0"></span>
        </div>
      `;
    }

    elements.calendarGrid.innerHTML = html;

    // Attach click listeners to day buttons
    elements.calendarGrid.querySelectorAll('button[data-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDate = btn.getAttribute('data-date');
        renderCalendar();
        renderSelectedDayTasks();
      });
    });
  }

  function renderSelectedDayTasks() {
    if (!elements.dayTasks) return;

    if (!selectedDate) {
      if (elements.selectedDateTitle) elements.selectedDateTitle.textContent = 'Select a date';
      if (elements.selectedCountBadge) elements.selectedCountBadge.textContent = '0 tasks';
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({
        title: 'Select a date',
        text: 'Choose a date from the calendar to view scheduled tasks.',
        icon: 'calendar_today'
      });
      return;
    }

    const date = Storage.parseLocalDate ? Storage.parseLocalDate(selectedDate) : new Date(selectedDate);
    if (elements.selectedDateTitle) {
      elements.selectedDateTitle.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    const tasks = getTasksForDate(selectedDate);
    if (elements.selectedCountBadge) {
      elements.selectedCountBadge.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
    }

    const todayStr = Storage.formatDate(new Date());
    const doneTasks = tasks.filter(t => t.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(t.id, selectedDate) : t.completed);
    const remainingCount = tasks.length - doneTasks.length;

    if (elements.dailyPaceRatio) {
      elements.dailyPaceRatio.innerHTML = `<span>${doneTasks.length}</span><span class="text-text-muted font-body-md text-body-md">/${tasks.length}</span>`;
    }
    if (elements.dailyPaceSubtext) {
      elements.dailyPaceSubtext.textContent = `${remainingCount} task(s) remaining today`;
    }

    if (tasks.length === 0) {
      elements.dayTasks.innerHTML = App.createEmptyStateHtml({
        title: 'Clear Schedule',
        text: 'No tasks scheduled for this day.',
        icon: 'check_circle',
        actionText: 'Add task',
        actionId: 'add-task-day-btn'
      });
      const emptyBtn = elements.dayTasks.querySelector('#add-task-day-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openAddTaskForDate(selectedDate));
      return;
    }

    const priorityDotColors = {
      low: 'bg-outline-variant',
      medium: 'bg-primary shadow-[0_0_6px_rgba(166,200,255,0.4)]',
      high: 'bg-primary-container shadow-[0_0_8px_rgba(91,155,240,0.6)]',
      critical: 'bg-error shadow-[0_0_8px_rgba(239,68,68,0.6)]'
    };

    elements.dayTasks.innerHTML = tasks.map(task => {
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, selectedDate) : task.completed;
      const dueLabel = task.dueTime ? task.dueTime : 'All day';

      return `
        <div class="group flex items-center justify-between p-space-md rounded-2xl ${isDone ? 'bg-surface-container-low/40 opacity-60' : 'bg-surface-container-low/60 hover:bg-surface-container-low/90'} backdrop-blur-md transition-all shadow-md" data-id="${App.escapeHtml(task.id)}">
          <div class="flex items-center gap-space-md min-w-0 flex-1">
            <button aria-label="${isDone ? 'Mark active' : 'Mark completed'}" class="task-checkbox flex-shrink-0 w-6 h-6 rounded-full ${isDone ? 'bg-primary-container text-surface-base' : 'bg-surface-container-high text-transparent hover:text-primary-container'} flex items-center justify-center transition-all" data-id="${App.escapeHtml(task.id)}">
              <span class="material-symbols-outlined text-[16px] font-bold">check</span>
            </button>
            <div class="flex flex-col min-w-0 pr-space-xs">
              <span class="task-title font-headline-sm text-headline-sm ${isDone ? 'text-text-muted line-through' : 'text-text-primary'} truncate">${App.escapeHtml(task.title)}</span>
              <div class="flex items-center gap-space-sm mt-0.5">
                <span class="px-2 py-0.5 rounded-full bg-surface-container-highest text-text-secondary font-label-sm text-label-sm">${App.escapeHtml(task.subject || 'General')}</span>
                <div class="flex items-center gap-1 text-text-muted">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  <span class="font-body-sm text-body-sm">${App.escapeHtml(dueLabel)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-space-sm flex-shrink-0">
            <span class="w-2 h-2 rounded-full ${priorityDotColors[task.priority] || priorityDotColors.medium}" title="Priority: ${App.escapeHtml(task.priority)}"></span>
            <button aria-label="More options" class="task-options-btn text-text-muted hover:text-text-secondary p-1" data-id="${App.escapeHtml(task.id)}">
              <span class="material-symbols-outlined text-[18px]">more_vert</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Checkbox toggles
    elements.dayTasks.querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-id');
        const task = Storage.getTaskById(taskId);
        if (!task) return;

        if (task.type === 'repeating') {
          const isDone = Storage.isRepeatingTaskCompletedOnDate(taskId, selectedDate);
          Storage.setRepeatingTaskCompletedOnDate(taskId, selectedDate, !isDone);
        } else {
          task.completed ? Storage.uncompleteTask(taskId) : Storage.completeTask(taskId);
        }
        renderCalendar();
        renderSelectedDayTasks();
      });
    });

    // Task options button
    elements.dayTasks.querySelectorAll('.task-options-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-id');
        const task = Storage.getTaskById(taskId);
        if (task) App.openAddTaskModal(task);
      });
    });
  }

  function openAddTaskForDate(dateStr) {
    const defaultTask = {
      dueDate: dateStr,
      startDate: dateStr,
      type: 'one-time'
    };
    App.openAddTaskModal(defaultTask);
  }

  function prevMonth() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  }

  function nextMonth() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  }

  function goToToday() {
    currentDate = new Date();
    selectedDate = Storage.formatDate(new Date());
    renderCalendar();
    renderSelectedDayTasks();
  }

  function setupEventListeners() {
    if (elements.prevMonthBtn) elements.prevMonthBtn.onclick = prevMonth;
    if (elements.nextMonthBtn) elements.nextMonthBtn.onclick = nextMonth;
    if (elements.todayBtn) elements.todayBtn.onclick = goToToday;
    if (elements.addTaskBtn) {
      elements.addTaskBtn.onclick = () => openAddTaskForDate(selectedDate || Storage.formatDate(new Date()));
    }

    window.addEventListener('studyflow_taskDataChanged', () => {
      renderCalendar();
      renderSelectedDayTasks();
    });
    window.addEventListener('studyflow_task_updated', () => {
      renderCalendar();
      renderSelectedDayTasks();
    });
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
