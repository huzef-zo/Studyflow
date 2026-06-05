/**
 * StudyFlow - Main Application Module
 * FIXES:
 * 1. checkTimerBackground: now uses a tab-unique flag so only one tab processes
 *    the background completion at a time. Prevents duplicate session recordings.
 * 2. createModal: tracks pointerdown target to fix overlay-close failing on mobile
 *    scroll-drag release.
 */

const App = (function() {
  'use strict';

  const Icons = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    tasks: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    timer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>`,
    goals: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    plus: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>`,
    edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`,
    clock: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    flame: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    play: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    pause: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    chevronLeft: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevronRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    grid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
    pin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="15" x2="10" y1="4" y2="9"/><path d="M9 15l-4.5 4.5"/><path d="M15.5 13l2.5 2.5a2 2 0 0 1 0 2.8l-2.2 2.2a2 2 0 0 1-2.8 0l-2.5-2.5"/><path d="M15 4l5 5"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    alertCircle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    bookOpen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    target: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    award: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
    empty: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    history: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 16 3-3 3 3 5-5"/></svg>`
  };

  function getIcon(name) { return Icons[name] || ''; }

  function renderSidebar(isCollapsed = false) {
    const currentPage = getCurrentPage();
    const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', href: 'index.html' },
      { id: 'tasks', label: 'Tasks', icon: 'tasks', href: 'tasks.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'calendar.html' },
      { id: 'timer', label: 'Timer', icon: 'timer', href: 'timer.html' },
      { id: 'notes', label: 'Notes', icon: 'edit', href: 'notes.html' },
      { id: 'goals', label: 'Goals', icon: 'goals', href: 'goals.html' },
      { id: 'history', label: 'Analytics', icon: 'history', href: 'history.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ];
    return `
      <aside class="sidebar ${isCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <a href="index.html" class="sidebar-logo" style="flex:1;min-width:0;">
            ${Icons.bookOpen}
            <span class="nav-item-text">StudyFlow</span>
          </a>
          <button id="sidebar-toggle" class="btn-icon btn-ghost" title="${isCollapsed ? 'Expand' : 'Collapse'}" style="margin-right:-10px;">
            ${isCollapsed ? Icons.chevronRight : Icons.chevronLeft}
          </button>
        </div>
        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <a href="${item.href}" class="nav-item ${currentPage === item.id ? 'active' : ''}" title="${item.label}">
              ${Icons[item.icon]}
              <span class="nav-item-text">${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="text-secondary text-center nav-item-text" style="font-size:0.75rem;">All data saved locally</div>
        </div>
      </aside>
    `;
  }

  function renderBottomNav() {
    const currentPage = getCurrentPage();
    const settings = Storage.getSettings();
    const pinnedIds = settings.pinned_nav_items || ['timer', 'calendar'];

    const allItems = {
      dashboard: { id: 'dashboard', label: 'Home', icon: 'home', href: 'index.html' },
      tasks: { id: 'tasks', label: 'Tasks', icon: 'tasks', href: 'tasks.html' },
      timer: { id: 'timer', label: 'Timer', icon: 'timer', href: 'timer.html' },
      calendar: { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'calendar.html' },
      notes: { id: 'notes', label: 'Vault', icon: 'edit', href: 'notes.html' },
      goals: { id: 'goals', label: 'Goals', icon: 'goals', href: 'goals.html' },
      history: { id: 'history', label: 'Stats', icon: 'history', href: 'history.html' },
      settings: { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    };

    const navItems = [
      allItems.dashboard,
      allItems.tasks
    ];

    pinnedIds.forEach(id => {
      if (allItems[id]) navItems.push(allItems[id]);
    });

    const isMoreActive = !navItems.some(item => item.id === currentPage);

    return `
      <nav class="bottom-nav">
        ${navItems.map(item => `
          <a href="${item.href}" class="bottom-nav-item ${currentPage === item.id ? 'active' : ''}">
            ${Icons[item.icon]}
            <span>${item.label}</span>
          </a>
        `).join('')}
        <button id="more-nav-btn" class="bottom-nav-item ${isMoreActive ? 'active' : ''}" style="background:none;border:none;font-family:inherit;cursor:pointer;">
          ${Icons.grid}
          <span>More</span>
        </button>
      </nav>
    `;
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    const pageMap = {
      'index.html': 'dashboard', '': 'dashboard',
      'tasks.html': 'tasks', 'calendar.html': 'calendar',
      'timer.html': 'timer', 'goals.html': 'goals',
      'notes.html': 'notes',
      'history.html': 'history', 'settings.html': 'settings'
    };
    return pageMap[filename] || 'dashboard';
  }

  function toggleSidebar() {
    const isCollapsed = !Storage.loadData(Storage.KEYS.SIDEBAR, false);
    Storage.saveData(Storage.KEYS.SIDEBAR, isCollapsed);
    initNavigation();
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  }

  function initNavigation() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const bottomNavContainer = document.getElementById('bottom-nav-container');
    const isCollapsed = Storage.loadData(Storage.KEYS.SIDEBAR, false);
    if (sidebarContainer) {
      sidebarContainer.innerHTML = renderSidebar(isCollapsed);
      const toggleBtn = sidebarContainer.querySelector('#sidebar-toggle');
      if (toggleBtn) toggleBtn.onclick = (e) => { e.preventDefault(); toggleSidebar(); };
      sidebarContainer.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => Storage.saveData(Storage.KEYS.SIDEBAR, true);
      });
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
    }
    if (bottomNavContainer) {
      bottomNavContainer.innerHTML = renderBottomNav();
      const moreBtn = bottomNavContainer.querySelector('#more-nav-btn');
      if (moreBtn) moreBtn.onclick = (e) => { e.preventDefault(); openMoreMenu(); };
    }
  }

  function openMoreMenu() {
    const settings = Storage.getSettings();
    const pinnedIds = settings.pinned_nav_items || ['timer', 'calendar'];
    const currentPage = getCurrentPage();

    const menuItems = [
      { id: 'timer', label: 'Timer', icon: 'timer', href: 'timer.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'calendar.html' },
      { id: 'notes', label: 'Knowledge Vault', icon: 'edit', href: 'notes.html' },
      { id: 'goals', label: 'Goals', icon: 'goals', href: 'goals.html' },
      { id: 'history', label: 'History', icon: 'history', href: 'history.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ];

    const content = `
      <div class="more-menu-grid">
        ${menuItems.map(item => {
          const isPinned = pinnedIds.includes(item.id);
          const isActive = currentPage === item.id;
          return `
            <div class="more-menu-item-wrapper">
              <a href="${item.href}" class="more-menu-item ${isActive ? 'active' : ''}">
                <div class="more-menu-icon">${Icons[item.icon]}</div>
                <span class="more-menu-label">${item.label}</span>
              </a>
              <button class="pin-btn ${isPinned ? 'pinned' : ''}" data-id="${item.id}" title="${isPinned ? 'Unpin' : 'Pin to navigation'}">
                ${Icons.pin}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const modal = createModal({
      title: 'More Features',
      content: content,
      id: 'more-menu-modal'
    });

    modal.classList.add('modal-bottom-sheet');
    openModal(modal);

    modal.querySelectorAll('.pin-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        const currentSettings = Storage.getSettings();
        let currentPinned = currentSettings.pinned_nav_items || ['timer', 'calendar'];

        if (currentPinned.includes(id)) {
          currentPinned = currentPinned.filter(p => p !== id);
        } else {
          if (currentPinned.length >= 2) {
            showToast('Max 2 items pinned. Unpin one first.', 'warning');
            return;
          }
          currentPinned.push(id);
        }

        Storage.updateSetting('pinned_nav_items', currentPinned);
        initNavigation(); // Refresh nav

        // Update UI in modal
        btn.classList.toggle('pinned');
        const allPins = modal.querySelectorAll('.pin-btn.pinned').length;
        modal.querySelectorAll('.pin-btn:not(.pinned)').forEach(p => {
          p.disabled = allPins >= 2;
        });
      };
    });
  }

  // ── Modal system ──────────────────────────────────────────────────────────

  let activeModal = null;

  function createModal(options) {
    const { id, title, content, footer, onClose } = options;
    const modalId = id || 'modal-' + Date.now();
    const titleId = modalId + '-title';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    if (id) modal.id = id;

    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-header">
          <h3 class="modal-title" id="${titleId}">${escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="Close modal">${Icons.x}</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    // FIX: Track where the pointer went DOWN so a scroll-drag-release on the
    // overlay doesn't close the modal. Only close if both pointerdown and
    // pointerup landed directly on the overlay element itself.
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
    modal.offsetHeight; // force reflow for animation
    modal.classList.add('active');
    activeModal = modal;
    const focusable = modal.querySelectorAll('button, input, select, textarea');
    if (focusable.length > 0) focusable[0].focus();
  }

  function closeModal(modal) {
    if (!modal) modal = activeModal;
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      if (modal._onClose) modal._onClose();
    }, 200);
    activeModal = null;
  }

  function confirm(options) {
    return new Promise((resolve) => {
      const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = options;
      // SECURITY: Ensure all user-provided strings are escaped to prevent XSS
      const modal = createModal({
        id: 'confirm-modal', title,
        content: `<p style="margin:0;color:var(--text-secondary);">${escapeHtml(message)}</p>`,
        footer: `<button class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>`,
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
      // SECURITY: Ensure all user-provided strings are escaped to prevent XSS
      const modal = createModal({
        id: 'alert-modal', title,
        content: `<p style="margin:0;color:var(--text-secondary);">${escapeHtml(message)}</p>`,
        footer: `<button class="btn btn-primary" data-action="ok">${escapeHtml(buttonText)}</button>`,
        onClose: () => resolve()
      });
      modal.querySelector('[data-action="ok"]').addEventListener('click', () => { closeModal(modal); resolve(); });
      openModal(modal);
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  let toastContainer = null;

  function initToastContainer() {
    if (toastContainer && document.getElementById('toast-container')) return;
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);z-index:1001;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(toastContainer);
    }
  }

  function showToast(message, type = 'info', duration = 3000) {
    initToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `background-color:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;color:var(--text-primary);font-size:0.875rem;box-shadow:var(--shadow-lg);animation:slideUp 0.3s ease;pointer-events:auto;${type==='success'?'border-color:var(--success);':type==='error'?'border-color:var(--danger);':type==='warning'?'border-color:var(--warning);':''}`;
    const iconMap = { success: Icons.check, error: Icons.x, warning: Icons.alertCircle, info: Icons.alertCircle };
    const iconColorMap = { success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--primary)' };
    toast.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span style="color:${iconColorMap[type]};display:flex;">${iconMap[type]}</span><span>${escapeHtml(message)}</span></div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)'; toast.style.transition = 'all 0.3s ease';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  }

  /**
   * Show a toast with an Undo button.
   * @param {string} message - Toast message
   * @param {Function} onUndo - Called if user clicks Undo before timeout
   * @param {number} duration - Ms before auto-dismiss (default 5000)
   */
  function showUndoToast(message, onUndo, duration = 5000) {
    initToastContainer();

    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.style.cssText = `
      background-color: var(--bg-secondary);
      border: 1px solid var(--success);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      color: var(--text-primary);
      font-size: 0.875rem;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.3s ease;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-width: 240px;
    `;

    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:var(--success);display:flex;">${Icons.check}</span>
        <span>${escapeHtml(message)}</span>
      </div>
      <button class="undo-btn" style="
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        cursor: pointer;
        white-space: nowrap;
        font-family: inherit;
      ">UNDO</button>
    `;

    toastContainer.appendChild(toast);

    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };

    // Auto-dismiss after duration
    const autoTimer = setTimeout(dismiss, duration);

    // Undo button
    toast.querySelector('.undo-btn').addEventListener('click', () => {
      clearTimeout(autoTimer);
      dismiss();
      onUndo();
    });

    return dismiss;  // caller can force-dismiss
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
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function getPriorityClass(priority) { return { low:'priority-low', medium:'priority-medium', high:'priority-high', critical:'priority-critical' }[priority] || 'priority-medium'; }
  function getPriorityLabel(priority) { return priority.charAt(0).toUpperCase() + priority.slice(1); }

  function createDeadlineBadge(dateStr) {
    const days = Storage.getDaysUntil(dateStr);
    const relative = Storage.getRelativeDays(dateStr);
    let className = 'deadline-days';
    if (days < 0 || days <= 3) className += ' urgent';
    else if (days <= 7) className += ' soon';
    return `<span class="${className}">${relative}</span>`;
  }

  function getRepeatDaysLabel(repeatDays) {
    if (!repeatDays || repeatDays.length === 0) return '';
    if (repeatDays.length === 7) return 'Every day';
    return repeatDays.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
  }

  function createDateRangeBadge(startDate, dueDate) {
    if (!dueDate && !startDate) return '';
    if (!startDate || startDate === dueDate) return createDeadlineBadge(dueDate);
    const daysUntilEnd = Storage.getDaysUntil(dueDate);
    let className = 'deadline-days';
    if (daysUntilEnd < 0 || daysUntilEnd <= 3) className += ' urgent';
    else if (daysUntilEnd <= 7) className += ' soon';
    return `<span class="${className}">${Storage.formatDisplayDate(startDate)} - ${Storage.formatDisplayDate(dueDate)}</span>`;
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  function setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Ctrl/Meta + K: Command Palette (Search Tasks as fallback)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-tasks');
        if (searchInput) {
          searchInput.focus();
        } else {
          window.location.href = 'tasks.html';
        }
      }

      // Quick Nav
      if (e.altKey) {
        const navMap = { '1': 'index.html', '2': 'tasks.html', '3': 'calendar.html', '4': 'timer.html' };
        if (navMap[e.key]) window.location.href = navMap[e.key];
      }
    });
  }

  function getSubjectColor(subjectName) {
    const subject = Storage.getSubjectByName(subjectName);
    return subject ? subject.color : '#6B7280';
  }

  function hexToRgb(hex) {
    if (!hex) return '59, 130, 246';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0,2),16), g = parseInt(hex.substring(2,4),16), b = parseInt(hex.substring(4,6),16);
    if (isNaN(r)||isNaN(g)||isNaN(b)) return '59, 130, 246';
    return `${r}, ${g}, ${b}`;
  }

  function isValidHexColor(hex) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
  }

  function getFormData(form) {
    const formData = new FormData(form), data = {};
    for (const [key, value] of formData.entries()) data[key] = value;
    return data;
  }

  function populateForm(form, data) {
    Object.keys(data).forEach(key => {
      const field = form.elements[key];
      if (field) field.type === 'checkbox' ? (field.checked = data[key]) : (field.value = data[key]);
    });
  }

  function createProgressBar(current, max, label, showPercentage = true) {
    const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    // SECURITY: Escape label to prevent XSS from dynamic progress labels
    return `
      <div class="progress-wrapper">
        <div class="progress-header">
          <span class="progress-label">${escapeHtml(label)}</span>
          <span class="progress-value">${current} / ${max}${showPercentage ? ` (${percentage}%)` : ''}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${percentage}%;"></div>
        </div>
      </div>
    `;
  }

  function createEmptyStateHtml(options) {
    const { title='No Data', text='Nothing to show here yet.', icon='empty', actionText='', actionId='', padding='4rem' } = options;
    return `
      <div class="empty-state" style="padding:${padding};">
        <div class="empty-state-icon">${Icons[icon]||Icons.empty}</div>
        <h4 style="color:white;font-size:1.25rem;margin-bottom:8px;font-weight:600;">${escapeHtml(title)}</h4>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:1.5rem;max-width:250px;">${escapeHtml(text)}</p>
        ${actionText ? `<button class="btn btn-primary" id="${escapeHtml(actionId)}">${escapeHtml(actionText)}</button>` : ''}
      </div>
    `;
  }

  // ── Notification & background timer checks ─────────────────────────────────

  function checkTaskNotifications() {
    const settings = Storage.getSettings();
    if (settings.task_notifications === false) return;
    const now = new Date();
    const currentDate = Storage.formatDate(now);
    const currentTime = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    Storage.getTasksByDate(currentDate).forEach(task => {
      if (!task.completed && task.dueTime && task.dueTime <= currentTime) {
        const notifiedKey = `notified_${task.id}_${currentDate}`;
        if (!sessionStorage.getItem(notifiedKey)) {
          showTaskNotification(task);
          sessionStorage.setItem(notifiedKey, 'true');
        }
      }
    });
  }

  function showTaskNotification(task) {
    const body = `It's time for: ${task.title}`;

    // Visual feedback on Dashboard
    const pendingPill = document.getElementById('stat-pending')?.closest('.stat-pill');
    if (pendingPill) {
      pendingPill.classList.add('flash-pulse');
      setTimeout(() => pendingPill.classList.remove('flash-pulse'), 10000);
    }

    // Check application settings
    const settings = Storage.getSettings();
    if (settings.task_notifications !== false) {
      if (typeof PWAManager !== 'undefined' && PWAManager.sendNotification) {
        PWAManager.sendNotification('Task Due Now', { body });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Task Due Now', { body });
      }
    }

    showToast(body, 'info', 10000);
  }

  /**
   * FIX: Background timer check — use a per-tab session flag so only the tab
   * that first detects the expiry processes the completion. Other tabs will see
   * the updated state on their next visibilitychange or their own check cycle.
   */
  const _tabId = Date.now().toString(36) + Math.random().toString(36).slice(2);

  function checkTimerBackground() {
    if (getCurrentPage() === 'timer') return;
    const timerState = Storage.getTimerState();
    if (!timerState || timerState.state !== 'running' || !timerState.endTime) return;
    if (Date.now() < timerState.endTime) return;

    // Guard: use sessionStorage so only one tab handles this expiry event
    const lockKey = `timer_handled_${timerState.endTime}`;
    if (sessionStorage.getItem(lockKey)) return;
    sessionStorage.setItem(lockKey, _tabId);

    // Small delay then verify we still hold the lock (race condition mitigation)
    setTimeout(() => {
      if (sessionStorage.getItem(lockKey) !== _tabId) return;
      Storage.completeTimerSession(timerState);
      const completedType = timerState.type;
      const body = completedType === 'work' ? 'Great job! Time for a break.' : 'Ready to get back to work?';
      const title = completedType === 'work' ? 'Work Session Complete!' : 'Break Finished!';

      const settings = Storage.getSettings();
      if (settings.notifications !== false) {
        if (typeof PWAManager !== 'undefined' && PWAManager.sendNotification) {
          PWAManager.sendNotification(title, { body });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }

      showToast(body, 'success', 10000);
    }, 200);
  }

  const THEMES = {
    default: { primary: '#3B82F6', secondary: '#8B5CF6' },
    emerald: { primary: '#10B981', secondary: '#3B82F6' },
    coral: { primary: '#F43F5E', secondary: '#F97316' },
    amber: { primary: '#F59E0B', secondary: '#D97706' }
  };

  function applyTheme(themeName) {
    const theme = THEMES[themeName] || THEMES.default;
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--secondary', theme.secondary);
    // You'd also update the RGB variables if they exist in CSS
  }

  function init() {
    const savedTheme = Storage.loadData(Storage.KEYS.THEME, 'default');
    applyTheme(savedTheme);

    initNavigation();
    setupGlobalShortcuts();

    // Handle storage quota exceeded
    window.addEventListener('studyflow_storageQuotaExceeded', (e) => {
      showToast('Storage full! Data may not be saved. Clear history to free space.', 'error', 10000);
    });

    // Prune old session data once per browser session to keep localStorage lean
    if (typeof Storage !== 'undefined' && Storage.pruneSessions) {
      Storage.pruneSessions(365);
    }

    initToastContainer();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) closeModal(activeModal);
    });
    setInterval(checkTaskNotifications, 60000);
    setTimeout(checkTaskNotifications, 1000);
    // FIX: Reduced to 5s interval and added tab guard inside the function
    setInterval(checkTimerBackground, 5000);
  }

  return {
    Icons, getIcon, init, initNavigation, getCurrentPage,
    applyTheme, THEMES,
    createModal, openModal, closeModal, confirm, alert,
    showToast, showUndoToast,
    debounce, formatDuration, formatNumber, getPriorityClass, getPriorityLabel,
    getRepeatDaysLabel, createDeadlineBadge, createDateRangeBadge,
    escapeHtml, getSubjectColor, hexToRgb, isValidHexColor,
    getFormData, populateForm,
    createProgressBar,
    createEmptyStateHtml
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
