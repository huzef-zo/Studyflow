/**
 * StudyFlow - Tasks Module
 * Fully aligned with Stitch design system.
 */

const Tasks = (function() {
  'use strict';

  let currentFilter = 'all';
  let expandedTaskIds = new Set();

  function renderTasks() {
    const listEl = document.getElementById('task-list');
    if (!listEl) return;

    let tasks = Storage.getTasks ? Storage.getTasks() : [];
    const todayStr = Storage.formatDate(new Date());

    // Compute momentum stats
    const todayTasks = Storage.getTodayTasks ? Storage.getTodayTasks() : [];
    const completedTodayCount = todayTasks.filter(t => t.completed || (t.type === 'repeating' && Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr))).length;
    const totalTodayCount = todayTasks.length;
    const pctToday = totalTodayCount > 0 ? Math.min(100, Math.round((completedTodayCount / totalTodayCount) * 100)) : 0;

    const ratioText = document.getElementById('completion-ratio-text');
    const ratioBar = document.getElementById('completion-ratio-bar');
    if (ratioText) ratioText.textContent = `${completedTodayCount} of ${totalTodayCount} completed today`;
    if (ratioBar) ratioBar.style.width = `${pctToday}%`;

    const pendingCount = tasks.filter(t => !t.completed).length;
    const badgeEl = document.getElementById('pending-count-badge');
    if (badgeEl) badgeEl.textContent = `${pendingCount} pending`;

    // Filters
    const searchInput = document.getElementById('search-tasks');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (query) {
      tasks = tasks.filter(t => t.title.toLowerCase().includes(query) || (t.subject && t.subject.toLowerCase().includes(query)));
    }

    if (currentFilter === 'active') {
      tasks = tasks.filter(t => !t.completed);
    } else if (currentFilter === 'done') {
      tasks = tasks.filter(t => t.completed);
    } else if (currentFilter === 'priority') {
      tasks = tasks.filter(t => t.priority === 'high' || t.priority === 'critical');
    }

    if (tasks.length === 0) {
      listEl.innerHTML = App.createEmptyStateHtml({
        title: 'No tasks found',
        text: 'Initiate a new mission to begin tracking your progress.',
        icon: 'task_alt',
        actionText: 'Add task',
        actionId: 'empty-add-task-btn'
      });
      const emptyBtn = listEl.querySelector('#empty-add-task-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => App.openAddTaskModal());
      return;
    }

    // Sort: active first, then by priority / due date
    tasks.sort((a, b) => {
      const aDone = a.completed;
      const bDone = b.completed;
      if (aDone !== bDone) return aDone ? 1 : -1;
      const aDate = a.dueDate || '9999-99-99';
      const bDate = b.dueDate || '9999-99-99';
      return aDate < bDate ? -1 : (aDate > bDate ? 1 : 0);
    });

    listEl.innerHTML = tasks.map(task => {
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr) : task.completed;
      const isOverdue = !isDone && task.dueDate && Storage.isDateOverdue(task.dueDate);
      const isExpanded = expandedTaskIds.has(task.id);
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const subtaskDoneCount = hasSubtasks ? task.subtasks.filter(s => s.isCompleted).length : 0;

      const priorityDotColors = {
        low: 'bg-outline-variant',
        medium: 'bg-secondary',
        high: 'bg-tertiary',
        critical: 'bg-error'
      };

      const dueText = isOverdue
        ? `Overdue • ${Storage.getRelativeDays(task.dueDate)}`
        : (task.dueDate ? Storage.getRelativeDays(task.dueDate) : 'No due date');

      return `
        <div class="task-item group flex flex-col p-space-md rounded-DEFAULT ${isDone ? 'bg-surface-container-low opacity-65' : 'bg-surface-container'} shadow-sm transition-all hover:bg-surface-container-high" data-id="${App.escapeHtml(task.id)}">
          <div class="flex items-start gap-3">
            <button aria-label="${isDone ? 'Mark active' : 'Mark task done'}" class="task-checkbox mt-0.5 w-5 h-5 rounded-full ${isDone ? 'bg-primary-container text-surface-base' : 'bg-surface-container-highest text-transparent hover:text-primary'} flex items-center justify-center shrink-0 transition-colors" data-id="${App.escapeHtml(task.id)}">
              <span class="material-symbols-outlined text-[14px] leading-none font-bold">check</span>
            </button>
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="task-title font-headline-sm text-headline-sm ${isDone ? 'text-text-muted line-through' : 'text-text-primary'} truncate">${App.escapeHtml(task.title)}</span>
                <div class="flex items-center gap-2 shrink-0">
                  ${isOverdue ? '<span class="font-label-sm text-label-sm text-error bg-error-container/40 px-2 py-0.5 rounded-full">Overdue</span>' : ''}
                  ${hasSubtasks ? `<span class="font-label-sm text-label-sm text-primary-container bg-surface-container-highest px-2 py-0.5 rounded-full">${subtaskDoneCount}/${task.subtasks.length}</span>` : ''}
                  ${hasSubtasks ? `
                    <button aria-label="Toggle subtasks" class="subtask-toggle text-text-muted hover:text-text-primary flex items-center justify-center" data-id="${App.escapeHtml(task.id)}">
                      <span class="material-symbols-outlined text-[18px] transition-transform duration-200" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};">expand_more</span>
                    </button>
                  ` : ''}
                  <span class="w-2 h-2 rounded-full ${priorityDotColors[task.priority] || priorityDotColors.medium} shrink-0" title="Priority: ${App.escapeHtml(task.priority)}"></span>
                </div>
              </div>
              <div class="flex items-center gap-2 mt-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${App.getSubjectColor(task.subject)};"></span>
                  <span class="font-body-sm text-body-sm text-text-secondary">${App.escapeHtml(task.subject || 'General')}</span>
                </div>
                <span class="text-text-muted text-xs">•</span>
                <span class="font-body-sm text-body-sm ${isOverdue ? 'text-error' : 'text-text-muted'} flex items-center gap-1">
                  <span class="material-symbols-outlined text-[13px]">${isOverdue ? 'warning' : 'schedule'}</span>
                  ${App.escapeHtml(dueText)}${task.dueTime ? ` · ${App.escapeHtml(task.dueTime)}` : ''}
                </span>
              </div>

              ${hasSubtasks ? `
                <div class="subtask-list ${isExpanded ? 'flex' : 'hidden'} flex-col gap-2 mt-3 pt-3 bg-surface-container-low p-2.5 rounded-DEFAULT">
                  ${task.subtasks.map(sub => `
                    <div class="flex items-center justify-between gap-2.5">
                      <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <button class="subtask-checkbox w-4 h-4 rounded-full ${sub.isCompleted ? 'bg-primary-container text-surface-base' : 'bg-surface-container-highest text-transparent'} flex items-center justify-center shrink-0" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(sub.id)}" aria-label="Toggle ${App.escapeHtml(sub.title)}">
                          <span class="material-symbols-outlined text-[11px]">check</span>
                        </button>
                        <span class="font-body-sm text-body-sm ${sub.isCompleted ? 'text-text-muted line-through' : 'text-on-surface'} truncate">${App.escapeHtml(sub.title)}</span>
                      </div>
                      <div class="subtask-cycle-tracker flex items-center gap-1 text-[11px] text-text-secondary bg-surface-container-high px-2 py-0.5 rounded-full shrink-0">
                        <button class="dec-cycle text-text-muted hover:text-text-primary px-1" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(sub.id)}" aria-label="Decrease session count for ${App.escapeHtml(sub.title)}">-</button>
                        <span>${sub.completedCycles || 0} session(s)</span>
                        <button class="inc-cycle text-text-muted hover:text-text-primary px-1" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(sub.id)}" aria-label="Increase session count for ${App.escapeHtml(sub.title)}">+</button>
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

    // Wire checkbox staged 5s undo
    listEl.querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-id');
        const task = Storage.getTaskById(taskId);
        if (!task) return;

        if (task.type === 'repeating') {
          const isDone = Storage.isRepeatingTaskCompletedOnDate(taskId, todayStr);
          Storage.setRepeatingTaskCompletedOnDate(taskId, todayStr, !isDone);
          renderTasks();
          return;
        }

        if (task.completed) {
          Storage.uncompleteTask(taskId);
          renderTasks();
        } else {
          btn.classList.add('bg-primary-container', 'text-surface-base');
          btn.classList.remove('bg-surface-container-highest', 'text-transparent');

          const cancelFn = Storage.stageTaskCompletion(taskId, 5000, () => {
            Storage.completeTask(taskId);
            renderTasks();
          });

          App.showUndoToast('Task completed', () => {
            cancelFn();
            renderTasks();
          });
        }
      });
    });

    // Wire subtask toggle
    listEl.querySelectorAll('.subtask-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-id');
        if (expandedTaskIds.has(taskId)) {
          expandedTaskIds.delete(taskId);
        } else {
          expandedTaskIds.add(taskId);
        }
        renderTasks();
      });
    });

    // Subtask checkbox
    listEl.querySelectorAll('.subtask-checkbox').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        const subtaskId = btn.getAttribute('data-subtask-id');
        const task = Storage.getTaskById(taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        if (sub) {
          Storage.toggleSubtask(taskId, subtaskId, !sub.isCompleted);
          renderTasks();
        }
      });
    });

    // Subtask cycle +/- buttons
    listEl.querySelectorAll('.inc-cycle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        const subtaskId = btn.getAttribute('data-subtask-id');
        const task = Storage.getTaskById(taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        if (sub) {
          Storage.updateSubtask(taskId, subtaskId, { completedCycles: (sub.completedCycles || 0) + 1 });
          renderTasks();
        }
      });
    });

    listEl.querySelectorAll('.dec-cycle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.getAttribute('data-task-id');
        const subtaskId = btn.getAttribute('data-subtask-id');
        const task = Storage.getTaskById(taskId);
        const sub = task?.subtasks?.find(s => s.id === subtaskId);
        if (sub && (sub.completedCycles || 0) > 0) {
          Storage.updateSubtask(taskId, subtaskId, { completedCycles: sub.completedCycles - 1 });
          renderTasks();
        }
      });
    });

    // Row click opens edit modal
    listEl.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.task-checkbox') || e.target.closest('.subtask-toggle') || e.target.closest('.subtask-checkbox') || e.target.closest('.inc-cycle') || e.target.closest('.dec-cycle')) return;
        const taskId = item.getAttribute('data-id');
        const task = Storage.getTaskById(taskId);
        if (task) App.openAddTaskModal(task);
      });
    });
  }

  function setupFilterChips() {
    const chips = document.querySelectorAll('.task-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => {
          c.className = 'task-chip flex items-center justify-center px-4 py-1.5 rounded-full bg-surface-container-high text-text-secondary font-label-md text-label-md transition-all shrink-0 hover:text-text-primary';
          c.setAttribute('aria-selected', 'false');
        });
        chip.className = 'task-chip flex items-center justify-center px-4 py-1.5 rounded-full bg-primary-container text-surface-base font-label-md text-label-md font-semibold transition-all shrink-0 shadow-sm';
        chip.setAttribute('aria-selected', 'true');
        currentFilter = chip.getAttribute('data-filter') || 'all';
        renderTasks();
      });
    });

    const searchInput = document.getElementById('search-tasks');
    if (searchInput) {
      searchInput.addEventListener('input', App.debounce(() => renderTasks(), 250));
    }
  }

  function init() {
    setupFilterChips();
    renderTasks();

    window.addEventListener('studyflow_taskDataChanged', renderTasks);
    window.addEventListener('studyflow_task_updated', renderTasks);
  }

  return { init, renderTasks };
})();

window.Tasks = Tasks;
