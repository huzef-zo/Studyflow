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
    if (task.dueDate) {
      const timeHtml = task.dueTime ? `<span class="task-time" style="margin-left: 4px; font-size: 0.75rem; color: var(--text-secondary);">at ${task.dueTime}</span>` : '';
      dueDateHtml = `
        <span class="task-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          ${App.createDeadlineBadge(task.dueDate)}
          ${timeHtml}
        </span>
      `;
    }
    
    return `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
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
          <button class="btn btn-ghost btn-icon btn-sm edit-btn" aria-label="Edit task">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon btn-sm delete-btn" aria-label="Delete task">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
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
      Storage.incrementTasksCompleted();
      taskItem.classList.add('completed');
      App.showToast('Task completed!', 'success');
    } else {
      Storage.uncompleteTask(taskId);
      taskItem.classList.remove('completed');
      App.showToast('Task marked as incomplete', 'info');
    }
    
    // Re-render to update sorting
    setTimeout(renderTasks, 300);
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
    const task = isEdit ? Storage.getTaskById(taskId) : null;
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
                 value="${task ? App.escapeHtml(task.title) : ''}"
                 required>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="task-due-date">Due Date</label>
            <input type="date"
                   class="form-input"
                   id="task-due-date"
                   name="dueDate"
                   min="${today}"
                   value="${task && task.dueDate ? task.dueDate : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="task-due-time">Due Time</label>
            <input type="time"
                   class="form-input"
                   id="task-due-time"
                   name="dueTime"
                   value="${task && task.dueTime ? task.dueTime : ''}">
          </div>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="task-priority">Priority</label>
            <select class="form-select" id="task-priority" name="priority">
              <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${task && task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="critical" ${task && task.priority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="task-subject">Subject</label>
            <select class="form-select" id="task-subject" name="subject">
              ${subjects.map(s => `
                <option value="${App.escapeHtml(s.name)}" ${task && task.subject === s.name ? 'selected' : ''}>
                  ${App.escapeHtml(s.name)}
                </option>
              `).join('')}
            </select>
          </div>
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
    
    if (!data.title.trim()) {
      App.showToast('Please enter a task title', 'error');
      return;
    }
    
    if (editingTaskId) {
      // Update existing task
      Storage.updateTask(editingTaskId, {
        title: data.title.trim(),
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        priority: data.priority,
        subject: data.subject
      });
      App.showToast('Task updated', 'success');
    } else {
      // Add new task
      Storage.addTask({
        title: data.title.trim(),
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        priority: data.priority,
        subject: data.subject
      });
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
