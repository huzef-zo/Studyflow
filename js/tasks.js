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
      tab.onclick = () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        renderTasks();
      };
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
        App.showToast(`All sub-missions complete! Objective "${App.escapeHtml(task.title)}" is done!`, 'success', 4000);
      } else {
        App.showToast(`Sub-mission complete: ${progress.completed}/${progress.total}`, 'success', 2500);
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
      return new Date(a.dueDate) - new Date(b.dueDate);
    }).map((task, index) => {
      const isDone = task.type === 'repeating' ? Storage.isRepeatingTaskCompletedOnDate(task.id, todayStr) : task.completed;
      const priorityClass = `priority-${App.escapeHtml(task.priority)}`;
      const subjectColor = App.getSubjectColor(task.subject);
      const isExpanded = expandedTasks.has(task.id);
      const staggerClass = index < 5 ? `stagger-${index + 1}` : '';
      return `
        <div class="task-card ${priorityClass} ${isDone ? 'completed' : ''} animate-fade-in ${staggerClass}" data-id="${App.escapeHtml(task.id)}">
          <div class="swipe-hint">Swipe to complete</div>
          <div class="flex items-start gap-md">
            <div class="task-checkbox ${isDone ? 'checked' : ''}" data-id="${App.escapeHtml(task.id)}" style="margin-top:4px;" tabindex="0" role="checkbox" aria-checked="${isDone}" aria-label="${isDone ? 'Mark as incomplete' : 'Mark as complete'}: ${App.escapeHtml(task.title)}"></div>
            <div class="flex-1 min-w-0">
              <div class="task-header-inline">
                <div class="task-title-text" style="${isDone ? 'text-decoration:line-through;opacity:0.5;' : ''}">${App.escapeHtml(task.title)}</div>
                <div class="subject-pill" style="--tag-color:${App.hexToRgb(subjectColor)};color:white;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);">${App.escapeHtml(task.subject)}</div>
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
                        <button class="cycle-btn dec-cycle" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(subtask.id)}">-</button>
                        <span>${subtask.completedCycles}/${subtask.estimatedCycles}</span>
                        <button class="cycle-btn inc-cycle" data-task-id="${App.escapeHtml(task.id)}" data-subtask-id="${App.escapeHtml(subtask.id)}">+</button>
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

    const content = `
      <form id="task-form">
        <div class="form-group">
          <label class="form-label">Objective Title</label>
          <input type="text" name="title" class="form-input" value="${task ? App.escapeHtml(task.title) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Task Type</label>
          <div class="task-type-selector">
            <label class="task-type-option">
              <span class="task-type-label">One-time</span>
              <input type="radio" name="type" value="one-time" ${!task || task.type === 'one-time' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">Repeating</span>
              <input type="radio" name="type" value="repeating" ${task && task.type === 'repeating' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
            <label class="task-type-option">
              <span class="task-type-label">Date Range</span>
              <input type="radio" name="type" value="date-range" ${task && task.type === 'date-range' ? 'checked' : ''}>
              <span class="radio-circle"></span>
            </label>
          </div>
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
                <input type="number" class="form-input subtask-cycles" value="${s.estimatedCycles}" style="width:60px;" title="Estimated Cycles">
                <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);">&times;</button>
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
        <input type="number" class="form-input subtask-cycles" value="1" style="width:60px;" title="Estimated Cycles">
        <button type="button" class="btn btn-ghost btn-icon remove-subtask-row" style="color:var(--danger);">&times;</button>
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
      const type = form.querySelector('input[name="type"]:checked').value;

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

    modal.querySelectorAll('input[name="type"]').forEach(radio => {
      radio.addEventListener('change', (e) => updateDateInputs(e.target.value));
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
