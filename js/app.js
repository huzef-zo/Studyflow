/**
 * StudyFlow - Main Application Shell & Core Utilities
 * Fully aligned with Stitch design system.
 */

const App = (function() {
  'use strict';

  function getUserInitials() {
    const user = Storage.getUser ? Storage.getUser() : null;
    const name = user && user.name ? user.name.trim() : 'User';
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    const pageMap = {
      'index.html': 'home', '': 'home',
      'tasks.html': 'tasks', 'calendar.html': 'calendar',
      'timer.html': 'focus', 'goals.html': 'goals',
      'notes.html': 'notes',
      'history.html': 'analytics', 'settings.html': 'settings'
    };
    return pageMap[filename] || 'home';
  }

  function renderHeader() {
    const initials = getUserInitials();
    return `
      <header class="fixed top-0 inset-x-0 z-50 bg-surface-base/80 backdrop-blur-xl pt-safe">
        <div class="h-16 px-margin max-w-lg lg:max-w-3xl mx-auto flex items-center justify-between">
          <a href="index.html" class="flex items-center gap-space-sm">
            <img alt="StudyFlow Logo" class="h-8 w-auto object-contain" src="./icon-192.png"/>
            <span class="font-headline-sm text-headline-sm tracking-tight text-text-primary leading-none">StudyFlow</span>
          </a>
          <div class="flex items-center gap-space-sm">
            <a href="settings.html" aria-label="Profile and Settings" class="w-8 h-8 rounded-full bg-primary-container text-surface-base flex items-center justify-center font-label-md text-label-md font-semibold hover:bg-accent-hover transition-colors">
              ${escapeHtml(initials)}
            </a>
          </div>
        </div>
      </header>
    `;
  }

  function renderBottomNav() {
    const page = getCurrentPage();
    const navItems = [
      { id: 'home', label: 'Home', icon: 'dashboard', href: 'index.html' },
      { id: 'tasks', label: 'Tasks', icon: 'check_circle', href: 'tasks.html' },
      { id: 'focus', label: 'Focus', icon: 'timelapse', href: 'timer.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar_today', href: 'calendar.html' }
    ];

    const isMoreActive = ['notes', 'goals', 'analytics', 'settings'].includes(page);

    return `
      <nav class="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-glass backdrop-blur-2xl lg:hidden" id="bottom-nav">
        <div class="flex justify-around items-center h-16 px-space-xs max-w-lg mx-auto">
          ${navItems.map(item => {
            const isActive = page === item.id;
            return `
              <a href="${item.href}" class="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 transition-all ${isActive ? 'text-primary-container' : 'text-text-secondary hover:text-text-primary'}" ${isActive ? 'aria-current="page"' : ''}>
                <span class="material-symbols-outlined text-[22px]" ${isActive ? "style=\"font-variation-settings: 'FILL' 1;\"" : ''}>${item.icon}</span>
                <span class="font-label-sm text-[11px] leading-tight">${item.label}</span>
              </a>
            `;
          }).join('')}
          <button id="more-nav-btn" aria-label="Open more menu" class="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 transition-all ${isMoreActive ? 'text-primary-container' : 'text-text-secondary hover:text-text-primary'}">
            <span class="material-symbols-outlined text-[22px]" ${isMoreActive ? "style=\"font-variation-settings: 'FILL' 1;\"" : ''}>grid_view</span>
            <span class="font-label-sm text-[11px] leading-tight">More</span>
          </button>
        </div>
      </nav>
    `;
  }

  function renderSidebar() {
    const page = getCurrentPage();
    const navItems = [
      { id: 'home', label: 'Home', icon: 'dashboard', href: 'index.html' },
      { id: 'tasks', label: 'Tasks', icon: 'check_circle', href: 'tasks.html' },
      { id: 'focus', label: 'Focus', icon: 'timelapse', href: 'timer.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar_today', href: 'calendar.html' },
      { id: 'notes', label: 'Notes', icon: 'description', href: 'notes.html' },
      { id: 'goals', label: 'Goals', icon: 'track_changes', href: 'goals.html' },
      { id: 'analytics', label: 'Analytics', icon: 'query_stats', href: 'history.html' },
      { id: 'settings', label: 'Settings', icon: 'tune', href: 'settings.html' }
    ];

    return `
      <aside class="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-surface-container/80 backdrop-blur-xl border-r border-glass-border flex-col p-6 z-40">
        <a href="index.html" class="flex items-center gap-3 mb-8">
          <img alt="StudyFlow Logo" class="h-8 w-auto object-contain" src="./icon-192.png"/>
          <span class="font-headline-sm text-headline-sm tracking-tight text-text-primary">StudyFlow</span>
        </a>
        <nav class="flex-1 flex flex-col gap-1.5">
          ${navItems.map(item => {
            const isActive = page === item.id;
            return `
              <a href="${item.href}" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${isActive ? 'bg-primary-container/15 text-primary-container font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-high/50'}">
                <span class="material-symbols-outlined text-[20px]" ${isActive ? "style=\"font-variation-settings: 'FILL' 1;\"" : ''}>${item.icon}</span>
                <span class="font-label-md text-label-md">${item.label}</span>
              </a>
            `;
          }).join('')}
        </nav>
        <div class="pt-4 border-t border-glass-border font-label-sm text-[11px] text-text-muted">
          All data saved locally
        </div>
      </aside>
    `;
  }

  function renderFab() {
    const page = getCurrentPage();
    if (!['home', 'tasks', 'calendar'].includes(page)) return '';
    return `
      <div class="fixed bottom-20 right-margin z-50 pb-safe pointer-events-auto max-w-lg lg:max-w-3xl mx-auto">
        <button id="global-add-task-fab" aria-label="Add task or session" class="w-14 h-14 rounded-full bg-primary-container text-surface-base flex items-center justify-center shadow-[0_12px_24px_-4px_rgba(91,155,240,0.4)] hover:bg-accent-hover active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[28px] font-bold">add</span>
        </button>
      </div>
    `;
  }

  function initShell() {
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      headerContainer.innerHTML = renderHeader();
    }

    const bottomNavContainer = document.getElementById('bottom-nav-container');
    if (bottomNavContainer) {
      bottomNavContainer.innerHTML = renderBottomNav();
      const moreBtn = bottomNavContainer.querySelector('#more-nav-btn');
      if (moreBtn) {
        moreBtn.onclick = (e) => { e.preventDefault(); openMoreSheet(); };
      }
    }

    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      sidebarContainer.innerHTML = renderSidebar();
    }

    const fabContainer = document.getElementById('fab-container');
    if (fabContainer) {
      fabContainer.innerHTML = renderFab();
      const fabBtn = fabContainer.querySelector('#global-add-task-fab');
      if (fabBtn) {
        fabBtn.onclick = () => openAddTaskModal();
      }
    }

    // Attach listener to any other button with global-add-task-fab ID or trigger
    document.addEventListener('click', (e) => {
      const target = e.target.closest('#global-add-task-fab');
      if (target && !fabContainer?.contains(target)) {
        openAddTaskModal();
      }
    });
  }

  // ── More Sheet ────────────────────────────────────────────────────────────

  function openMoreSheet() {
    const notesCount = Storage.getNotes ? Storage.getNotes().length : 0;
    const currentWeek = Storage.getWeekNumber ? Storage.getWeekNumber() : 1;

    let totalMinutes = 0;
    if (Storage.getSessions) {
      const sessions = Storage.getSessions().filter(s => s.type === 'work');
      totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    }
    const hoursLogged = (totalMinutes / 60).toFixed(1);

    const sheetOverlay = document.createElement('div');
    sheetOverlay.className = 'fixed inset-0 z-50 flex flex-col justify-end';
    sheetOverlay.id = 'more-sheet-overlay';

    sheetOverlay.innerHTML = `
      <div class="fixed inset-0 bg-surface-base/80 backdrop-blur-md transition-opacity duration-300" id="modal-backdrop"></div>
      <div class="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end max-w-lg mx-auto pointer-events-none pb-20" id="more-bottom-sheet">
        <div class="pointer-events-auto bg-surface-container-high/90 backdrop-blur-2xl rounded-t-[2.25rem] px-margin pt-4 pb-8 flex flex-col shadow-[0_-16px_48px_-8px_rgba(0,0,0,0.85)] relative overflow-hidden transition-transform duration-300 translate-y-0" role="dialog" aria-modal="true" aria-label="More options">
          <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          <div class="w-10 h-1 bg-white/25 rounded-full mx-auto mb-4 hover:bg-white/40 transition-colors cursor-grab"></div>
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-2.5">
              <h2 class="font-headline-sm text-headline-sm text-text-primary tracking-tight">More</h2>
              <span class="bg-primary-container/15 text-primary-container font-label-sm text-label-sm px-2.5 py-0.5 rounded-full tracking-wide">Quick Navigation</span>
            </div>
            <button aria-label="Close menu" class="w-9 h-9 rounded-full bg-surface-container-highest/80 hover:bg-surface-bright active:scale-95 text-text-secondary hover:text-text-primary flex items-center justify-center transition-all" id="close-sheet-btn">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-space-sm mb-5">
            <a href="notes.html" class="group bg-surface-container/70 hover:bg-surface-glass-active active:scale-[0.98] rounded-xl p-space-md flex flex-col justify-between h-36 transition-all relative overflow-hidden shadow-sm">
              <div class="flex items-start justify-between w-full">
                <div class="w-10 h-10 rounded-full bg-primary-container/15 text-primary-container flex items-center justify-center group-hover:bg-primary-container group-hover:text-surface-base transition-colors">
                  <span class="material-symbols-outlined text-[20px]">description</span>
                </div>
                <span class="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-headline-sm text-[16px] text-text-primary truncate">Notes</span>
                <span class="font-label-sm text-label-sm text-text-secondary truncate mt-0.5">${notesCount} active notes</span>
              </div>
            </a>
            <a href="goals.html" class="group bg-surface-container/70 hover:bg-surface-glass-active active:scale-[0.98] rounded-xl p-space-md flex flex-col justify-between h-36 transition-all relative overflow-hidden shadow-sm">
              <div class="flex items-start justify-between w-full">
                <div class="w-10 h-10 rounded-full bg-secondary-container/30 text-secondary flex items-center justify-center group-hover:bg-primary-container group-hover:text-surface-base transition-colors">
                  <span class="material-symbols-outlined text-[20px]">track_changes</span>
                </div>
                <span class="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-headline-sm text-[16px] text-text-primary truncate">Goals</span>
                <span class="font-label-sm text-label-sm text-text-secondary truncate mt-0.5">Week ${currentWeek} sprint</span>
              </div>
            </a>
            <a href="history.html" class="group bg-surface-container/70 hover:bg-surface-glass-active active:scale-[0.98] rounded-xl p-space-md flex flex-col justify-between h-36 transition-all relative overflow-hidden shadow-sm">
              <div class="flex items-start justify-between w-full">
                <div class="w-10 h-10 rounded-full bg-surface-container-highest text-primary flex items-center justify-center group-hover:bg-primary-container group-hover:text-surface-base transition-colors">
                  <span class="material-symbols-outlined text-[20px]">query_stats</span>
                </div>
                <span class="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-headline-sm text-[16px] text-text-primary truncate">Analytics</span>
                <span class="font-label-sm text-label-sm text-text-secondary truncate mt-0.5">${hoursLogged}h logged</span>
              </div>
            </a>
            <a href="settings.html" class="group bg-surface-container/70 hover:bg-surface-glass-active active:scale-[0.98] rounded-xl p-space-md flex flex-col justify-between h-36 transition-all relative overflow-hidden shadow-sm">
              <div class="flex items-start justify-between w-full">
                <div class="w-10 h-10 rounded-full bg-surface-container-highest text-text-secondary flex items-center justify-center group-hover:bg-primary-container group-hover:text-surface-base transition-colors">
                  <span class="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <span class="material-symbols-outlined text-[18px] text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all">chevron_right</span>
              </div>
              <div class="flex flex-col min-w-0">
                <span class="font-headline-sm text-[16px] text-text-primary truncate">Settings</span>
                <span class="font-label-sm text-label-sm text-text-secondary truncate mt-0.5">Preferences & timer</span>
              </div>
            </a>
          </div>
          <div class="flex items-center justify-between pt-1 text-center">
            <span class="font-label-sm text-[11px] text-text-muted tracking-wide">StudyFlow ${escapeHtml(typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v1.0.0')}</span>
            <button class="font-label-md text-label-sm text-primary-container hover:text-accent-hover active:scale-95 transition-colors px-2 py-1" id="dismiss-action-btn">Done</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sheetOverlay);

    const closeSheet = () => {
      const sheet = sheetOverlay.querySelector('#more-bottom-sheet');
      const backdrop = sheetOverlay.querySelector('#modal-backdrop');
      if (sheet) sheet.style.transform = 'translateY(100%)';
      if (backdrop) backdrop.style.opacity = '0';
      setTimeout(() => {
        if (sheetOverlay.parentNode) sheetOverlay.parentNode.removeChild(sheetOverlay);
      }, 250);
    };

    sheetOverlay.querySelector('#close-sheet-btn').addEventListener('click', closeSheet);
    sheetOverlay.querySelector('#dismiss-action-btn').addEventListener('click', closeSheet);
    sheetOverlay.querySelector('#modal-backdrop').addEventListener('click', closeSheet);
  }

  // ── Add / Edit Task Modal ──────────────────────────────────────────────────

  function openAddTaskModal(existingTask = null) {
    const isEdit = !!existingTask;
    const subjects = Storage.getSubjects ? Storage.getSubjects() : [];
    const defaultSubject = subjects.length > 0 ? subjects[0].name : 'General';

    const taskType = existingTask?.type || 'one-time';
    const taskTitle = existingTask?.title || '';
    const selectedSubject = existingTask?.subject || defaultSubject;
    const priority = existingTask?.priority || 'medium';
    const repeatDays = existingTask?.repeatDays || [1, 2, 3, 4, 5];
    const startDate = existingTask?.startDate || Storage.formatDate(new Date());
    const dueDate = existingTask?.dueDate || Storage.formatDate(new Date());
    const dueTime = existingTask?.dueTime || '20:30';
    const subtasks = existingTask?.subtasks ? [...existingTask.subtasks] : [];

    const sheetOverlay = document.createElement('div');
    sheetOverlay.className = 'fixed inset-0 z-50 flex flex-col justify-end';
    sheetOverlay.id = 'task-sheet-overlay';

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    sheetOverlay.innerHTML = `
      <div class="fixed inset-0 bg-surface-base/70 backdrop-blur-md transition-opacity duration-300" id="modal-backdrop"></div>
      <div class="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-end pointer-events-none pb-safe max-w-lg mx-auto">
        <div class="w-full pointer-events-auto bg-surface-glass-active backdrop-blur-2xl rounded-t-[2.25rem] px-margin pt-3 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] flex flex-col gap-space-md transition-transform duration-300 max-h-[88vh] overflow-y-auto" id="bottom-sheet-content" role="dialog" aria-modal="true" aria-label="${isEdit ? 'Edit Task' : 'New Task'}">
          <div class="w-10 h-1.5 bg-white/20 rounded-full mx-auto my-1 flex-shrink-0 cursor-grab"></div>
          <div class="flex items-center justify-between pt-1">
            <div class="flex flex-col">
              <h2 class="font-headline-md text-headline-md text-text-primary tracking-tight">${isEdit ? 'Edit Task' : 'New Task'}</h2>
              <p class="font-label-sm text-label-sm text-text-secondary">${isEdit ? 'Update task parameters' : 'Capture your next academic milestone'}</p>
            </div>
            <button aria-label="Close dialog" class="w-9 h-9 rounded-full bg-surface-variant/80 hover:bg-surface-variant flex items-center justify-center text-text-secondary hover:text-text-primary transition-all active:scale-90" id="close-modal-btn">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-3.5 mt-1">
            <!-- Title Input -->
            <div class="w-full relative rounded-2xl bg-surface-container-lowest/80 focus-within:bg-surface-container-low transition-all">
              <div class="flex items-center px-4 py-3.5 gap-3">
                <span class="material-symbols-outlined text-primary-container text-[20px] flex-shrink-0">edit_note</span>
                <input autocomplete="off" class="w-full bg-transparent border-0 outline-none font-body-md text-body-md text-text-primary placeholder:text-text-muted focus:ring-0 p-0" id="task-title-input" placeholder="e.g., Read Chapter 4 Neurobiology" type="text" value="${escapeHtml(taskTitle)}"/>
              </div>
            </div>

            <!-- Task Type Selector -->
            <div class="flex p-1 rounded-2xl bg-surface-container-lowest/90 w-full" id="task-type-selector">
              <button class="flex-1 py-2 rounded-xl font-label-sm text-label-sm text-center transition-all ${taskType === 'one-time' ? 'bg-primary-container text-surface-base font-semibold shadow-sm' : 'text-text-secondary hover:text-text-primary'}" data-type="one-time" type="button">One-time</button>
              <button class="flex-1 py-2 rounded-xl font-label-sm text-label-sm text-center transition-all ${taskType === 'repeating' ? 'bg-primary-container text-surface-base font-semibold shadow-sm' : 'text-text-secondary hover:text-text-primary'}" data-type="repeating" type="button">Repeating</button>
              <button class="flex-1 py-2 rounded-xl font-label-sm text-label-sm text-center transition-all ${taskType === 'date-range' ? 'bg-primary-container text-surface-base font-semibold shadow-sm' : 'text-text-secondary hover:text-text-primary'}" data-type="date-range" type="button">Date range</button>
            </div>

            <!-- Repeating Day Chips -->
            <div class="${taskType === 'repeating' ? 'flex' : 'hidden'} flex-col gap-2" id="repeating-days-container">
              <span class="font-label-sm text-label-sm text-text-secondary">Repeat Days</span>
              <div class="grid grid-cols-7 gap-1.5" id="day-chips-grid">
                ${dayLabels.map((label, idx) => {
                  const isSelected = repeatDays.includes(idx);
                  return `
                    <button class="day-chip py-2 rounded-xl font-label-sm text-label-sm text-center transition-all ${isSelected ? 'bg-primary-container text-surface-base font-semibold' : 'bg-surface-container-lowest/80 text-text-secondary'}" data-day="${idx}" type="button">${label}</button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Date Range Pickers -->
            <div class="${taskType === 'date-range' ? 'flex' : 'hidden'} flex-col gap-2" id="date-range-container">
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <label for="start-date-input" class="font-label-sm text-[11px] text-text-muted uppercase">Start Date</label>
                  <input id="start-date-input" type="date" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-sm outline-none" value="${escapeHtml(startDate)}"/>
                </div>
                <div class="flex flex-col gap-1">
                  <label for="end-date-input" class="font-label-sm text-[11px] text-text-muted uppercase">End Date</label>
                  <input id="end-date-input" type="date" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-sm outline-none" value="${escapeHtml(dueDate)}"/>
                </div>
              </div>
            </div>

            <!-- Schedule Picker Button & Native Date/Time Pickers -->
            <div class="${taskType === 'one-time' ? 'flex' : 'hidden'} flex-col gap-2" id="schedule-picker-container">
              <button class="w-full rounded-2xl bg-surface-container-lowest/70 hover:bg-surface-container-lowest active:scale-[0.99] p-3.5 flex items-center justify-between transition-all text-left" id="schedule-picker-btn" type="button">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-secondary-container/50 text-secondary flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-[18px]">calendar_clock</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-label-sm text-[11px] text-text-muted uppercase tracking-wider">Scheduled for</span>
                    <span class="font-label-md text-label-md text-text-primary" id="current-schedule-label">${Storage.formatDisplayDate(dueDate)} · ${dueTime}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-text-secondary text-[20px]">chevron_right</span>
              </button>
              <div class="hidden grid-cols-2 gap-2 pt-1" id="native-schedule-pickers">
                <input id="schedule-date-input" type="date" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-sm outline-none" value="${escapeHtml(dueDate)}"/>
                <input id="schedule-time-input" type="time" class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-sm outline-none" value="${escapeHtml(dueTime)}"/>
              </div>
            </div>

            <!-- Course / Subject Dropdown Selector -->
            <div class="relative">
              <button class="w-full rounded-2xl bg-surface-container-lowest/70 hover:bg-surface-container-lowest active:scale-[0.99] p-3.5 flex items-center justify-between transition-all text-left" id="subject-dropdown-btn" type="button">
                <div class="flex items-center gap-3">
                  <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${getSubjectColor(selectedSubject)};"></div>
                  <div class="flex flex-col">
                    <span class="font-label-sm text-[11px] text-text-muted uppercase tracking-wider">Subject</span>
                    <span class="font-label-md text-label-md text-text-primary truncate" id="selected-subject-label">${escapeHtml(selectedSubject)}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-text-secondary text-[20px] transition-transform duration-200" id="dropdown-chevron">expand_more</span>
              </button>
              <div class="hidden absolute top-full mt-2 inset-x-0 z-30 rounded-2xl bg-surface-container-high/95 backdrop-blur-xl p-2 shadow-2xl flex flex-col gap-1 max-h-48 overflow-y-auto" id="subject-menu">
                ${subjects.map(s => `
                  <div class="px-3 py-2 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-surface-variant transition-colors" data-subject="${escapeHtml(s.name)}">
                    <div class="w-2.5 h-2.5 rounded-full" style="background-color: ${escapeHtml(s.color)};"></div>
                    <span class="font-label-md text-label-md text-text-primary flex-1">${escapeHtml(s.name)}</span>
                    ${s.name === selectedSubject ? '<span class="material-symbols-outlined text-primary-container text-[18px]">check</span>' : ''}
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Priority Chips -->
            <div class="flex flex-col gap-2 pt-0.5">
              <span class="font-label-sm text-label-sm text-text-secondary">Priority</span>
              <div class="grid grid-cols-4 gap-2" id="priority-selector">
                <button class="priority-btn py-2 px-1 rounded-xl ${priority === 'low' ? 'bg-surface-variant text-text-primary font-semibold' : 'bg-surface-container-lowest/80 text-text-muted'} hover:text-text-primary font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1" data-priority="low" type="button">
                  <span class="w-2 h-2 rounded-full bg-outline-variant"></span>
                  <span>Low</span>
                </button>
                <button class="priority-btn py-2 px-1 rounded-xl ${priority === 'medium' ? 'bg-secondary-container/40 text-secondary font-semibold' : 'bg-surface-container-lowest/80 text-text-muted'} hover:text-text-primary font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1" data-priority="medium" type="button">
                  <span class="w-2 h-2 rounded-full bg-secondary"></span>
                  <span>Medium</span>
                </button>
                <button class="priority-btn py-2 px-1 rounded-xl ${priority === 'high' ? 'bg-tertiary-container/20 text-tertiary font-semibold' : 'bg-surface-container-lowest/80 text-text-muted'} hover:text-text-primary font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1" data-priority="high" type="button">
                  <span class="w-2 h-2 rounded-full bg-tertiary"></span>
                  <span>High</span>
                </button>
                <button class="priority-btn py-2 px-1 rounded-xl ${priority === 'critical' ? 'bg-error-container/30 text-error font-semibold' : 'bg-surface-container-lowest/80 text-text-muted'} hover:text-text-primary font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1" data-priority="critical" type="button">
                  <span class="w-2 h-2 rounded-full bg-error"></span>
                  <span>Critical</span>
                </button>
              </div>
            </div>

            <!-- Compact Subtasks Section -->
            <div class="flex flex-col gap-2 pt-1">
              <div class="flex items-center justify-between">
                <span class="font-label-sm text-label-sm text-text-secondary">Subtasks</span>
                <button type="button" id="add-subtask-row-btn" class="font-label-sm text-label-sm text-primary hover:text-accent-hover flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">add</span>
                  <span>Add subtask</span>
                </button>
              </div>
              <div class="flex flex-col gap-2" id="modal-subtasks-list">
                ${subtasks.map((sub, idx) => `
                  <div class="flex items-center gap-2 bg-surface-container-lowest/70 p-2 rounded-xl">
                    <input type="text" class="flex-1 bg-transparent border-0 text-text-primary text-body-sm outline-none subtask-title-input" value="${escapeHtml(sub.title)}" placeholder="Subtask title"/>
                    <button type="button" class="remove-subtask-btn text-text-muted hover:text-error p-1"><span class="material-symbols-outlined text-[18px]">close</span></button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2 pt-3">
            <button class="w-full h-12 rounded-full bg-primary-container text-surface-base font-headline-sm text-[16px] font-bold flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(91,155,240,0.35)] hover:bg-accent-hover active:scale-[0.98] transition-all" id="submit-task-btn" type="button">
              <span class="material-symbols-outlined text-[20px] font-bold">${isEdit ? 'edit' : 'add_task'}</span>
              <span>${isEdit ? 'Save changes' : 'Add task'}</span>
            </button>
            ${isEdit ? `
              <button class="w-full py-2 text-center text-error hover:text-red-400 font-label-md text-label-md transition-colors" id="delete-task-modal-btn" type="button">
                Delete Task
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(sheetOverlay);

    const closeSheet = () => {
      const sheet = sheetOverlay.querySelector('#bottom-sheet-content');
      const backdrop = sheetOverlay.querySelector('#modal-backdrop');
      if (sheet) sheet.style.transform = 'translateY(100%)';
      if (backdrop) backdrop.style.opacity = '0';
      setTimeout(() => {
        if (sheetOverlay.parentNode) sheetOverlay.parentNode.removeChild(sheetOverlay);
      }, 250);
    };

    sheetOverlay.querySelector('#close-modal-btn').addEventListener('click', closeSheet);
    sheetOverlay.querySelector('#modal-backdrop').addEventListener('click', closeSheet);

    // Type selector interactions
    let currentActiveType = taskType;
    const typeButtons = sheetOverlay.querySelectorAll('#task-type-selector button');
    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => {
          b.className = 'flex-1 py-2 rounded-xl font-label-sm text-label-sm text-center text-text-secondary hover:text-text-primary transition-all';
        });
        btn.className = 'flex-1 py-2 rounded-xl font-label-sm text-label-sm text-center transition-all bg-primary-container text-surface-base font-semibold shadow-sm';

        currentActiveType = btn.getAttribute('data-type');
        sheetOverlay.querySelector('#repeating-days-container').className = currentActiveType === 'repeating' ? 'flex flex-col gap-2' : 'hidden flex-col gap-2';
        sheetOverlay.querySelector('#date-range-container').className = currentActiveType === 'date-range' ? 'flex flex-col gap-2' : 'hidden flex-col gap-2';
        sheetOverlay.querySelector('#schedule-picker-container').className = currentActiveType === 'one-time' ? 'flex flex-col gap-2' : 'hidden flex-col gap-2';
      });
    });

    // Repeating day chips
    let selectedRepeatDays = [...repeatDays];
    sheetOverlay.querySelectorAll('.day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const dayIdx = parseInt(chip.getAttribute('data-day'), 10);
        if (selectedRepeatDays.includes(dayIdx)) {
          selectedRepeatDays = selectedRepeatDays.filter(d => d !== dayIdx);
          chip.className = 'day-chip py-2 rounded-xl font-label-sm text-label-sm text-center transition-all bg-surface-container-lowest/80 text-text-secondary';
        } else {
          selectedRepeatDays.push(dayIdx);
          chip.className = 'day-chip py-2 rounded-xl font-label-sm text-label-sm text-center transition-all bg-primary-container text-surface-base font-semibold';
        }
      });
    });

    // Schedule picker toggle
    const schedulePickerBtn = sheetOverlay.querySelector('#schedule-picker-btn');
    const nativePickers = sheetOverlay.querySelector('#native-schedule-pickers');
    if (schedulePickerBtn && nativePickers) {
      schedulePickerBtn.addEventListener('click', () => {
        nativePickers.classList.toggle('hidden');
        nativePickers.classList.toggle('grid');
      });
    }

    // Subject dropdown
    let activeSubject = selectedSubject;
    const subjectBtn = sheetOverlay.querySelector('#subject-dropdown-btn');
    const subjectMenu = sheetOverlay.querySelector('#subject-menu');
    const dropdownChevron = sheetOverlay.querySelector('#dropdown-chevron');
    const selectedSubjectLabel = sheetOverlay.querySelector('#selected-subject-label');

    if (subjectBtn && subjectMenu) {
      subjectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = subjectMenu.classList.contains('hidden');
        subjectMenu.classList.toggle('hidden', !isHidden);
        if (dropdownChevron) dropdownChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      subjectMenu.querySelectorAll('[data-subject]').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          activeSubject = item.getAttribute('data-subject');
          if (selectedSubjectLabel) selectedSubjectLabel.textContent = activeSubject;
          subjectMenu.classList.add('hidden');
          if (dropdownChevron) dropdownChevron.style.transform = 'rotate(0deg)';
        });
      });
    }

    // Priority selection
    let activePriority = priority;
    sheetOverlay.querySelectorAll('.priority-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sheetOverlay.querySelectorAll('.priority-btn').forEach(b => {
          b.className = 'priority-btn py-2 px-1 rounded-xl bg-surface-container-lowest/80 text-text-muted hover:text-text-primary font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1';
        });
        activePriority = btn.getAttribute('data-priority');
        const pMap = {
          low: 'bg-surface-variant text-text-primary',
          medium: 'bg-secondary-container/40 text-secondary',
          high: 'bg-tertiary-container/20 text-tertiary',
          critical: 'bg-error-container/30 text-error'
        };
        btn.className = `priority-btn py-2 px-1 rounded-xl ${pMap[activePriority] || 'bg-secondary-container/40 text-secondary'} font-semibold font-label-sm text-label-sm text-center transition-all flex flex-col items-center gap-1 shadow-sm`;
      });
    });

    // Subtasks addition
    const subtasksList = sheetOverlay.querySelector('#modal-subtasks-list');
    const addSubtaskBtn = sheetOverlay.querySelector('#add-subtask-row-btn');
    if (addSubtaskBtn && subtasksList) {
      addSubtaskBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 bg-surface-container-lowest/70 p-2 rounded-xl';
        row.innerHTML = `
          <input type="text" class="flex-1 bg-transparent border-0 text-text-primary text-body-sm outline-none subtask-title-input" placeholder="Subtask title"/>
          <button type="button" class="remove-subtask-btn text-text-muted hover:text-error p-1"><span class="material-symbols-outlined text-[18px]">close</span></button>
        `;
        row.querySelector('.remove-subtask-btn').addEventListener('click', () => row.remove());
        subtasksList.appendChild(row);
        row.querySelector('input').focus();
      });

      subtasksList.querySelectorAll('.remove-subtask-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.flex').remove());
      });
    }

    // Submit task
    const submitBtn = sheetOverlay.querySelector('#submit-task-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const titleInput = sheetOverlay.querySelector('#task-title-input');
        const title = titleInput ? titleInput.value.trim() : '';
        if (!title) {
          showToast('Please enter a task title', 'warning');
          if (titleInput) titleInput.focus();
          return;
        }

        const subtaskInputs = sheetOverlay.querySelectorAll('.subtask-title-input');
        const updatedSubtasks = Array.from(subtaskInputs).map((inp, idx) => ({
          id: existingTask?.subtasks?.[idx]?.id || 'sub_' + Date.now() + '_' + idx,
          title: inp.value.trim(),
          completed: existingTask?.subtasks?.[idx]?.completed || false
        })).filter(s => s.title.length > 0);

        let finalDueDate = dueDate;
        let finalDueTime = dueTime;
        let finalStartDate = startDate;

        if (currentActiveType === 'one-time') {
          const scheduleDate = sheetOverlay.querySelector('#schedule-date-input')?.value;
          const scheduleTime = sheetOverlay.querySelector('#schedule-time-input')?.value;
          if (scheduleDate) finalDueDate = scheduleDate;
          if (scheduleTime) finalDueTime = scheduleTime;
        } else if (currentActiveType === 'date-range') {
          const sDate = sheetOverlay.querySelector('#start-date-input')?.value;
          const eDate = sheetOverlay.querySelector('#end-date-input')?.value;
          if (sDate) finalStartDate = sDate;
          if (eDate) finalDueDate = eDate;
        }

        const taskData = {
          title,
          type: currentActiveType,
          subject: activeSubject,
          priority: activePriority,
          repeatDays: selectedRepeatDays,
          startDate: finalStartDate,
          dueDate: finalDueDate,
          dueTime: finalDueTime,
          subtasks: updatedSubtasks
        };

        if (isEdit) {
          taskData.id = existingTask.id;
          taskData.completed = existingTask.completed;
          Storage.updateTask(taskData);
          showToast('Task updated successfully', 'success');
        } else {
          Storage.addTask(taskData);
          showToast('Task added to Flow', 'success');
        }

        closeSheet();
        window.dispatchEvent(new CustomEvent('studyflow_task_updated'));
      });
    }

    // Delete task if in edit mode
    const deleteBtn = sheetOverlay.querySelector('#delete-task-modal-btn');
    if (deleteBtn && isEdit) {
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirm({
          title: 'Delete Task',
          message: `Are you sure you want to delete "${existingTask.title}"?`,
          confirmText: 'Delete',
          danger: true
        });
        if (confirmed) {
          Storage.deleteTask(existingTask.id);
          showToast('Task deleted', 'info');
          closeSheet();
          window.dispatchEvent(new CustomEvent('studyflow_task_updated'));
        }
      });
    }
  }

  // ── Modal & Toast Utilities ───────────────────────────────────────────────

  let activeModal = null;

  function createModal(options) {
    const { id, title, content, footer, onClose } = options;
    const modalId = id || 'modal-' + Date.now();
    const titleId = modalId + '-title';

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-margin bg-surface-base/80 backdrop-blur-md opacity-0 transition-opacity duration-200';
    if (id) modal.id = id;

    modal.innerHTML = `
      <div class="modal bg-surface-container-high/90 backdrop-blur-2xl border border-glass-border rounded-xl p-6 w-full max-w-md shadow-2xl relative" role="dialog" aria-modal="true" aria-labelledby="${escapeHtml(titleId)}">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-headline-sm text-headline-sm text-text-primary" id="${escapeHtml(titleId)}">${escapeHtml(title)}</h3>
          <button class="modal-close w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors" aria-label="Close modal">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div class="modal-body mb-6 font-body-md text-text-secondary">${content}</div>
        ${footer ? `<div class="modal-footer flex items-center justify-end gap-3 pt-4 border-t border-glass-border">${footer}</div>` : ''}
      </div>
    `;

    let pointerDownOnOverlay = false;
    modal.addEventListener('pointerdown', (e) => {
      pointerDownOnOverlay = e.target === modal;
    });
    modal.addEventListener('pointerup', (e) => {
      if (pointerDownOnOverlay && e.target === modal) closeModal(modal);
      pointerDownOnOverlay = false;
    });

    modal.querySelector('.modal-close').addEventListener('click', () => closeModal(modal));
    modal._onClose = onClose;
    return modal;
  }

  function openModal(modal) {
    document.body.appendChild(modal);
    modal.offsetHeight;
    modal.classList.add('opacity-100');
    activeModal = modal;
    const focusable = modal.querySelectorAll('button, input, select, textarea');
    if (focusable.length > 0) focusable[0].focus();
  }

  function closeModal(modal) {
    if (!modal) modal = activeModal;
    if (!modal) return;
    modal.classList.remove('opacity-100');
    setTimeout(() => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      if (modal._onClose) modal._onClose();
    }, 200);
    activeModal = null;
  }

  function confirm(options) {
    return new Promise((resolve) => {
      const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = options;
      const modal = createModal({
        id: 'confirm-modal', title,
        content: `<p class="text-text-secondary font-body-md">${escapeHtml(message)}</p>`,
        footer: `
          <button class="px-4 py-2 rounded-full font-label-md text-text-secondary hover:text-text-primary transition-colors" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="px-4 py-2 rounded-full font-label-md ${danger ? 'bg-error-container text-error hover:bg-error/20' : 'bg-primary-container text-surface-base hover:bg-accent-hover'} transition-colors" data-action="confirm">${escapeHtml(confirmText)}</button>
        `,
        onClose: () => resolve(false)
      });
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => { closeModal(modal); resolve(false); });
      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => { closeModal(modal); resolve(true); });
      openModal(modal);
    });
  }

  function alert(options) {
    return new Promise((resolve) => {
      const { title, message, buttonText = 'OK' } = options;
      const modal = createModal({
        id: 'alert-modal', title,
        content: `<p class="text-text-secondary font-body-md">${escapeHtml(message)}</p>`,
        footer: `<button class="px-4 py-2 rounded-full font-label-md bg-primary-container text-surface-base hover:bg-accent-hover transition-colors" data-action="ok">${escapeHtml(buttonText)}</button>`,
        onClose: () => resolve()
      });
      modal.querySelector('[data-action="ok"]').addEventListener('click', () => { closeModal(modal); resolve(); });
      openModal(modal);
    });
  }

  let toastContainer = null;

  function initToastContainer() {
    if (toastContainer && document.getElementById('toast-container')) return;
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4';
      document.body.appendChild(toastContainer);
    }
  }

  function showToast(message, type = 'info', duration = 3000) {
    initToastContainer();
    const toast = document.createElement('div');
    const borderMap = {
      success: 'border-primary-container/40',
      error: 'border-error/40',
      warning: 'border-tertiary/40',
      info: 'border-glass-border'
    };
    const iconMap = {
      success: 'check_circle',
      error: 'warning',
      warning: 'warning',
      info: 'info'
    };
    const colorMap = {
      success: 'text-primary-container',
      error: 'text-error',
      warning: 'text-tertiary',
      info: 'text-primary'
    };

    toast.className = `pointer-events-auto bg-surface-container-high/90 backdrop-blur-xl border ${borderMap[type] || borderMap.info} rounded-full px-4 py-2.5 shadow-xl flex items-center gap-3 transition-all duration-300 opacity-0 translate-y-2`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px] ${colorMap[type] || colorMap.info}">${iconMap[type] || iconMap.info}</span>
      <span class="font-body-sm text-body-sm text-text-primary">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
      });
    } else {
      toast.classList.remove('opacity-0', 'translate-y-2');
    }

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  }

  function showUndoToast(message, onUndo, duration = 5000) {
    initToastContainer();
    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-surface-container-high/90 backdrop-blur-xl border border-primary-container/40 rounded-full px-4 py-2.5 shadow-xl flex items-center justify-between gap-4 transition-all duration-300 opacity-0 translate-y-2';

    toast.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-[18px] text-primary-container">check_circle</span>
        <span class="font-body-sm text-body-sm text-text-primary">${escapeHtml(message)}</span>
      </div>
      <button class="undo-btn px-3 py-1 rounded-full bg-primary-container/20 text-primary-container hover:bg-primary-container hover:text-surface-base font-label-sm text-label-sm font-semibold transition-colors">
        UNDO
      </button>
    `;

    toastContainer.appendChild(toast);
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
      });
    } else {
      toast.classList.remove('opacity-0', 'translate-y-2');
    }

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };

    const autoTimer = setTimeout(dismiss, duration);

    toast.querySelector('.undo-btn').addEventListener('click', () => {
      clearTimeout(autoTimer);
      dismiss();
      onUndo();
    });

    return dismiss;
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  function formatDuration(minutes) {
    const safeMinutes = Number.isFinite(Number(minutes)) && Number(minutes) >= 0 ? Math.floor(Number(minutes)) : 0;
    const hours = Math.floor(safeMinutes / 60), mins = safeMinutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  function getSubjectColor(subjectName) {
    const subject = Storage.getSubjectByName ? Storage.getSubjectByName(subjectName) : null;
    return (subject && isValidHexColor(subject.color)) ? subject.color : '#5B9BF0';
  }

  function isValidHexColor(hex) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
  }

  function createProgressBar(current, max, label, showPercentage = true) {
    const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
    const safeMax = Number.isFinite(Number(max)) ? Number(max) : 0;
    const percentage = safeMax > 0 ? Math.min(100, Math.round((safeCurrent / safeMax) * 100)) : 0;
    return `
      <div class="flex flex-col gap-1.5 w-full">
        <div class="flex items-center justify-between font-label-sm text-label-sm">
          <span class="text-text-secondary">${escapeHtml(label)}</span>
          <span class="text-text-primary font-medium">${escapeHtml(safeCurrent)} / ${escapeHtml(safeMax)}${showPercentage ? ` (${percentage}%)` : ''}</span>
        </div>
        <div class="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
          <div class="h-full bg-primary-container rounded-full transition-all duration-300" style="width:${percentage}%;"></div>
        </div>
      </div>
    `;
  }

  function createEmptyStateHtml(options) {
    const { title='No Data', text='Nothing to show here yet.', icon='inbox', actionText='', actionId='', padding='3rem' } = options;
    return `
      <div class="flex flex-col items-center justify-center text-center py-8 px-4" style="padding:${escapeHtml(padding)};">
        <div class="w-12 h-12 rounded-full bg-surface-container-high/80 text-text-muted flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-[24px]">${escapeHtml(icon)}</span>
        </div>
        <h4 class="font-headline-sm text-headline-sm text-text-primary mb-1">${escapeHtml(title)}</h4>
        <p class="font-body-sm text-body-sm text-text-secondary max-w-xs mb-4">${escapeHtml(text)}</p>
        ${actionText ? `<button class="px-4 py-2 rounded-full bg-primary-container text-surface-base font-label-md text-label-md font-semibold hover:bg-accent-hover transition-colors" id="${escapeHtml(actionId)}">${escapeHtml(actionText)}</button>` : ''}
      </div>
    `;
  }

  function init() {
    initShell();
    initToastContainer();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) closeModal(activeModal);
    });
  }

  return {
    init, initShell, getCurrentPage, getUserInitials,
    openMoreSheet, openAddTaskModal,
    createModal, openModal, closeModal, confirm, alert,
    showToast, showUndoToast,
    debounce, formatDuration, formatNumber,
    escapeHtml, getSubjectColor, isValidHexColor,
    createProgressBar, createEmptyStateHtml
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
