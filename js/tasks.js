/**
 * StudyFlow - Task Manager Module
 * Handles task creation, listing, and updates with Premium UX
 */

const Tasks = (function() {
  'use strict';

  // DOM Elements
  let elements = {};
  let currentFilter = 'all';

  /**
   * Initialize DOM element references
   */
  function initElements() {
    elements = {
      taskList: document.getElementById('task-list'),
      addTaskBtn: document.getElementById('add-task-btn'),
      filterTabs: document.querySelectorAll('.filter-tab'),
      searchInput: document.getElementById('search-tasks'),
      priorityFilter: document.getElementById('filter-priority'),
      subjectFilter: document.getElementById('filter-subject')
    };
  }

  /**
   * Initialize Tasks module
   */
  async function init() {
    initElements();
    setupEventListeners();
    
    // Show skeleton
    elements.taskList.innerHTML = `
      <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 1rem;"></div>
      <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 1rem;"></div>
      <div class="skeleton" style="height: 100px; border-radius: 20px; margin-bottom: 1rem;"></div>
    `;

    // Artificial delay for smooth feel
    await new Promise(r => setTimeout(r, 600));
    renderTasks();
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    elements.addTaskBtn?.addEventListener('click', () => openTaskModal());
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderTasks();
      });
    });

    elements.searchInput?.addEventListener('input', renderTasks);
    elements.priorityFilter?.addEventListener('change', renderTasks);
    elements.subjectFilter?.addEventListener('change', renderTasks);
  }

  /**
   * Render tasks with premium glass cards
   */
  function renderTasks() {
    let tasks = Storage.getTasks();
    
    // Populate subject filter once
    if (elements.subjectFilter && elements.subjectFilter.options.length === 1) {
      const subjects = Storage.getSubjects();
      subjects.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        elements.subjectFilter.appendChild(option);
      });
    }

    // Apply filters
    if (currentFilter === 'pending') tasks = tasks.filter(t => !t.completed);
    if (currentFilter === 'completed') tasks = tasks.filter(t => t.completed);

    const searchTerm = elements.searchInput?.value.toLowerCase();
    if (searchTerm) {
      tasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm) || t.subject.toLowerCase().includes(searchTerm));
    }

    const priority = elements.priorityFilter?.value;
    if (priority && priority !== 'all') {
      tasks = tasks.filter(t => t.priority === priority);
    }

    const subject = elements.subjectFilter?.value;
    if (subject && subject !== 'all') {
      tasks = tasks.filter(t => t.subject === subject);
    }

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

    elements.taskList.innerHTML = tasks.sort((a,b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }).map((task, index) => {
      const priorityClass = `priority-${task.priority}`;
      const subjectColor = App.getSubjectColor(task.subject);
      const isExpanded = false; // Internal state not persisted for simplicity in this view
      const staggerClass = index < 5 ? `stagger-${index + 1}` : '';

      return `
        <div class="task-card ${priorityClass} ${task.completed ? 'completed' : ''} animate-fade-in ${staggerClass}" data-id="${task.id}">
          <div class="swipe-hint">Swipe to complete</div>
          <div class="flex items-start gap-md">
            <div class="task-checkbox ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
            <div class="flex-1">
              <div class="flex items-center gap-md mb-xs">
                <div class="subject-pill" style="--tag-color: ${App.hexToRgb(subjectColor)}">${App.escapeHtml(task.subject)}</div>
                ${task.priority === 'critical' ? '<span class="badge" style="--tag-color: var(--danger-rgb); font-size: 9px;">Critical</span>' : ''}
              </div>
              <div class="task-title-text" style="${task.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${App.escapeHtml(task.title)}</div>
              <div class="task-meta-text">
                Target: ${Storage.formatDisplayDate(task.dueDate)}
                ${task.dueTime ? ` • ${task.dueTime}` : ''}
              </div>

              ${task.subtasks && task.subtasks.length > 0 ? `
                <div class="subtasks-container">
                  ${task.subtasks.map(subtask => `
                    <div class="subtask-item">
                      <div class="subtask-checkbox ${subtask.isCompleted ? 'checked' : ''}"
                           data-task-id="${task.id}" data-subtask-id="${subtask.id}"></div>
                      <div class="subtask-title ${subtask.isCompleted ? 'completed' : ''}">${App.escapeHtml(subtask.title)}</div>
                      <div class="subtask-cycle-tracker">
                        <button class="cycle-btn dec-cycle" data-task-id="${task.id}" data-subtask-id="${subtask.id}">-</button>
                        <span>${subtask.completedCycles}/${subtask.estimatedCycles}</span>
                        <button class="cycle-btn inc-cycle" data-task-id="${task.id}" data-subtask-id="${subtask.id}">+</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            <div class="flex gap-xs">
               <button class="btn btn-ghost btn-icon btn-sm edit-task" data-id="${task.id}" style="color: var(--text-muted);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
               <button class="btn btn-ghost btn-icon btn-sm del-task" data-id="${task.id}" style="color: var(--text-muted);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    elements.taskList.querySelectorAll('.task-checkbox').forEach(cb => {
      cb.onclick = (e) => {
        e.stopPropagation();
        const id = cb.dataset.id;
        const task = Storage.getTaskById(id);
        const card = cb.closest('.task-card');

        if (!task.completed) {
          // Success animation
          card.style.transform = 'scale(0.95)';
          card.style.opacity = '0.5';
          setTimeout(() => {
            Storage.completeTask(id);
            renderTasks();
          }, 300);
        } else {
          Storage.uncompleteTask(id);
          renderTasks();
        }
      };
    });

    elements.taskList.querySelectorAll('.subtask-checkbox').forEach(cb => {
      cb.onclick = (e) => {
        e.stopPropagation();
        const taskId = cb.dataset.taskId;
        const subtaskId = cb.dataset.subtaskId;
        const isCompleted = !cb.classList.contains('checked');
        Storage.toggleSubtask(taskId, subtaskId, isCompleted);
        renderTasks();
      };
    });

    elements.taskList.querySelectorAll('.inc-cycle').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        const subtaskId = btn.dataset.subtaskId;
        const task = Storage.getTaskById(taskId);
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        Storage.updateSubtask(taskId, subtaskId, { completedCycles: subtask.completedCycles + 1 });
        renderTasks();
      };
    });

    elements.taskList.querySelectorAll('.dec-cycle').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.taskId;
        const subtaskId = btn.dataset.subtaskId;
        const task = Storage.getTaskById(taskId);
        const subtask = task.subtasks.find(s => s.id === subtaskId);
        if (subtask.completedCycles > 0) {
          Storage.updateSubtask(taskId, subtaskId, { completedCycles: subtask.completedCycles - 1 });
          renderTasks();
        }
      };
    });
    
    elements.taskList.querySelectorAll('.edit-task').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openTaskModal(btn.dataset.id);
      };
    });

    elements.taskList.querySelectorAll('.del-task').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        deleteTask(btn.dataset.id);
      };
    });
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
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Target Date</label>
            <input type="date" name="dueDate" class="form-input" value="${task ? task.dueDate : Storage.formatDate(new Date())}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Target Time (Optional)</label>
            <input type="time" name="dueTime" class="form-input" value="${task ? task.dueTime || '' : ''}">
          </div>
        </div>

        <div id="subtasks-editor">
          <label class="form-label">Sub-missions</label>
          <div id="modal-subtasks-list">
            ${task && task.subtasks ? task.subtasks.map((s, idx) => `
              <div class="flex items-center gap-sm mb-sm">
                <input type="text" class="form-input subtask-input" value="${App.escapeHtml(s.title)}" placeholder="Sub-mission title">
                <input type="number" class="form-input subtask-cycles" value="${s.estimatedCycles}" style="width: 60px;" title="Estimated Cycles">
                <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color: var(--danger);">&times;</button>
              </div>
            `).join('') : ''}
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="add-subtask-row">+ Add Sub-mission</button>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: isEdit ? 'Modify Objective' : 'Initiate Objective',
      content: content,
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
        <input type="number" class="form-input subtask-cycles" value="1" style="width: 60px;" title="Estimated Cycles">
        <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color: var(--danger);">&times;</button>
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

      // Collect subtasks
      const subtaskInputs = modal.querySelectorAll('.subtask-input');
      const cycleInputs = modal.querySelectorAll('.subtask-cycles');
      const subtasks = [];

      subtaskInputs.forEach((input, idx) => {
        if (input.value.trim()) {
          const existing = (task && task.subtasks && task.subtasks[idx]) ? task.subtasks[idx] : {};
          subtasks.push({
            id: existing.id || Storage.generateId(),
            title: input.value.trim(),
            isCompleted: existing.isCompleted || false,
            estimatedCycles: parseInt(cycleInputs[idx].value) || 1,
            completedCycles: existing.completedCycles || 0
          });
        }
      });

      data.subtasks = subtasks;

      if (data.title) {
        isEdit ? Storage.updateTask(id, data) : Storage.addTask(data);
        App.closeModal();
        renderTasks();
      }
    };
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
