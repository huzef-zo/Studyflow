/**
 * StudyFlow - Task Manager Module
 */

const Tasks = (function() {
  'use strict';

  let elements = {};
  let currentFilter = 'all';
  let currentDbView = 'table';
  let expandedTasks = new Set();
  let subtaskUnsubscribe = null;

  function initElements() {
    elements = {
      taskList: document.getElementById('task-list'),
      dbViewSwitcher: document.getElementById('db-view-switcher'),
      addTaskBtn: document.getElementById('add-task-btn'),
      filterTabs: document.querySelectorAll('.filter-tab'),
      searchInput: document.getElementById('search-tasks'),
      priorityFilter: document.getElementById('filter-priority'),
      subjectFilter: document.getElementById('filter-subject')
    };
  }

  function setupEventListeners() {
    elements.filterTabs.forEach(tab => {
      const toggleFn = (e) => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        elements.filterTabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        currentFilter = tab.dataset.filter;
        renderTasks();
      };
      tab.onclick = toggleFn;
      tab.onkeydown = toggleFn;
    });

    if (elements.addTaskBtn) {
      elements.addTaskBtn.onclick = () => openTaskModal();
    }

    if (elements.searchInput) {
      elements.searchInput.oninput = App.debounce(() => renderTasks(), 300);
    }

    if (elements.priorityFilter) {
      elements.priorityFilter.onchange = () => renderTasks();
    }

    if (elements.subjectFilter) {
      elements.subjectFilter.onchange = () => renderTasks();
    }

    window.addEventListener('studyflow_taskDataChanged', () => {
      renderTasks();
    });

    window.addEventListener('studyflow_db_updated', () => {
      renderTasks();
    });
  }

  async function init() {
    initElements();
    setupEventListeners();
    setupSubtaskCallbacks();

    if (elements.dbViewSwitcher && typeof Database !== 'undefined') {
      Database.renderViewSwitcherContainer(elements.dbViewSwitcher, (viewName) => {
        currentDbView = viewName;
        renderTasks();
      });
    }

    elements.taskList.innerHTML = `
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
    `;
    await new Promise(r => setTimeout(r, 600));
    renderTasks();

    const urlParams = new URLSearchParams(window.location.search);
    let shouldUpdateUrl = false;

    if (urlParams.get('action') === 'add') {
      openTaskModal();
      shouldUpdateUrl = true;
    }

    const subjectParam = urlParams.get('subject');
    if (subjectParam) {
      if (elements.subjectFilter) {
        elements.subjectFilter.value = subjectParam;
        renderTasks();
        shouldUpdateUrl = true;
      }
    }

    if (shouldUpdateUrl) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }

  function setupSubtaskCallbacks() {
    subtaskUnsubscribe = Storage.onSubtaskCompleted(({ taskId, subtask, task, progress }) => {
      const milestone = SubtaskUtils.getMilestoneMessage(progress.percentage);
      if (milestone) {
        showMilestoneNotification(milestone, progress.percentage);
      }
      
      if (progress.isFullyComplete) {
        App.showToast(`All sub-missions complete! Objective "${task.title}" is done!`, 'success', 4000);
      } else {
        App.showToast(`Sub-mission complete: ${progress.completed}/${progress.total}`, 'success', 2500);
      }
    });
  }

  function showMilestoneNotification(message, percentage) {
    const existing = document.querySelector('.progress-milestone');
    if (existing) existing.remove();
    
    const milestone = document.createElement('div');
    milestone.className = 'progress-milestone';
    milestone.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
        <span style="font-size:18px;">🎉</span>
        <span>${App.escapeHtml(message)}</span>
      </div>
    `;
    document.body.appendChild(milestone);
    
    setTimeout(() => {
      if (milestone.parentNode) milestone.parentNode.removeChild(milestone);
    }, 3200);
  }

  function renderTasks() {
    if (typeof Database !== 'undefined' && currentDbView) {
      const dbItems = Database.getTaskDatabaseItems();
      const processedItems = Database.applyFilterAndSort(dbItems);

      if (currentDbView === 'table') {
        elements.taskList.innerHTML = Database.renderTableView(processedItems);
        return;
      } else if (currentDbView === 'board') {
        elements.taskList.innerHTML = Database.renderBoardView(processedItems);
        return;
      } else if (currentDbView === 'calendar') {
        elements.taskList.innerHTML = Database.renderCalendarView(processedItems);
        return;
      }
    }

    let tasks = Storage.getTasks();

    if (elements.subjectFilter && elements.subjectFilter.options.length === 1) {
      Storage.getSubjects().forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        elements.subjectFilter.appendChild(option);
      });
    }

    const todayStr = Storage.formatDate(new Date());
    if (currentFilter === 'pending') tasks = tasks.filter(t => {
      if (t.type === 'repeating') return !Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr);
      return !t.completed;
    });
    if (currentFilter === 'completed') tasks = tasks.filter(t => {
      if (t.type === 'repeating') return Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr);
      return t.completed;
    });

    const searchTerm = elements.searchInput?.value.toLowerCase();
    if (searchTerm) tasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm) || t.subject.toLowerCase().includes(searchTerm));

    const priority = elements.priorityFilter?.value;
    if (priority && priority !== 'all') tasks = tasks.filter(t => t.priority === priority);

    const subject = elements.subjectFilter?.value;
    if (subject && subject !== 'all') tasks = tasks.filter(t => t.subject === subject);

    if (tasks.length === 0) {
      elements.taskList.innerHTML = App.createEmptyStateHtml({
        title: 'No Objectives Found',
        text: 'Initiate a new mission to begin tracking your progress and goals.',
        icon: 'tasks',
        actionText: 'Begin First Mission',
        actionId: 'empty-add-btn'
      });
      document.getElementById('empty-add-btn')?.addEventListener('click', () => openTaskModal());
      return;
    }

    elements.taskList.innerHTML = tasks.sort((a, b) => {
      const aDone = a.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(a.id, todayStr) : a.completed;
      const bDone = b.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(b.id, todayStr) : b.completed;

      if (aDone !== bDone) return aDone ? 1 : -1;
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
      if (a._isOverdue && !b._isOverdue) return -1;
      if (!a._isOverdue && b._isOverdue) return 1;
      const aDate = a.dueDate || '';
      const bDate = b.dueDate || '';
      return aDate < bDate ? -1 : (aDate > bDate ? 1 : 0);
    }).map((task, index) => {
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr) : task.completed;
      const priorityClass = `priority-${App.escapeHtml(task.priority)}`;
      const subjectColor = App.getSubjectColor(task.subject);
      const isExpanded = expandedTasks.has(task.id);
      const staggerClass = index < 5 ? `stagger-${index + 1}` : '';
      return `
        <div class="task-card ${priorityClass} ${isDone ? 'completed' : ''} animate-fade-in ${staggerClass}" data-id="${App.escapeHtml(task.id)}" draggable="${!isDone}">
          <div class="swipe-hint">Swipe to complete</div>
          <div class="flex items-start gap-md">
            <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${App.escapeHtml(task.id)}" style="margin-top:4px;" tabindex="0" role="checkbox" aria-checked="${isDone}" aria-label="${isDone ? 'Mark as incomplete' : 'Mark as complete'}: ${App.escapeHtml(task.title)}"></div>
            <div class="flex-1 min-w-0">
              <div class="task-header-inline">
                <div class="task-title-text" style="${isDone ? 'text-decoration:line-through;opacity:0.5;' : ''}">${App.escapeHtml(task.title)}</div>
                <div class="subject-pill" style="--tag-color:${App.hexToRgb(subjectColor)};color:white;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);">${App.escapeHtml(task.subject)}</div>
                ${task._isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ''}
                ${task.priority === 'critical' ? '<span class="badge" style="--tag-color:var(--danger-rgb);font-size:9px;color:white;">Critical</span>' : ''}
              </div>
              <div class="flex items-center justify-between">
                <div class="task-meta-text">
                  Target: ${Storage.formatDisplayDate(task.dueDate)}
                  ${task.dueTime ? ` • ${App.escapeHtml(task.dueTime)}` : ''}
                </div>
                <div class="flex items-center gap-xs">
                  ${task.subtasks && task.subtasks.length > 0 ? `
                    ${SubtaskUtils.buildProgressIndicator(task)}
                    <button class="btn btn-ghost btn-icon btn-sm task-expand-btn" data-id="${App.escapeHtml(task.id)}" style="color:var(--text-muted);transition:transform 0.3s;${isExpanded ? 'transform:rotate(180deg);' : ''}" aria-label="${isExpanded ? 'Collapse sub-missions' : 'Expand sub-missions'}" aria-expanded="${isExpanded}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  ` : ''}
                  <div class="task-actions-compact">
                    <button class="btn btn-ghost btn-icon btn-sm edit-task" data-id="${App.escapeHtml(task.id)}" style="color:var(--text-muted);" aria-label="Edit objective: ${App.escapeHtml(task.title)}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-icon btn-sm del-task" data-id="${App.escapeHtml(task.id)}" style="color:var(--text-muted);" aria-label="Delete objective: ${App.escapeHtml(task.title)}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              ${task.subtasks && task.subtasks.length > 0 ? `
                <div class="subtasks-container" style="${isExpanded ? 'display:block;' : 'display:none;'}">
                  ${task.subtasks.map(subtask => `
                    <div class="subtask-item">
                      <div class="subtask-checkbox ${subtask.isCompleted ? 'checked' : ''}" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(subtask.id)}" tabindex="0" role="checkbox" aria-checked="${subtask.isCompleted}" aria-label="${subtask.isCompleted ? 'Mark as incomplete' : 'Mark as complete'}: ${App.escapeHtml(subtask.title)}"></div>
                      <div class="subtask-title ${subtask.isCompleted ? 'completed' : ''}">${App.escapeHtml(subtask.title)}</div>
                      <div class="subtask-cycle-tracker">
                        <button class="cycle-btn dec-cycle" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(subtask.id)}" aria-label="Decrease completed cycles for ${App.escapeHtml(subtask.title)}">-</button>
                        <span>${subtask.completedCycles} session${subtask.completedCycles === 1 ? '' : 's'}</span>
                        <button class="cycle-btn inc-cycle" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(subtask.id)}" aria-label="Increase completed cycles for ${App.escapeHtml(subtask.title)}">+</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function openTaskModal(id = null) {
    const isEdit = !!id;
    const task = isEdit ? Storage.getTaskById(id) : null;
    const subjects = Storage.getSubjects();

    const content = `
      <form id="task-form">
        <div class="form-group">
          <label class="form-label">Objective Title</label>
          <input type="text" name="title" class="form-input" value="${task ? App.escapeHtml(task.title) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Task Type</label>
          <select name="type" class="form-select">
            <option value="one-time" ${!task || task.type === 'one-time' ? 'selected' : ''}>One-time</option>
            <option value="repeating" ${task && task.type === 'repeating' ? 'selected' : ''}>Repeating</option>
            <option value="date-range" ${task && task.type === 'date-range' ? 'selected' : ''}>Date Range</option>
          </select>
        </div>
        <div id="date-inputs-container"></div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Sector</label>
            <select name="subject" class="form-input">
              ${subjects.map(s => `<option value="${App.escapeHtml(s.name)}" ${task && task.subject === s.name ? 'selected' : ''}>${App.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-input">
              <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${task && task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${task && task.priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>
        <div id="subtasks-editor">
          <label class="form-label">Sub-missions</label>
          <div id="modal-subtasks-list">
            ${task && task.subtasks ? task.subtasks.map((s) => `
              <div class="flex items-center gap-sm mb-sm">
                <input type="text" class="form-input subtask-input" value="${App.escapeHtml(s.title)}" placeholder="Sub-mission title">
                <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);" aria-label="Remove sub-mission">&times;</button>
              </div>
            `).join('') : ''}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-subtask-row">+ Add Sub-mission</button>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: isEdit ? 'Modify Objective' : 'Initiate Objective',
      content,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" id="save-task">${isEdit ? 'Update' : 'Launch'}</button>
      `
    });

    modal.querySelector('#add-subtask-row').onclick = () => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-sm mb-sm';
      row.innerHTML = `
        <input type="text" class="form-input subtask-input" placeholder="Sub-mission title">
        <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);" aria-label="Remove sub-mission">&times;</button>
      `;
      row.querySelector('.remove-subtask-row').onclick = () => row.remove();
      modal.querySelector('#modal-subtasks-list').appendChild(row);
    };

    modal.querySelectorAll('.remove-subtask-row').forEach(btn => {
      btn.onclick = () => btn.parentElement.remove();
    });

    modal.querySelector('#save-task').onclick = () => {
      const form = modal.querySelector('#task-form');
      const data = App.getFormData(form);
      const type = form.querySelector('select[name="type"]').value;

      const subtaskInputs = modal.querySelectorAll('.subtask-input');
      const subtasks = [];
      subtaskInputs.forEach((input, idx) => {
        if (input.value.trim()) {
          const existing = (task && task.subtasks && task.subtasks[idx]) ? task.subtasks[idx] : {};
          subtasks.push({
            id: existing.id || Storage.generateId(),
            title: input.value.trim(),
            isCompleted: existing.isCompleted || false,
            estimatedCycles: existing.estimatedCycles || 1,
            completedCycles: existing.completedCycles || 0
          });
        }
      });

      const repeatDays = type === 'repeating'
        ? Array.from(modal.querySelectorAll('.day-toggle.active')).map(el => parseInt(el.dataset.day))
        : [];

      if (type === 'repeating' && repeatDays.length === 0) {
        App.showToast('Please select at least one day for repeating task', 'error');
        return;
      }

      const taskData = {
        title: data.title.trim(),
        type,
        subject: data.subject,
        priority: data.priority,
        dueTime: data.dueTime || null,
        subtasks,
        repeatDays,
        startDate: type === 'date-range' ? (data.startDate || data.dueDate) : (type === 'one-time' ? data.dueDate : null),
        dueDate: type === 'repeating' ? null : (data.dueDate || data.startDate)
      };

      if (taskData.title) {
        isEdit ? Storage.updateTask(id, taskData) : Storage.addTask(taskData);
        App.closeModal();
        renderTasks();
      }
    };

    const dateContainer = modal.querySelector('#date-inputs-container');

    function updateDateInputs(type) {
      if (type === 'repeating') {
        const days = ['S','M','T','W','T','F','S'];
        const repeatDays = task && task.repeatDays ? task.repeatDays : [new Date().getDay()];
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Repeat On:</label>
            <div class="repeat-days-grid">
              ${days.map((day, i) => `<div class="day-toggle ${repeatDays.includes(i) ? 'active' : ''}" data-day="${i}">${day}</div>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-sm" id="select-every-day">Select Every Day</button>
          </div>
          <div class="form-group">
            <label class="form-label">Target Time (Optional)</label>
            <input type="time" name="dueTime" class="form-input" value="${task ? App.escapeHtml(task.dueTime || '') : ''}">
          </div>
        `;
        dateContainer.querySelectorAll('.day-toggle').forEach(el => el.addEventListener('click', () => el.classList.toggle('active')));
        dateContainer.querySelector('#select-every-day').addEventListener('click', () => dateContainer.querySelectorAll('.day-toggle').forEach(el => el.classList.add('active')));
      } else if (type === 'date-range') {
        dateContainer.innerHTML = `
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Start Date</label>
              <input type="date" name="startDate" class="form-input" value="${task ? App.escapeHtml(task.startDate || task.dueDate) : Storage.formatDate(new Date())}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Due Date</label>
              <input type="date" name="dueDate" class="form-input" value="${task ? App.escapeHtml(task.dueDate) : Storage.formatDate(new Date())}" required>
            </div>
          </div>
        `;
      } else {
        dateContainer.innerHTML = `
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Target Date</label>
              <input type="date" name="dueDate" class="form-input" value="${task ? App.escapeHtml(task.dueDate) : Storage.formatDate(new Date())}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Target Time (Optional)</label>
              <input type="time" name="dueTime" class="form-input" value="${task ? App.escapeHtml(task.dueTime || '') : ''}">
            </div>
          </div>
        `;
      }
    }

    modal.querySelector('select[name="type"]').addEventListener('change', (e) => {
      updateDateInputs(e.target.value);
    });

    updateDateInputs(task ? task.type : 'one-time');

    modal.querySelector('[data-action="cancel"]').onclick = () => App.closeModal();
    App.openModal(modal);
  }

  async function deleteTask(id) {
    if (await App.confirm({ title: 'Purge Objective?', message: 'This mission data will be permanently erased.', confirmText: 'Purge', danger: true })) {
      Storage.deleteTask(id);
      renderTasks();
    }
  }

  return { init, openTaskModal };
})();

window.Tasks = Tasks;
