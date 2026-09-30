/**
 * StudyFlow - Task Manager Module
 * FIX: Swipe vs scroll conflict — added Y-delta threshold so diagonal scrolls
 *      don't accidentally trigger task completion swipe.
 * ENHANCED: Added subtask progress tracking, milestone notifications, and auto-complete logic
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
  }

  async function init() {
    initElements();
    setupEventListeners();
    setupSubtaskCallbacks();

    elements.taskList.innerHTML = `
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
      <div class="skeleton" style="height:100px;border-radius:20px;margin-bottom:1rem;"></div>
    `;
    await new Promise(r => setTimeout(r, 600));
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
    // Listen for subtask completions and provide feedback
    subtaskUnsubscribe = Storage.onSubtaskCompleted(({ taskId, subtask, task, progress }) => {
      console.log('[v0] Subtask completed:', subtask.title, `Progress: ${progress.percentage}%`);
      
      // Show milestone notifications at key percentages
      const milestone = SubtaskUtils.getMilestoneMessage(progress.percentage);
      if (milestone) {
        showMilestoneNotification(milestone, progress.percentage);
      }
      
      // Show completion toast with progress
      if (progress.isFullyComplete) {
        App.showToast(`All subtasks complete! Task "${task.title}" is done!`, 'success', 4000);
      } else {
        App.showToast(`Subtask complete: ${progress.completed}/${progress.total}`, 'success', 2500);
      }
    });
  }

  function showMilestoneNotification(message, percentage) {
    // Create milestone badge animation
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
    let tasks = Storage.getTasks();
    const allTasks = [...tasks];
    const todayStr = Storage.formatDate(new Date());

    const pendingCount = allTasks.filter(t => {
      if (t.type === 'repeating') return !Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr);
      return !t.completed;
    }).length;

    const badgeEl = document.getElementById('pending-tasks-badge');
    if (badgeEl) badgeEl.textContent = `${pendingCount} pending`;

    const completedToday = allTasks.filter(t => {
      if (t.type === 'repeating') return Storage.isRepeatingTaskCompletedOnDate(t.id, todayStr);
      return t.completed;
    }).length;
    const totalToday = allTasks.length;
    const pctToday = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

    const stripEl = document.getElementById('task-progress-strip');
    if (stripEl) {
      stripEl.innerHTML = `
        <div class="flex items-center justify-between mb-xs">
          <span style="font-size:12px;color:var(--text-secondary);">${completedToday} of ${totalToday} completed today</span>
          <span style="font-size:12px;color:var(--accent-text);font-weight:600;">${pctToday}%</span>
        </div>
        <div class="progress-bar-bg" style="height:6px;">
          <div class="progress-bar-fill" style="width:${pctToday}%;"></div>
        </div>
      `;
    }

    const sprintEl = document.getElementById('sprint-card');
    if (sprintEl) {
      const topPending = allTasks.find(t => !t.completed);
      if (topPending) {
        sprintEl.style.display = 'block';
        sprintEl.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--text-muted);font-weight:600;letter-spacing:0.04em;">Deep Focus Sprint</div>
              <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${App.escapeHtml(topPending.title)}</div>
            </div>
            <a href="timer.html?taskId=${App.escapeHtml(topPending.id)}" class="btn btn-primary btn-sm">Start Sprint</a>
          </div>
        `;
      } else {
        sprintEl.style.display = 'none';
      }
    }

    if (elements.subjectFilter && elements.subjectFilter.options.length === 1) {
      Storage.getSubjects().forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        elements.subjectFilter.appendChild(option);
      });
    }
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

      // Sort priority: 1. Completion status, 2. sortOrder, 3. Overdue status, 4. Due date
      if (aDone !== bDone) return aDone ? 1 : -1;
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
      if (a._isOverdue && !b._isOverdue) return -1;
      if (!a._isOverdue && b._isOverdue) return 1;
      // OPTIMIZATION: Use fast lexicographical string comparison instead of `new Date` to avoid allocations and parsing overhead.
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
        const card = cb.closest('.task-card');

        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (e.type === 'keydown') e.preventDefault();

        if (task.type === 'repeating') {
          const isCurrentlyDone = Storage.isRepeatingTaskCompletedOnDate(id, todayStr);
          Storage.setRepeatingTaskCompletedOnDate(id, todayStr, !isCurrentlyDone);
          if (!isCurrentlyDone) App.showToast('Task completed for today!', 'success');
          renderTasks();
        } else {
          if (!task.completed) {
            // Optimistically mark the card as completed visually
            card.style.opacity = '0.5';
            cb.classList.add('checked');

            // Stage the write — give user 5 seconds to undo
            const cancelFn = Storage.stageTaskCompletion(id, 5000, () => {
              Storage.completeTask(id);
              renderTasks();
            });

            App.showUndoToast('Task completed!', () => {
              // User clicked Undo — cancel the staged write and restore the card
              cancelFn();
              card.style.opacity = '';
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
        const subtaskItem = cb.closest('.subtask-item');
        
        if (isCompleting) {
          // Add animation before completion
          cb.classList.add('animating');
          if (subtaskItem) subtaskItem.classList.add('completing');
        }
        
        // Toggle the subtask via storage (triggers callbacks)
        Storage.toggleSubtask(taskId, subtaskId, isCompleting);
        
        // Re-render after a brief delay to show animation
        setTimeout(() => {
          renderTasks();
        }, 300);
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

    // ── Drag and Drop Reordering ────────────────────────────────────────────
    elements.taskList.querySelectorAll('.task-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dragging = elements.taskList.querySelector('.dragging');
        if (dragging && dragging !== card) {
          card.classList.add('drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        elements.taskList.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        const targetId = card.dataset.id;

        if (draggedId === targetId) return;

        const tasks = Storage.getTasks();
        const draggedIndex = tasks.findIndex(t => t.id === draggedId);
        const targetIndex = tasks.findIndex(t => t.id === targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [draggedTask] = tasks.splice(draggedIndex, 1);
          tasks.splice(targetIndex, 0, draggedTask);

          // Re-assign sortOrder based on new array positions
          tasks.forEach((t, i) => t.sortOrder = i);

          Storage.saveTasks(tasks);
          renderTasks();
        }
      });
    });

    // ── Swipe to complete (mobile) ──────────────────────────────────────────
    elements.taskList.querySelectorAll('.task-card').forEach(card => {
      let touchStartX = 0, touchStartY = 0, touchMoveX = 0, touchMoveY = 0;
      let swipeIntent = null; // 'swipe' | 'scroll' | null
      const id = card.dataset.id;
      const task = Storage.getTaskById(id);
      if (task.completed) return;

      card.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoveX = touchStartX;
        touchMoveY = touchStartY;
        swipeIntent = null;
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        touchMoveX = e.touches[0].clientX;
        touchMoveY = e.touches[0].clientY;
        const deltaX = touchMoveX - touchStartX;
        const deltaY = touchMoveY - touchStartY;

        // FIX: Determine intent on first significant movement
        if (swipeIntent === null && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
          // If moving more vertically than horizontally → scroll, not swipe
          swipeIntent = Math.abs(deltaY) > Math.abs(deltaX) ? 'scroll' : 'swipe';
        }

        if (swipeIntent === 'swipe' && deltaX > 0) {
          card.style.transform = `translateX(${deltaX}px)`;
          const hint = card.querySelector('.swipe-hint');
          if (hint) {
            hint.style.opacity = Math.min(deltaX / 100, 1);
            hint.style.left = '0';
          }
        }
      }, { passive: true });

      card.addEventListener('touchend', () => {
        const deltaX = touchMoveX - touchStartX;
        if (swipeIntent === 'swipe' && deltaX > 100) {
          card.style.transition = 'all 0.3s ease';
          card.style.transform = 'translateX(100%)';
          card.style.opacity = '0';
          setTimeout(() => {
            const cancelFn = Storage.stageTaskCompletion(id, 5000, () => {
              Storage.completeTask(id);
              renderTasks();
            });
            App.showUndoToast('Task swiped complete!', () => {
              cancelFn();
              renderTasks();  // re-render to restore the card
            });
          }, 300);
        } else {
          card.style.transition = 'transform 0.3s ease';
          card.style.transform = 'translateX(0)';
          const hint = card.querySelector('.swipe-hint');
          if (hint) hint.style.opacity = '0';
          setTimeout(() => { card.style.transition = ''; }, 300);
        }
        touchStartX = 0; touchStartY = 0;
        touchMoveX = 0; touchMoveY = 0;
        swipeIntent = null;
      });
    });
  }

  function openTaskModal(id = null) {
    const isEdit = !!id;
    const task = isEdit ? Storage.getTaskById(id) : null;
    const subjects = Storage.getSubjects();
    let selectedPriority = task ? task.priority : 'medium';

    const content = `
      <form id="task-form">
        <div class="form-group">
          <label class="form-label" for="task-title-input">Task Title *</label>
          <input type="text" id="task-title-input" name="title" class="form-input" placeholder="What needs to be done?" value="${task ? App.escapeHtml(task.title) : ''}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Scheduled for</label>
          <div class="grid-2">
            <input type="date" name="dueDate" class="form-input" value="${task ? App.escapeHtml(task.dueDate || Storage.formatDate(new Date())) : Storage.formatDate(new Date())}" required>
            <input type="time" name="dueTime" class="form-input" value="${task ? App.escapeHtml(task.dueTime || '') : ''}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="task-subject-select">Subject</label>
          <select id="task-subject-select" name="subject" class="form-select">
            ${subjects.map(s => `<option value="${App.escapeHtml(s.name)}" ${task && task.subject === s.name ? 'selected' : ''}>${App.escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Priority</label>
          <div class="priority-chips flex gap-xs flex-wrap" role="radiogroup" aria-label="Task Priority">
            ${['low', 'medium', 'high', 'critical'].map(p => `
              <button type="button" class="filter-tab priority-chip ${selectedPriority === p ? 'active' : ''}" data-priority="${p}">
                <span class="priority-dot priority-${p}"></span>
                ${p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            `).join('')}
          </div>
          <input type="hidden" name="priority" value="${selectedPriority}">
        </div>

        <details class="more-options-expander mb-md" ${task && (task.type !== 'one-time' || (task.subtasks && task.subtasks.length > 0)) ? 'open' : ''}>
          <summary class="form-label" style="cursor:pointer;color:var(--accent-text);padding:4px 0;user-select:none;">More options</summary>
          <div class="mt-sm">
            <div class="form-group">
              <label class="form-label">Task Type</label>
              <select name="type" class="form-select">
                <option value="one-time" ${!task || task.type === 'one-time' ? 'selected' : ''}>One-time</option>
                <option value="repeating" ${task && task.type === 'repeating' ? 'selected' : ''}>Repeating</option>
                <option value="date-range" ${task && task.type === 'date-range' ? 'selected' : ''}>Date Range</option>
              </select>
            </div>

            <div id="type-extra-container"></div>

            <div id="subtasks-editor" class="mt-md">
              <label class="form-label">Subtasks</label>
              <div id="modal-subtasks-list">
                ${task && task.subtasks ? task.subtasks.map((s) => `
                  <div class="flex items-center gap-sm mb-sm">
                    <input type="text" class="form-input subtask-input" value="${App.escapeHtml(s.title)}" placeholder="Subtask title">
                    <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);" aria-label="Remove subtask">&times;</button>
                  </div>
                `).join('') : ''}
              </div>
              <button type="button" class="btn btn-secondary btn-sm mt-xs" id="add-subtask-row">+ Add Subtask</button>
            </div>
          </div>
        </details>

        <button type="submit" class="btn btn-primary w-full" id="save-task">${isEdit ? 'Update Task' : 'Add Task'}</button>
      </form>
    `;

    const modal = App.createModal({
      title: isEdit ? 'Edit Task' : 'Add Task',
      content,
      id: 'add-task-sheet'
    });

    modal.classList.add('modal-bottom-sheet');

    modal.querySelectorAll('.priority-chip').forEach(chip => {
      chip.onclick = () => {
        modal.querySelectorAll('.priority-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedPriority = chip.dataset.priority;
        modal.querySelector('input[name="priority"]').value = selectedPriority;
      };
    });

    const typeSelect = modal.querySelector('select[name="type"]');
    const typeExtra = modal.querySelector('#type-extra-container');

    function updateTypeExtra(type) {
      if (type === 'repeating') {
        const days = ['S','M','T','W','T','F','S'];
        const repeatDays = task && task.repeatDays ? task.repeatDays : [new Date().getDay()];
        typeExtra.innerHTML = `
          <div class="form-group">
            <label class="form-label">Repeat On:</label>
            <div class="repeat-days-grid">
              ${days.map((day, i) => `<div class="day-toggle ${repeatDays.includes(i) ? 'active' : ''}" data-day="${i}">${day}</div>`).join('')}
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-sm" id="select-every-day">Select Every Day</button>
          </div>
        `;
        typeExtra.querySelectorAll('.day-toggle').forEach(el => el.addEventListener('click', () => el.classList.toggle('active')));
        typeExtra.querySelector('#select-every-day')?.addEventListener('click', () => typeExtra.querySelectorAll('.day-toggle').forEach(el => el.classList.add('active')));
      } else if (type === 'date-range') {
        typeExtra.innerHTML = `
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" name="startDate" class="form-input" value="${task ? App.escapeHtml(task.startDate || task.dueDate) : Storage.formatDate(new Date())}">
          </div>
        `;
      } else {
        typeExtra.innerHTML = '';
      }
    }

    typeSelect.addEventListener('change', (e) => updateTypeExtra(e.target.value));
    updateTypeExtra(task ? task.type : 'one-time');

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

    const form = modal.querySelector('#task-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = App.getFormData(form);
      const type = data.type || 'one-time';

      if (!data.title || !data.title.trim()) {
        App.showToast('Please enter a task title', 'warning');
        return;
      }

      const subtaskInputs = modal.querySelectorAll('.subtask-input');
      const subtasks = [];
      subtaskInputs.forEach((input, idx) => {
        if (input.value.trim()) {
          const existing = (task && task.subtasks && task.subtasks[idx]) ? task.subtasks[idx] : {};
          subtasks.push({
            id: existing.id || Storage.generateId(),
            title: input.value.trim(),
            isCompleted: existing.isCompleted || false,
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
        priority: data.priority || selectedPriority,
        dueTime: data.dueTime || null,
        subtasks,
        repeatDays,
        startDate: type === 'date-range' ? (data.startDate || data.dueDate) : (type === 'one-time' ? data.dueDate : null),
        dueDate: type === 'repeating' ? null : (data.dueDate || data.startDate)
      };

      isEdit ? Storage.updateTask(id, taskData) : Storage.addTask(taskData);
      App.showToast(isEdit ? 'Task updated' : 'Task added', 'success');
      App.closeModal(modal);
      renderTasks();
    };

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
