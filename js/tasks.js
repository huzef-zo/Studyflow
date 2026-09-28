/**
 * StudyFlow - Tasks Module
 */

const Tasks = (function() {
  'use strict';

  let elements = {};
  let currentFilter = 'all';
  let expandedTasks = new Set();
  let subtaskUnsubscribe = null;

  function initElements() {
    elements = {
      taskList: document.getElementById('task-list'),
      addTaskBtn: document.getElementById('add-task-btn'),
      fabAddTaskBtn: document.getElementById('fab-add-task'),
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

    if (elements.fabAddTaskBtn) {
      elements.fabAddTaskBtn.onclick = () => openTaskModal();
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
  }

  async function init() {
    initElements();
    setupEventListeners();
    setupSubtaskCallbacks();

    elements.taskList.innerHTML = `
      <div class="card mb-sm p-md"><div class="text-secondary text-center">Loading tasks...</div></div>
    `;
    await new Promise(r => setTimeout(r, 200));
    renderTasks();

    // Check for URL parameters
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
      if (progress.isFullyComplete) {
        App.showToast(`All subtasks complete! Task "${task.title}" is done!`, 'success', 4000);
      } else {
        App.showToast(`Subtask complete: ${progress.completed}/${progress.total}`, 'success', 2500);
      }
    });
  }

  function renderTasks() {
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
        title: 'No Tasks Found',
        text: 'Add a new task to get started with your study goals.',
        icon: 'tasks',
        actionText: 'Add First Task',
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
    }).map((task) => {
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr) : task.completed;
      const isExpanded = expandedTasks.has(task.id);
      return `
        <div class="task-card ${isDone ? 'completed' : ''}" data-id="${App.escapeHtml(task.id)}" draggable="${!isDone}">
          <div class="flex items-start gap-sm">
            <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${App.escapeHtml(task.id)}" tabindex="0" role="checkbox" aria-checked="${isDone}" aria-label="${isDone ? 'Mark as incomplete' : 'Mark as complete'}: ${App.escapeHtml(task.title)}"></div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-sm mb-xs">
                <div class="flex items-center gap-xs flex-1 min-w-0">
                  <span class="priority-dot ${App.escapeHtml(task.priority)}" title="Priority: ${App.escapeHtml(task.priority)}"></span>
                  <span class="task-title-text ${isDone ? 'completed' : ''}">${App.escapeHtml(task.title)}</span>
                </div>

                <div class="flex items-center gap-xs flex-shrink-0">
                  ${task.subtasks && task.subtasks.length > 0 ? `
                    <button class="btn btn-ghost btn-icon btn-sm task-expand-btn" data-id="${App.escapeHtml(task.id)}" aria-label="${isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}" aria-expanded="${isExpanded}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: ${isExpanded ? 'rotate(180deg)' : 'none'}; transition: transform 180ms ease-out;"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  ` : ''}
                  <button class="btn btn-ghost btn-icon btn-sm edit-task" data-id="${App.escapeHtml(task.id)}" aria-label="Edit task: ${App.escapeHtml(task.title)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-ghost btn-icon btn-sm del-task" data-id="${App.escapeHtml(task.id)}" aria-label="Delete task: ${App.escapeHtml(task.title)}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div class="task-meta-text flex items-center gap-sm flex-wrap">
                <span class="badge">${App.escapeHtml(task.subject)}</span>
                ${task.dueDate ? `<span>Due: ${Storage.formatDisplayDate(task.dueDate)}</span>` : ''}
                ${task.subtasks && task.subtasks.length > 0 ? `<span>${task.subtasks.filter(s => s.isCompleted).length}/${task.subtasks.length} subtasks</span>` : ''}
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

    // ── Expand buttons ──────────────────────────────────────────────────────
    elements.taskList.querySelectorAll('.task-expand-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        expandedTasks.has(id) ? expandedTasks.delete(id) : expandedTasks.add(id);
        renderTasks();
      };
    });

    // ── Checkboxes ──────────────────────────────────────────────────────────
    elements.taskList.querySelectorAll('.task-checkbox').forEach(cb => {
      const toggleFn = (e) => {
        e.stopPropagation();
        const id = cb.dataset.id;
        const task = Storage.getTaskById(id);

        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        if (task.type === 'repeating') {
          const isCurrentlyDone = Storage.isRepeatingTaskCompletedOnDate(id, todayStr);
          Storage.setRepeatingTaskCompletedOnDate(id, todayStr, !isCurrentlyDone);
          if (!isCurrentlyDone) App.showToast('Task completed for today!', 'success');
          renderTasks();
        } else {
          if (!task.completed) {
            cb.classList.add('checked');

            const cancelFn = Storage.stageTaskCompletion(id, 5000, () => {
              Storage.completeTask(id);
              renderTasks();
            });

            App.showUndoToast('Task completed!', () => {
              cancelFn();
              cb.classList.remove('checked');
            });

          } else {
            Storage.uncompleteTask(id);
            renderTasks();
          }
        }
      };
      cb.onclick = toggleFn;
      cb.onkeydown = toggleFn;
    });

    // ── Subtask checkboxes ──────────────────────────────────────────────────
    elements.taskList.querySelectorAll('.subtask-checkbox').forEach(cb => {
      const toggleFn = (e) => {
        e.stopPropagation();
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        const isCompleting = !cb.classList.contains('checked');
        const taskId = cb.dataset.taskId;
        const subtaskId = cb.dataset.subtaskId;

        Storage.toggleSubtask(taskId, subtaskId, isCompleting);
        renderTasks();
      };
      cb.onclick = toggleFn;
      cb.onkeydown = toggleFn;
    });

    // ── Cycle buttons ───────────────────────────────────────────────────────
    elements.taskList.querySelectorAll('.inc-cycle').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const task = Storage.getTaskById(btn.dataset.taskId);
        const subtask = task.subtasks.find(s => s.id === btn.dataset.subtaskId);
        Storage.updateSubtask(btn.dataset.taskId, btn.dataset.subtaskId, { completedCycles: subtask.completedCycles + 1 });
        renderTasks();
      };
    });

    elements.taskList.querySelectorAll('.dec-cycle').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const task = Storage.getTaskById(btn.dataset.taskId);
        const subtask = task.subtasks.find(s => s.id === btn.dataset.subtaskId);
        if (subtask.completedCycles > 0) {
          Storage.updateSubtask(btn.dataset.taskId, btn.dataset.subtaskId, { completedCycles: subtask.completedCycles - 1 });
          renderTasks();
        }
      };
    });

    // ── Edit / Delete ───────────────────────────────────────────────────────
    elements.taskList.querySelectorAll('.edit-task').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); openTaskModal(btn.dataset.id); };
    });
    elements.taskList.querySelectorAll('.del-task').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); deleteTask(btn.dataset.id); };
    });
  }

  function openTaskModal(id = null) {
    const isEdit = !!id;
    const task = isEdit ? Storage.getTaskById(id) : null;
    const subjects = Storage.getSubjects();

    const content = `
      <form id="task-form">
        <div class="form-group">
          <label class="form-label">Task Title</label>
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
            <label class="form-label">Subject</label>
            <select name="subject" class="form-select">
              ${subjects.map(s => `<option value="${App.escapeHtml(s.name)}" ${task && task.subject === s.name ? 'selected' : ''}>${App.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select name="priority" class="form-select">
              <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${task && task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${task && task.priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>
        <div id="subtasks-editor">
          <label class="form-label">Subtasks</label>
          <div id="modal-subtasks-list">
            ${task && task.subtasks ? task.subtasks.map((s) => `
              <div class="flex items-center gap-sm mb-sm">
                <input type="text" class="form-input subtask-input" value="${App.escapeHtml(s.title)}" placeholder="Subtask title">
                <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);" aria-label="Remove subtask">&times;</button>
              </div>
            `).join('') : ''}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-subtask-row">+ Add Subtask</button>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: isEdit ? 'Edit Task' : 'New Task',
      content,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" id="save-task">${isEdit ? 'Save Changes' : 'Create Task'}</button>
      `
    });

    modal.querySelector('#add-subtask-row').onclick = () => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-sm mb-sm';
      row.innerHTML = `
        <input type="text" class="form-input subtask-input" placeholder="Subtask title">
        <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);" aria-label="Remove subtask">&times;</button>
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
            <div class="flex items-center gap-xs flex-wrap">
              ${days.map((day, i) => `<button type="button" class="btn btn-secondary btn-sm day-toggle ${repeatDays.includes(i) ? 'active' : ''}" data-day="${i}">${day}</button>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-xs" id="select-every-day">Select Every Day</button>
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
              <label class="form-label">Due Date</label>
              <input type="date" name="dueDate" class="form-input" value="${task ? App.escapeHtml(task.dueDate) : Storage.formatDate(new Date())}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Due Time (Optional)</label>
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
    if (await App.confirm({ title: 'Delete Task?', message: 'This task will be permanently deleted.', confirmText: 'Delete', danger: true })) {
      Storage.deleteTask(id);
      renderTasks();
    }
  }

  return { init, openTaskModal };
})();

window.Tasks = Tasks;
