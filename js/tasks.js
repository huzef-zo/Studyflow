/**
 * StudyFlow - Tasks Module
 * Handles task management UI and interactions
 */

const Tasks = (function() {
  'use strict';

  // State
  let currentFilter = 'all';
  let currentPriorityFilter = 'all';
  let currentSubjectFilter = 'all';
  let searchQuery = '';
  let editingTaskId = null;

  // DOM Elements cache
  let elements = {};

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      taskList: document.getElementById('task-list'),
      searchInput: document.getElementById('search-input'),
      filterTabs: document.querySelectorAll('.tab[data-filter]'),
      priorityFilter: document.getElementById('priority-filter'),
      subjectFilter: document.getElementById('subject-filter'),
      addTaskBtn: document.getElementById('add-task-btn'),
      taskModal: null
    };
  }

  /**
   * Render a single task item
   */
  function renderTaskItem(task) {
    const subjectColor = App.getSubjectColor(task.subject);
    const priorityClass = App.getPriorityClass(task.priority);
    const priorityLabel = App.getPriorityLabel(task.priority);
    
    let dueDateHtml = '';
    const timeHtml = task.dueTime ? `<span class="task-time" style="margin-left: 4px; font-size: 0.75rem; color: var(--text-secondary);">at ${task.dueTime}</span>` : '';

    if (task.type === 'repeating') {
      const repeatLabel = App.getRepeatDaysLabel(task.repeatDays);
      dueDateHtml = `
        <span class="task-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.3-4.3"/><path d="M18 8A10 10 0 0 0 8 18"/><path d="M18 8h-4"/><path d="M18 8v4"/><path d="M21.1 12a9 9 0 0 0-9-9"/><path d="M11.9 21.1a9 9 0 0 1-9-9"/><path d="M2 12a10 10 0 0 1 10-10"/></svg>
          ${repeatLabel} ${timeHtml}
        </span>
      `;
    } else if (task.dueDate) {
      const dateBadge = App.createDateRangeBadge(task.startDate, task.dueDate);
      dueDateHtml = `
        <span class="task-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          ${dateBadge}
          ${timeHtml}
        </span>
      `;
    }

    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const progressHtml = hasSubtasks ? App.createProgressBar(task.subtasks.filter(s => s.isCompleted).length, task.subtasks.length, 'Sub-tasks Progress') : '';
    
    const subtasksHtml = `
      <div class="subtasks-container">
        <div class="subtask-list">
          ${(task.subtasks || []).map(subtask => `
            <div class="subtask-item ${subtask.isCompleted ? 'completed' : ''}" data-subtask-id="${subtask.id}">
              <div class="subtask-item-main">
                <input type="checkbox" class="subtask-checkbox" ${subtask.isCompleted ? 'checked' : ''}>
                <span class="subtask-title">${App.escapeHtml(subtask.title)}</span>
              </div>
              <div class="subtask-cycle-tracker">
                <button class="btn-cycle-adjust dec" aria-label="Decrease cycle">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span class="subtask-cycles-display">
                  <span class="completed-count">${subtask.completedCycles || 0}</span> / <span class="estimated-count">${subtask.estimatedCycles}</span>
                </span>
                <button class="btn-cycle-adjust inc" aria-label="Increase cycle">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        <form class="add-subtask-form">
          <input type="text" class="form-input" placeholder="New sub-task title..." required>
          <input type="number" class="form-input" value="1" min="1" style="width: 70px;" required>
          <button type="submit" class="btn btn-primary btn-sm">Add</button>
        </form>
      </div>
    `;

    return `
      <div class="task-item task-item-column ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <div class="task-item-main">
          <div class="task-checkbox">
            <input type="checkbox"
                   ${task.completed ? 'checked' : ''}
                   aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}">
          </div>
          <div class="task-content">
            <div class="task-title">${App.escapeHtml(task.title)}</div>
            <div class="task-meta">
              ${dueDateHtml}
              <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
              <span class="subject-badge" style="--subject-color: ${subjectColor};">${App.escapeHtml(task.subject)}</span>
            </div>
          </div>
          <div class="task-actions">
            <button class="btn btn-ghost btn-icon btn-sm task-expand-btn" aria-label="Expand task">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm edit-btn" aria-label="Edit task">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm delete-btn" aria-label="Delete task">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${progressHtml}
        ${subtasksHtml}
      </div>
    `;
  }

  /**
   * Render the task list
   */
  function renderTasks() {
    let tasks = Storage.getTasks();
    
    // Apply status filter
    if (currentFilter === 'pending') {
      tasks = tasks.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
      tasks = tasks.filter(t => t.completed);
    }
    
    // Apply priority filter
    if (currentPriorityFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === currentPriorityFilter);
    }
    
    // Apply subject filter
    if (currentSubjectFilter !== 'all') {
      tasks = tasks.filter(t => t.subject === currentSubjectFilter);
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tasks = tasks.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query)
      );
    }
    
    // Sort: uncompleted first, then by due date
    tasks.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Render
    if (tasks.length === 0) {
      elements.taskList.innerHTML = '';
      const emptyState = App.createEmptyState(
        'No tasks found',
        searchQuery 
          ? 'Try adjusting your search or filters' 
          : 'Add your first task to get started',
        'Add Task',
        () => openTaskModal()
      );
      elements.taskList.appendChild(emptyState);
      return;
    }
    
    elements.taskList.innerHTML = tasks.map(renderTaskItem).join('');
    attachTaskListeners();
  }

  /**
   * Attach event listeners to task items
   */
  function attachTaskListeners() {
    // Checkbox listeners
    elements.taskList.querySelectorAll('.task-checkbox input').forEach(checkbox => {
      checkbox.addEventListener('change', handleTaskToggle);
    });

    // Subtask checkbox listeners
    elements.taskList.querySelectorAll('.subtask-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', handleSubtaskToggle);
    });

    // Subtask cycle adjustment listeners
    elements.taskList.querySelectorAll('.btn-cycle-adjust').forEach(btn => {
      btn.addEventListener('click', handleSubtaskCycleAdjust);
    });

    // Task expansion listeners
    elements.taskList.querySelectorAll('.task-expand-btn').forEach(btn => {
      btn.addEventListener('click', handleExpandClick);
    });

    // Add subtask form listeners
    elements.taskList.querySelectorAll('.add-subtask-form').forEach(form => {
      form.addEventListener('submit', handleAddSubtaskSubmit);
    });
    
    // Edit button listeners
    elements.taskList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', handleEditClick);
    });
    
    // Delete button listeners
    elements.taskList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteClick);
    });
  }

  /**
   * Handle task completion toggle
   */
  function handleTaskToggle(e) {
    const taskItem = e.target.closest('.task-item');
    const taskId = taskItem.dataset.taskId;
    const isChecked = e.target.checked;
    
    if (isChecked) {
      Storage.completeTask(taskId);
      taskItem.classList.add('completed');
      App.showToast('Task completed!', 'success');
    } else {
      Storage.uncompleteTask(taskId);
      taskItem.classList.remove('completed');
      App.showToast('Task marked as incomplete', 'info');
    }
    
    // Re-render to update sorting and subtasks
    setTimeout(renderTasks, 300);
  }

  /**
   * Handle subtask completion toggle
   */
  function handleSubtaskToggle(e) {
    const taskItem = e.target.closest('.task-item');
    const subtaskItem = e.target.closest('.subtask-item');
    const taskId = taskItem.dataset.taskId;
    const subtaskId = subtaskItem.dataset.subtaskId;
    const isChecked = e.target.checked;

    Storage.toggleSubtask(taskId, subtaskId, isChecked);

    // Re-render to update main task status and progress bar
    renderTasks();

    // Keep expanded
    const newTaskItem = elements.taskList.querySelector(`[data-task-id="${taskId}"]`);
    if (newTaskItem) newTaskItem.classList.add('expanded');
  }

  /**
   * Handle subtask cycle adjustment
   */
  function handleSubtaskCycleAdjust(e) {
    const btn = e.target.closest('.btn-cycle-adjust');
    const subtaskItem = btn.closest('.subtask-item');
    const taskItem = subtaskItem.closest('.task-item');
    const taskId = taskItem.dataset.taskId;
    const subtaskId = subtaskItem.dataset.subtaskId;

    const task = Storage.getTaskById(taskId);
    if (!task || !task.subtasks) return;

    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    let completedCycles = subtask.completedCycles || 0;

    if (btn.classList.contains('inc')) {
      completedCycles++;
    } else if (btn.classList.contains('dec')) {
      completedCycles = Math.max(0, completedCycles - 1);
    }

    Storage.updateSubtask(taskId, subtaskId, { completedCycles: completedCycles });

    // Re-render
    renderTasks();

    // Keep expanded
    const newTaskItem = elements.taskList.querySelector(`[data-task-id="${taskId}"]`);
    if (newTaskItem) newTaskItem.classList.add('expanded');
  }

  /**
   * Handle expansion toggle
   */
  function handleExpandClick(e) {
    const taskItem = e.target.closest('.task-item');
    taskItem.classList.toggle('expanded');
  }

  /**
   * Handle add subtask submission
   */
  function handleAddSubtaskSubmit(e) {
    e.preventDefault();
    const taskItem = e.target.closest('.task-item');
    const taskId = taskItem.dataset.taskId;
    const inputs = e.target.querySelectorAll('input');
    const title = inputs[0].value.trim();
    const cycles = parseInt(inputs[1].value);

    if (title) {
      Storage.addSubtask(taskId, {
        title: title,
        estimatedCycles: cycles
      });

      renderTasks();

      // Keep expanded
      const newTaskItem = elements.taskList.querySelector(`[data-task-id="${taskId}"]`);
      if (newTaskItem) newTaskItem.classList.add('expanded');

      App.showToast('Sub-task added', 'success');
    }
  }

  /**
   * Handle edit button click
   */
  function handleEditClick(e) {
    const taskItem = e.target.closest('.task-item');
    const taskId = taskItem.dataset.taskId;
    openTaskModal(taskId);
  }

  /**
   * Handle delete button click
   */
  async function handleDeleteClick(e) {
    const taskItem = e.target.closest('.task-item');
    const taskId = taskItem.dataset.taskId;
    const task = Storage.getTaskById(taskId);
    
    const confirmed = await App.confirm({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    
    if (confirmed) {
      Storage.deleteTask(taskId);
      App.showToast('Task deleted', 'success');
      renderTasks();
    }
  }

  /**
   * Open task modal for add/edit
   */
  function openTaskModal(taskId = null) {
    editingTaskId = taskId;
    const isEdit = !!taskId;
    const task = isEdit ? Storage.getTaskById(taskId) : { type: 'one-time' };
    const subjects = Storage.getSubjects();
    
    const today = Storage.formatDate(new Date());
    
    const content = `
      <form id="task-form">
        <div class="form-group">
          <label class="form-label" for="task-title">Task Title *</label>
          <input type="text" 
                 class="form-input" 
                 id="task-title" 
                 name="title" 
                 placeholder="What needs to be done?"
                 value="${isEdit ? App.escapeHtml(task.title) : ''}"
                 required>
        </div>

        <div class="form-group">
          <label class="form-label">Task Type</label>
          <div class="task-type-selector">
            <label class="task-type-option">
              <span class="task-type-label">Repeating Task</span>
              <input type="radio" name="type" value="repeating" ${task.type === 'repeating' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">One-time Task</span>
              <input type="radio" name="type" value="one-time" ${task.type === 'one-time' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">Date Range Task</span>
              <input type="radio" name="type" value="date-range" ${task.type === 'date-range' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
          </div>
        </div>

        <div id="date-inputs-container">
          <!-- Dynamically filled -->
        </div>

        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="task-due-time">Due Time</label>
            <input type="time"
                   class="form-input"
                   id="task-due-time"
                   name="dueTime"
                   value="${isEdit && task.dueTime ? task.dueTime : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="task-priority">Priority</label>
            <select class="form-select" id="task-priority" name="priority">
              <option value="low" ${isEdit && task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${!isEdit || task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${isEdit && task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${isEdit && task.priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="task-subject">Subject</label>
          <select class="form-select" id="task-subject" name="subject">
            ${subjects.map(s => `
              <option value="${App.escapeHtml(s.name)}" ${isEdit && task.subject === s.name ? 'selected' : ''}>
                ${App.escapeHtml(s.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Sub-tasks (Title, Estimated Cycles, Completed Cycles)</label>
          <div id="modal-subtask-list" class="subtask-list">
            ${isEdit && task.subtasks ? task.subtasks.map((s) => `
              <div class="subtask-item modal-subtask-item" data-subtask-id="${s.id}" data-completed-cycles="${s.completedCycles || 0}">
                <input type="checkbox" class="subtask-checkbox" ${s.isCompleted ? 'checked' : ''}>
                <input type="text" class="form-input modal-subtask-title" value="${App.escapeHtml(s.title)}" placeholder="Title">
                <input type="number" class="form-input modal-subtask-cycles" value="${s.estimatedCycles}" min="1" title="Estimated Cycles">
                <input type="number" class="form-input modal-subtask-completed-cycles" value="${s.completedCycles || 0}" min="0" title="Completed Cycles">
                <button type="button" class="btn btn-ghost btn-icon btn-sm remove-subtask-btn" style="width: 36px; height: 36px;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            `).join('') : ''}
          </div>
          <button type="button" class="btn btn-secondary btn-sm mt-sm" id="modal-add-subtask-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            Add Sub-task
          </button>
        </div>
      </form>
    `;
    
    const modal = App.createModal({
      id: 'task-modal',
      title: isEdit ? 'Edit Task' : 'Add New Task',
      content: content,
      footer: `
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button type="submit" form="task-form" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Task'}</button>
      `,
      onClose: () => { editingTaskId = null; }
    });

    const dateContainer = modal.querySelector('#date-inputs-container');

    function updateDateInputs(type) {
      if (type === 'repeating') {
        const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const repeatDays = isEdit ? (task.repeatDays || []) : [];
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label">Repeat On:</label>
            <div class="repeat-days-grid">
              ${days.map((day, i) => `
                <div class="day-toggle ${repeatDays.includes(i) ? 'active' : ''}" data-day="${i}">${day}</div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-sm" id="select-every-day">Select Every Day</button>
          </div>
        `;

        dateContainer.querySelectorAll('.day-toggle').forEach(el => {
          el.addEventListener('click', () => {
            el.classList.toggle('active');
          });
        });

        dateContainer.querySelector('#select-every-day').addEventListener('click', () => {
          dateContainer.querySelectorAll('.day-toggle').forEach(el => el.classList.add('active'));
        });

      } else if (type === 'date-range') {
        dateContainer.innerHTML = `
          <div class="grid grid-2">
            <div class="form-group">
              <label class="form-label" for="task-start-date">Start Date</label>
              <input type="date" class="form-input" id="task-start-date" name="startDate" value="${isEdit && task.startDate ? task.startDate : today}">
            </div>
            <div class="form-group">
              <label class="form-label" for="task-due-date">Due Date</label>
              <input type="date" class="form-input" id="task-due-date" name="dueDate" min="${today}" value="${isEdit && task.dueDate ? task.dueDate : today}">
            </div>
          </div>
        `;
      } else {
        dateContainer.innerHTML = `
          <div class="form-group">
            <label class="form-label" for="task-due-date">Due Date</label>
            <input type="date" class="form-input" id="task-due-date" name="dueDate" min="${today}" value="${isEdit && task.dueDate ? task.dueDate : today}">
          </div>
        `;
      }
    }

    modal.querySelectorAll('input[name="type"]').forEach(radio => {
      radio.addEventListener('change', (e) => updateDateInputs(e.target.value));
    });

    updateDateInputs(task.type);

    // Modal subtask management
    const modalSubtaskList = modal.querySelector('#modal-subtask-list');
    const modalAddSubtaskBtn = modal.querySelector('#modal-add-subtask-btn');

    modalAddSubtaskBtn.addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'subtask-item modal-subtask-item';
      div.innerHTML = `
        <input type="checkbox" class="subtask-checkbox">
        <input type="text" class="form-input modal-subtask-title" placeholder="Sub-task title...">
        <input type="number" class="form-input modal-subtask-cycles" value="1" min="1" title="Estimated Cycles">
        <input type="number" class="form-input modal-subtask-completed-cycles" value="0" min="0" title="Completed Cycles">
        <button type="button" class="btn btn-ghost btn-icon btn-sm remove-subtask-btn" style="width: 36px; height: 36px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      modalSubtaskList.appendChild(div);
      div.querySelector('.remove-subtask-btn').addEventListener('click', () => div.remove());
      div.querySelector('input[type="text"]').focus();
    });

    modalSubtaskList.querySelectorAll('.remove-subtask-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.subtask-item').remove());
    });
    
    // Form submission
    const form = modal.querySelector('#task-form');
    form.addEventListener('submit', handleTaskFormSubmit);
    
    // Cancel button
    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      App.closeModal(modal);
    });
    
    App.openModal(modal);
    
    // Focus title input
    setTimeout(() => {
      document.getElementById('task-title').focus();
    }, 100);
  }

  /**
   * Handle task form submission
   */
  function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
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

    // Collect subtasks
    const subtasks = [];
    form.querySelectorAll('#modal-subtask-list .subtask-item').forEach(item => {
      const titleInput = item.querySelector('.modal-subtask-title');
      const cyclesInput = item.querySelector('.modal-subtask-cycles');
      const completedCyclesInput = item.querySelector('.modal-subtask-completed-cycles');
      const checkbox = item.querySelector('.subtask-checkbox');
      const title = titleInput.value.trim();
      const cycles = parseInt(cyclesInput.value);
      const completedCycles = parseInt(completedCyclesInput.value) || 0;
      const existingId = item.dataset.subtaskId;

      if (title) {
        subtasks.push({
          id: existingId || Storage.generateId(),
          title: title,
          isCompleted: checkbox.checked,
          estimatedCycles: cycles,
          completedCycles: completedCycles
        });
      }
    });

    const taskData = {
      title: data.title.trim(),
      type: type,
      startDate: type === 'date-range' ? (data.startDate || data.dueDate) : (type === 'one-time' ? data.dueDate : null),
      dueDate: (type === 'repeating') ? null : (data.dueDate || data.startDate),
      dueTime: data.dueTime || null,
      priority: data.priority,
      subject: data.subject,
      repeatDays: repeatDays,
      subtasks: subtasks
    };

    if (editingTaskId) {
      // Update existing task
      Storage.updateTask(editingTaskId, taskData);
      App.showToast('Task updated', 'success');
    } else {
      // Add new task
      Storage.addTask(taskData);
      App.showToast('Task added', 'success');
    }
    
    App.closeModal();
    renderTasks();
  }

  /**
   * Populate subject filter dropdown
   */
  function populateSubjectFilter() {
    const subjects = Storage.getSubjects();
    const select = elements.subjectFilter;
    
    if (!select) return;
    
    select.innerHTML = `
      <option value="all">All Subjects</option>
      ${subjects.map(s => `
        <option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>
      `).join('')}
    `;
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Filter tabs
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderTasks();
      });
    });
    
    // Priority filter
    if (elements.priorityFilter) {
      elements.priorityFilter.addEventListener('change', (e) => {
        currentPriorityFilter = e.target.value;
        renderTasks();
      });
    }
    
    // Subject filter
    if (elements.subjectFilter) {
      elements.subjectFilter.addEventListener('change', (e) => {
        currentSubjectFilter = e.target.value;
        renderTasks();
      });
    }
    
    // Search input
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', App.debounce((e) => {
        searchQuery = e.target.value.trim();
        renderTasks();
      }, 300));
    }
    
    // Add task button
    if (elements.addTaskBtn) {
      elements.addTaskBtn.addEventListener('click', () => openTaskModal());
    }
    
    // Check URL params for auto-open
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add') {
      setTimeout(() => openTaskModal(), 100);
    }
  }

  /**
   * Initialize Tasks module
   */
  function init() {
    initElements();
    populateSubjectFilter();
    setupEventListeners();
    renderTasks();
  }

  // Public API
  return {
    init,
    renderTasks,
    openTaskModal
  };
})();

// Make Tasks available globally
window.Tasks = Tasks;
