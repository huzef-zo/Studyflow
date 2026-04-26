/**
 * StudyFlow - Main Application Module
 * Shared functionality, UI components, and initialization
 */

const App = (function() {
  'use strict';

  // SVG Icons
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
    download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    upload: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    alertCircle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    bookOpen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    target: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    award: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>`,
    empty: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    history: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 16 3-3 3 3 5-5"/></svg>`
  };

  /**
   * Create an icon element
   */
  function getIcon(name) {
    return Icons[name] || '';
  }

  /**
   * Render the sidebar navigation
   */
  function renderSidebar(isCollapsed = false) {
    const currentPage = getCurrentPage();
    
    const navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', href: 'index.html' },
      { id: 'tasks', label: 'Tasks', icon: 'tasks', href: 'tasks.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'calendar.html' },
      { id: 'timer', label: 'Timer', icon: 'timer', href: 'timer.html' },
      { id: 'goals', label: 'Goals', icon: 'goals', href: 'goals.html' },
      { id: 'history', label: 'Analytics', icon: 'history', href: 'history.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ];

    return `
      <aside class="sidebar ${isCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header" style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <a href="index.html" class="sidebar-logo" style="flex: 1; min-width: 0;">
            ${Icons.bookOpen}
            <span class="nav-item-text">StudyFlow</span>
          </a>
          <button id="sidebar-toggle" class="btn-icon btn-ghost" title="${isCollapsed ? 'Expand' : 'Collapse'}" style="margin-right: -10px;">
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
          <div class="text-secondary text-center nav-item-text" style="font-size: 0.75rem;">
            All data saved locally
          </div>
        </div>
      </aside>
    `;
  }

  /**
   * Render the bottom navigation
   */
  function renderBottomNav() {
    const currentPage = getCurrentPage();
    
    const navItems = [
      { id: 'dashboard', label: 'Home', icon: 'home', href: 'index.html' },
      { id: 'tasks', label: 'Tasks', icon: 'tasks', href: 'tasks.html' },
      { id: 'timer', label: 'Timer', icon: 'timer', href: 'timer.html' },
      { id: 'goals', label: 'Goals', icon: 'goals', href: 'goals.html' },
      { id: 'history', label: 'Analytics', icon: 'history', href: 'history.html' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar', href: 'calendar.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: 'settings.html' }
    ];

    return `
      <nav class="bottom-nav">
        ${navItems.map(item => `
          <a href="${item.href}" class="bottom-nav-item ${currentPage === item.id ? 'active' : ''}">
            ${Icons[item.icon]}
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
    `;
  }

  /**
   * Get current page identifier
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    
    const pageMap = {
      'index.html': 'dashboard',
      '': 'dashboard',
      'tasks.html': 'tasks',
      'calendar.html': 'calendar',
      'timer.html': 'timer',
      'goals.html': 'goals',
      'history.html': 'history',
      'settings.html': 'settings'
    };
    
    return pageMap[filename] || 'dashboard';
  }

  /**
   * Toggle sidebar state
   */
  function toggleSidebar() {
    const isCollapsed = !Storage.loadData('is_sidebar_collapsed', false);
    Storage.saveData('is_sidebar_collapsed', isCollapsed);

    initNavigation();

    // Toggle body class for layout adjustment
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }

  /**
   * Initialize navigation
   */
  function initNavigation() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const bottomNavContainer = document.getElementById('bottom-nav-container');
    
    const isCollapsed = Storage.loadData('is_sidebar_collapsed', false);

    if (sidebarContainer) {
      sidebarContainer.innerHTML = renderSidebar(isCollapsed);

      // Sidebar toggle listener
      const toggleBtn = sidebarContainer.querySelector('#sidebar-toggle');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.preventDefault();
          toggleSidebar();
        };
      }

      // Auto-collapse on tab selection
      const navItems = sidebarContainer.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.onclick = () => {
          Storage.saveData('is_sidebar_collapsed', true);
        };
      });

      if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
      } else {
        document.body.classList.remove('sidebar-collapsed');
      }
    }
    
    if (bottomNavContainer) {
      bottomNavContainer.innerHTML = renderBottomNav();
    }
  }

  // ============================================
  // Modal System
  // ============================================

  let activeModal = null;

  /**
   * Create a modal
   */
  function createModal(options) {
    const { id, title, content, footer, onClose } = options;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = id;
    
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" aria-label="Close modal">
            ${Icons.x}
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    
    // Close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      closeModal(modal);
    });
    
    // Store close callback
    modal._onClose = onClose;
    
    return modal;
  }

  /**
   * Open a modal
   */
  function openModal(modal) {
    document.body.appendChild(modal);
    // Trigger reflow for animation
    modal.offsetHeight;
    modal.classList.add('active');
    activeModal = modal;
    
    // Focus trap
    const focusableElements = modal.querySelectorAll('button, input, select, textarea');
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Close a modal
   */
  function closeModal(modal) {
    if (!modal) modal = activeModal;
    if (!modal) return;
    
    modal.classList.remove('active');
    
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      if (modal._onClose) {
        modal._onClose();
      }
    }, 200);
    
    activeModal = null;
  }

  /**
   * Show a confirmation dialog
   */
  function confirm(options) {
    return new Promise((resolve) => {
      const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = options;
      
      const modal = createModal({
        id: 'confirm-modal',
        title: title,
        content: `<p style="margin: 0; color: var(--text-secondary);">${message}</p>`,
        footer: `
          <button class="btn btn-secondary" data-action="cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${confirmText}</button>
        `,
        onClose: () => resolve(false)
      });
      
      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeModal(modal);
        resolve(false);
      });
      
      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        closeModal(modal);
        resolve(true);
      });
      
      openModal(modal);
    });
  }

  /**
   * Show an alert dialog
   */
  function alert(options) {
    return new Promise((resolve) => {
      const { title, message, buttonText = 'OK' } = options;
      
      const modal = createModal({
        id: 'alert-modal',
        title: title,
        content: `<p style="margin: 0; color: var(--text-secondary);">${message}</p>`,
        footer: `<button class="btn btn-primary" data-action="ok">${buttonText}</button>`,
        onClose: () => resolve()
      });
      
      modal.querySelector('[data-action="ok"]').addEventListener('click', () => {
        closeModal(modal);
        resolve();
      });
      
      openModal(modal);
    });
  }

  // ============================================
  // Toast Notifications
  // ============================================

  let toastContainer = null;

  function initToastContainer() {
    if (toastContainer && document.getElementById('toast-container')) return;
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 88px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1001;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      `;
      document.body.appendChild(toastContainer);
    }
  }

  function showToast(message, type = 'info', duration = 3000) {
    initToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background-color: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      color: var(--text-primary);
      font-size: 0.875rem;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.3s ease;
      pointer-events: auto;
      ${type === 'success' ? 'border-color: var(--success);' : ''}
      ${type === 'error' ? 'border-color: var(--danger);' : ''}
      ${type === 'warning' ? 'border-color: var(--warning);' : ''}
    `;
    
    const iconMap = {
      success: Icons.check,
      error: Icons.x,
      warning: Icons.alertCircle,
      info: Icons.alertCircle
    };
    
    const iconColorMap = {
      success: 'var(--success)',
      error: 'var(--danger)',
      warning: 'var(--warning)',
      info: 'var(--primary)'
    };
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: ${iconColorMap[type]}; display: flex;">${iconMap[type]}</span>
        <span>${message}</span>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  // ============================================
  // Utility Functions
  // ============================================

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Format minutes to hours and minutes
   */
  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  /**
   * Format number with commas
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Get priority class
   */
  function getPriorityClass(priority) {
    const classMap = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      critical: 'priority-critical'
    };
    return classMap[priority] || 'priority-medium';
  }

  /**
   * Get priority label
   */
  function getPriorityLabel(priority) {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  /**
   * Create a deadline badge
   */
  function createDeadlineBadge(dateStr) {
    const days = Storage.getDaysUntil(dateStr);
    const relative = Storage.getRelativeDays(dateStr);
    
    let className = 'deadline-days';
    if (days < 0) {
      className += ' urgent';
    } else if (days <= 3) {
      className += ' urgent';
    } else if (days <= 7) {
      className += ' soon';
    }
    
    return `<span class="${className}">${relative}</span>`;
  }

  /**
   * Format repeating days
   */
  function getRepeatDaysLabel(repeatDays) {
    if (!repeatDays || repeatDays.length === 0) return '';
    if (repeatDays.length === 7) return 'Every day';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return repeatDays.map(d => dayNames[d]).join(', ');
  }

  /**
   * Create a date range badge
   */
  function createDateRangeBadge(startDate, dueDate) {
    if (!dueDate && !startDate) return '';

    if (!startDate || startDate === dueDate) {
      return createDeadlineBadge(dueDate);
    }

    const start = Storage.formatDisplayDate(startDate);
    const end = Storage.formatDisplayDate(dueDate);
    const daysUntilEnd = Storage.getDaysUntil(dueDate);

    let className = 'deadline-days';
    if (daysUntilEnd < 0) {
      className += ' urgent';
    } else if (daysUntilEnd <= 3) {
      className += ' urgent';
    } else if (daysUntilEnd <= 7) {
      className += ' soon';
    }

    return `<span class="${className}">${start} - ${end}</span>`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get subject color
   */
  function getSubjectColor(subjectName) {
    const subject = Storage.getSubjectByName(subjectName);
    return subject ? subject.color : '#6B7280';
  }

  /**
   * Convert hex color to RGB string (r, g, b)
   */
  function hexToRgb(hex) {
    if (!hex) return '59, 130, 246'; // Default primary blue

    // Remove hash
    hex = hex.replace('#', '');

    // Expand short hex
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) return '59, 130, 246';

    return `${r}, ${g}, ${b}`;
  }

  // ============================================
  // Form Helpers
  // ============================================

  /**
   * Get form data as object
   */
  function getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }
    
    return data;
  }

  /**
   * Populate form with data
   */
  function populateForm(form, data) {
    Object.keys(data).forEach(key => {
      const field = form.elements[key];
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = data[key];
        } else {
          field.value = data[key];
        }
      }
    });
  }

  // ============================================
  // Progress Bar Utilities
  // ============================================

  /**
   * Create a progress bar
   */
  function createProgressBar(current, max, label, showPercentage = true) {
    const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    const color = label.toLowerCase().includes('focus') || label.toLowerCase().includes('hour') ? '#8B5CF6' : '#3B82F6';
    
    return `
      <div class="progress-wrapper">
        <div class="progress-header">
          <span class="progress-label">${label}</span>
          <span class="progress-value" style="color: ${color}">${current} / ${max}${showPercentage ? ` (${percentage}%)` : ''}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%; background: ${color}; color: ${color}"></div>
        </div>
      </div>
    `;
  }

  // ============================================
  // Empty State
  // ============================================

  /**
   * Create an empty state HTML string
   */
  function createEmptyStateHtml(options) {
    const {
      title = 'No Data',
      text = 'Nothing to show here yet.',
      icon = 'empty',
      actionText = '',
      actionId = '',
      padding = '4rem'
    } = options;

    return `
      <div class="empty-state" style="padding: ${padding};">
        <div class="empty-state-icon">${Icons[icon] || Icons.empty}</div>
        <h4 style="color: white; font-size: 1.25rem; margin-bottom: 8px; font-weight: 600;">${escapeHtml(title)}</h4>
        <p style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.5rem; max-width: 250px;">${escapeHtml(text)}</p>
        ${actionText ? `<button class="btn btn-primary" id="${actionId}">${escapeHtml(actionText)}</button>` : ''}
      </div>
    `;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Check for tasks due at the current time and show notifications
   */
  function checkTaskNotifications() {
    const settings = Storage.getSettings();
    if (settings.task_notifications === false) return;

    const now = new Date();
    const currentDate = Storage.formatDate(now);
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' +
                        now.getMinutes().toString().padStart(2, '0');

    // Use Storage.getTasksByDate to include repeating tasks
    const tasks = Storage.getTasksByDate(currentDate);

    tasks.forEach(task => {
      // Notify if task has a due time, is not completed, and is due now or was due earlier today
      // (to be robust against timer throttling/missed checks)
      if (!task.completed && task.dueTime && task.dueTime <= currentTime) {
        // Prevent multiple notifications for the same task in the same day/session
        const notifiedKey = `notified_${task.id}_${currentDate}`;
        if (!sessionStorage.getItem(notifiedKey)) {
          showTaskNotification(task);
          sessionStorage.setItem(notifiedKey, 'true');
        }
      }
    });
  }

  /**
   * Show a task notification
   */
  function showTaskNotification(task) {
    const title = 'Task Due Now';
    const body = `It's time for: ${task.title}`;

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }

    // App toast
    showToast(body, 'info', 10000);
  }

  /**
   * Check for timer completion in background
   */
  function checkTimerBackground() {
    // Skip if we are on the timer page, as Timer.js handles its own state
    if (getCurrentPage() === 'timer') return;

    const timerState = Storage.getTimerState();
    if (!timerState || timerState.state !== 'running' || !timerState.endTime) return;

    if (Date.now() >= timerState.endTime) {
      // Timer finished in background
      const newState = Storage.completeTimerSession(timerState);

      // Notify user
      const completedType = timerState.type;
      const title = completedType === 'work' ? 'Work Session Complete!' : 'Break Finished!';
      const body = completedType === 'work' ? 'Great job! Time for a break.' : 'Ready to get back to work?';

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }

      showToast(body, 'success', 10000);

      // If we are on the timer page, the Timer module's own interval or visibility change listener
      // will handle the UI update. If we're on another page, we've updated storage so
      // the timer page will see the new 'idle' state when the user navigates back.
    }
  }
   

  function init() {
    initNavigation();
    initToastContainer();
    
    // Add keyboard shortcut for closing modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) {
        closeModal(activeModal);
      }
    });

    // Check for task notifications every minute
    setInterval(checkTaskNotifications, 60000);
    // Initial check
    setTimeout(checkTaskNotifications, 1000);

    // Check for timer completion every second
    setInterval(checkTimerBackground, 1000);
  }

  // Public API
  return {
    Icons,
    getIcon,
    init,
    initNavigation,
    getCurrentPage,
    
    // Modal
    createModal,
    openModal,
    closeModal,
    confirm,
    alert,
    
    // Toast
    showToast,
    
    // Utilities
    debounce,
    formatDuration,
    formatNumber,
    getPriorityClass,
    getPriorityLabel,
    getRepeatDaysLabel,
    createDeadlineBadge,
    createDateRangeBadge,
    escapeHtml,
    getSubjectColor,
    hexToRgb,
    
    // Forms
    getFormData,
    populateForm,
    
    // Progress
    createProgressBar,
    
    // Empty State
    createEmptyStateHtml
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);

// Make App available globally
window.App = App;

