/**
 * StudyFlow - Database Engine & Task Database Adapter
 * Supports Table, Kanban Board, and Calendar views operating directly over Storage.
 */

const Database = (function() {
  'use strict';

  let currentView = 'table';
  let groupByProperty = 'subject';
  let filterRules = [];
  let sortConfig = { property: 'dueDate', direction: 'asc' };

  function escapeText(text) {
    if (typeof App !== 'undefined' && App.escapeHtml) return App.escapeHtml(text);
    return String(text || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function getPriorityClass(p) {
    if (typeof App !== 'undefined' && App.getPriorityClass) return App.getPriorityClass(p);
    return 'priority-medium';
  }

  function getPriorityLabel(p) {
    if (typeof App !== 'undefined' && App.getPriorityLabel) return App.getPriorityLabel(p);
    return String(p || '');
  }

  function getTaskDatabaseItems() {
    const rawTasks = (typeof Storage !== 'undefined' && Storage.getTasks) ? Storage.getTasks() : [];
    return rawTasks.map(task => ({
      id: task.id,
      title: task.title || 'Untitled Objective',
      subject: task.subject || 'Other',
      priority: task.priority || 'medium',
      status: task.completed ? 'Completed' : 'Pending',
      dueDate: task.dueDate || '',
      type: task.type || 'one-time',
      raw: task
    }));
  }

  function applyFilterAndSort(items) {
    let filtered = [...items];

    filterRules.forEach(rule => {
      if (!rule.property || !rule.value) return;
      filtered = filtered.filter(item => {
        const val = String(item[rule.property] || '').toLowerCase();
        const target = String(rule.value).toLowerCase();
        if (rule.operator === 'equals') return val === target;
        if (rule.operator === 'contains') return val.includes(target);
        if (rule.operator === 'not_equals') return val !== target;
        return true;
      });
    });

    if (sortConfig.property) {
      filtered.sort((a, b) => {
        const aVal = String(a[sortConfig.property] || '');
        const bVal = String(b[sortConfig.property] || '');
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  function renderViewSwitcherContainer(containerEl, onSelectView) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="db-view-bar flex items-center justify-between flex-wrap gap-sm mb-md p-xs card">
        <div class="filter-tabs" role="tablist" aria-label="Database View Switcher">
          <button class="filter-tab ${currentView === 'table' ? 'active' : ''}" data-view="table" role="tab" aria-selected="${currentView === 'table'}">📊 Table</button>
          <button class="filter-tab ${currentView === 'board' ? 'active' : ''}" data-view="board" role="tab" aria-selected="${currentView === 'board'}">📋 Board</button>
          <button class="filter-tab ${currentView === 'calendar' ? 'active' : ''}" data-view="calendar" role="tab" aria-selected="${currentView === 'calendar'}">📅 Calendar</button>
        </div>

        <div class="flex items-center gap-sm flex-wrap">
          ${currentView === 'board' ? `
            <select id="db-group-by" class="form-input glass-pill-input" aria-label="Group by property">
              <option value="subject" ${groupByProperty === 'subject' ? 'selected' : ''}>Group by Subject</option>
              <option value="priority" ${groupByProperty === 'priority' ? 'selected' : ''}>Group by Priority</option>
              <option value="status" ${groupByProperty === 'status' ? 'selected' : ''}>Group by Status</option>
            </select>
          ` : ''}
          <button id="db-filter-btn" class="btn btn-secondary btn-sm" aria-label="Configure Filters">🔍 Filter</button>
          <button id="db-sort-btn" class="btn btn-secondary btn-sm" aria-label="Configure Sort">⇅ Sort</button>
        </div>
      </div>
    `;

    containerEl.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentView = tab.dataset.view;
        renderViewSwitcherContainer(containerEl, onSelectView);
        if (onSelectView) onSelectView(currentView);
      });
    });

    const groupByEl = containerEl.querySelector('#db-group-by');
    if (groupByEl) {
      groupByEl.addEventListener('change', (e) => {
        groupByProperty = e.target.value;
        if (onSelectView) onSelectView(currentView);
      });
    }

    const filterBtn = containerEl.querySelector('#db-filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', openFilterModal);
    }

    const sortBtn = containerEl.querySelector('#db-sort-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', openSortModal);
    }
  }

  function renderTableView(items) {
    if (items.length === 0) {
      return '<p class="text-secondary text-center py-md">No records found in database.</p>';
    }

    return `
      <div class="db-table-wrapper card" style="overflow-x: auto;">
        <table class="db-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-color); text-align: left; color: var(--text-muted);">
              <th style="padding: 10px;">Objective Title</th>
              <th style="padding: 10px;">Subject</th>
              <th style="padding: 10px;">Priority</th>
              <th style="padding: 10px;">Status</th>
              <th style="padding: 10px;">Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr style="border-bottom: 1px solid var(--border-color);" data-id="${item.id}">
                <td style="padding: 10px; font-weight: 500;">${escapeText(item.title)}</td>
                <td style="padding: 10px;"><span class="badge">${escapeText(item.subject)}</span></td>
                <td style="padding: 10px;"><span class="badge ${getPriorityClass(item.priority)}">${getPriorityLabel(item.priority)}</span></td>
                <td style="padding: 10px;"><span class="badge">${escapeText(item.status)}</span></td>
                <td style="padding: 10px;">${item.dueDate ? escapeText(item.dueDate) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderBoardView(items) {
    const groups = {};

    items.forEach(item => {
      const groupKey = item[groupByProperty] || 'Unassigned';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });

    return `
      <div class="db-board-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
        ${Object.keys(groups).map(groupName => `
          <div class="db-board-column card" style="background: var(--bg-surface); padding: 12px;">
            <div style="font-weight: 700; margin-bottom: 12px; color: var(--accent-text);" class="flex items-center justify-between">
              <span>${escapeText(groupName)}</span>
              <span class="badge">${groups[groupName].length}</span>
            </div>
            <div class="db-board-cards flex flex-col gap-sm">
              ${groups[groupName].map(item => `
                <div class="task-card ${getPriorityClass(item.priority)}" data-id="${item.id}" style="margin: 0; cursor: pointer;">
                  <div style="font-weight: 600; margin-bottom: 4px;">${escapeText(item.title)}</div>
                  <div class="flex items-center justify-between text-muted" style="font-size: 11px;">
                    <span>${escapeText(item.subject)}</span>
                    <span>${item.dueDate || ''}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCalendarView(items) {
    const eventsByDate = {};
    items.forEach(item => {
      if (item.dueDate) {
        if (!eventsByDate[item.dueDate]) eventsByDate[item.dueDate] = [];
        eventsByDate[item.dueDate].push(item);
      }
    });

    return `
      <div class="db-calendar-wrapper card" style="padding: 16px;">
        <h4 class="mb-md">Objective Calendar View</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${Object.keys(eventsByDate).sort().map(dateStr => `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
              <div style="font-weight: 700; color: var(--accent-fill); margin-bottom: 4px;">📅 ${escapeText(dateStr)}</div>
              ${eventsByDate[dateStr].map(item => `
                <div style="padding: 4px 8px; background: var(--bg-tertiary); border-radius: var(--radius-sm); margin-bottom: 4px; font-size: 12px;" class="flex items-center justify-between">
                  <span>${escapeText(item.title)}</span>
                  <span class="badge">${escapeText(item.subject)}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function openFilterModal() {
    if (typeof App === 'undefined') return;
    const modal = App.createModal({
      title: 'Filter Rules',
      content: `
        <div id="filter-modal-body" class="flex flex-col gap-sm">
          <p class="text-secondary" style="font-size:12px;">Add matching filter criteria below:</p>
          <div class="flex items-center gap-sm">
            <select id="filter-prop" class="form-input">
              <option value="subject">Subject</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
            <select id="filter-op" class="form-input">
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
            </select>
            <input type="text" id="filter-val" class="form-input" placeholder="Value..." />
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="clear">Clear All</button>
        <button class="btn btn-primary" data-action="apply">Apply Filters</button>
      `
    });

    modal.querySelector('[data-action="apply"]').onclick = () => {
      const prop = modal.querySelector('#filter-prop').value;
      const op = modal.querySelector('#filter-op').value;
      const val = modal.querySelector('#filter-val').value.trim();

      if (val) {
        filterRules = [{ property: prop, operator: op, value: val }];
      } else {
        filterRules = [];
      }
      App.closeModal(modal);
      window.dispatchEvent(new CustomEvent('studyflow_db_updated'));
    };

    modal.querySelector('[data-action="clear"]').onclick = () => {
      filterRules = [];
      App.closeModal(modal);
      window.dispatchEvent(new CustomEvent('studyflow_db_updated'));
    };

    App.openModal(modal);
  }

  function openSortModal() {
    if (typeof App === 'undefined') return;
    const modal = App.createModal({
      title: 'Sort Configuration',
      content: `
        <div class="flex flex-col gap-sm">
          <label class="form-label">Sort Property</label>
          <select id="sort-prop" class="form-input">
            <option value="dueDate" ${sortConfig.property === 'dueDate' ? 'selected' : ''}>Due Date</option>
            <option value="title" ${sortConfig.property === 'title' ? 'selected' : ''}>Title</option>
            <option value="priority" ${sortConfig.property === 'priority' ? 'selected' : ''}>Priority</option>
          </select>

          <label class="form-label mt-xs">Sort Direction</label>
          <select id="sort-dir" class="form-input">
            <option value="asc" ${sortConfig.direction === 'asc' ? 'selected' : ''}>Ascending</option>
            <option value="desc" ${sortConfig.direction === 'desc' ? 'selected' : ''}>Descending</option>
          </select>
        </div>
      `,
      footer: `<button class="btn btn-primary" data-action="apply">Apply Sort</button>`
    });

    modal.querySelector('[data-action="apply"]').onclick = () => {
      sortConfig.property = modal.querySelector('#sort-prop').value;
      sortConfig.direction = modal.querySelector('#sort-dir').value;
      App.closeModal(modal);
      window.dispatchEvent(new CustomEvent('studyflow_db_updated'));
    };

    App.openModal(modal);
  }

  return {
    getTaskDatabaseItems,
    applyFilterAndSort,
    renderViewSwitcherContainer,
    renderTableView,
    renderBoardView,
    renderCalendarView
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Database;
} else {
  window.Database = Database;
}
