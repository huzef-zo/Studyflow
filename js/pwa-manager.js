/**
 * PWA Utility Module
 * Handles all PWA-specific functionality including:
 * - Service Worker management
 * - App lifecycle
 * - Offline detection
 * - Installation prompts
 * - Update notifications
 */

const PWAManager = (() => {
  'use strict';
  
  let config = {
    name: 'StudyFlow',
    swPath: 'sw.js',
    scope: './',
    updateCheckInterval: 60000, // 60 seconds
    debug: true
  };
  
  const log = (message, data = null) => {
    if (config.debug) {
      console.log(`[PWA Manager] ${message}`, data || '');
    }
  };
  
  // ============================================
  // UPDATE CHECKING
  // ============================================
  const setupUpdateChecking = (registration) => {
    // Check for updates on interval
    setInterval(() => {
      registration.update().catch((error) => {
        log('Update check failed', error);
      });
    }, config.updateCheckInterval);
  };
  
  // ============================================
  // INSTALL PROMPT HANDLING
  // ============================================
  let deferredPrompt = null;
  
  const setupInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      log('Install prompt deferred - ready to show');
      emitEvent('install-prompt-ready');
    });
    
    window.addEventListener('appinstalled', () => {
      log('App installed successfully');
      emitEvent('app-installed');
      deferredPrompt = null;
    });
  };
  
  // ============================================
  // OFFLINE/ONLINE DETECTION
  // ============================================
  const setupOfflineDetection = () => {
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        log('App is now online');
        document.documentElement.setAttribute('data-online', 'true');
        emitEvent('online');
      } else {
        log('App is now offline');
        document.documentElement.setAttribute('data-online', 'false');
        emitEvent('offline');
      }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Set initial state
    updateOnlineStatus();
  };
  
  // ============================================
  // STANDALONE MODE DETECTION
  // ============================================
  const isStandaloneMode = () => {
    return window.navigator.standalone === true || 
           window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: fullscreen)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           window.matchMedia('(display-mode: window-controls-overlay)').matches;
  };
  
  const setupStandaloneDetection = () => {
    if (isStandaloneMode()) {
      document.documentElement.setAttribute('data-standalone', 'true');
      log('App running in standalone/PWA mode');
      emitEvent('standalone-mode');
    } else {
      document.documentElement.setAttribute('data-standalone', 'false');
      log('App running in browser mode');
      emitEvent('browser-mode');
    }
    
    // Listen for display mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
      if (e.matches) {
        document.documentElement.setAttribute('data-standalone', 'true');
        emitEvent('standalone-mode');
      } else {
        document.documentElement.setAttribute('data-standalone', 'false');
        emitEvent('browser-mode');
      }
    });
  };
  
  // ============================================
  // NOTIFICATIONS
  // ============================================
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      log('Notifications not supported');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      log('Notification permission already granted');
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      log('Notification permission requested', { granted });
      return granted;
    }
    
    log('Notification permission denied');
    return false;
  };
  
  const sendNotification = (title, options = {}) => {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: './icon-192.png',
          badge: './icon-192.png',
          ...options
        });
      });
    }
  };
  
  // ============================================
  // BACKGROUND SYNC
  // ============================================
  const requestBackgroundSync = async (tag = 'sync-tasks') => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      log('Background Sync not supported');
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      log('Background sync registered', { tag });
      emitEvent('sync-registered');
      return true;
    } catch (error) {
      log('Background sync registration failed', error);
      return false;
    }
  };
  
  // ============================================
  // PERIODIC BACKGROUND SYNC
  // ============================================
  const requestPeriodicSync = async (tag = 'periodic-tasks', minInterval = 60000) => {
    if (!('serviceWorker' in navigator) || !('PeriodicSyncManager' in window)) {
      log('Periodic Sync not supported');
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.periodicSync.register(tag, { minInterval });
      log('Periodic sync registered', { tag, minInterval });
      return true;
    } catch (error) {
      log('Periodic sync registration failed', error);
      return false;
    }
  };
  
  // ============================================
  // INSTALL PROMPT
  // ============================================
  const promptInstall = async () => {
    if (!deferredPrompt) {
      log('No install prompt available');
      return false;
    }
    
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        log('User accepted installation');
        emitEvent('install-accepted');
        return true;
      } else {
        log('User dismissed installation');
        emitEvent('install-dismissed');
        return false;
      }
    } catch (error) {
      log('Installation prompt failed', error);
      return false;
    }
  };
  
  const isInstallPromptAvailable = () => {
    return deferredPrompt !== null;
  };
  
  // ============================================
  // DISPLAY MODE DETECTION
  // ============================================
  const getDisplayMode = () => {
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) {
      return 'window-controls-overlay';
    }
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return 'standalone';
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return 'minimal-ui';
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return 'fullscreen';
    }
    return 'browser';
  };
  
  // ============================================
  // VISIBILITY & LIFECYCLE
  // ============================================
  const setupVisibilityHandling = () => {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        log('App hidden - reducing resource usage');
        emitEvent('app-hidden');
      } else {
        log('App visible - resuming full functionality');
        emitEvent('app-visible');
      }
    });
  };
  
  // ============================================
  // EVENT SYSTEM
  // ============================================
  const eventListeners = {};
  
  const on = (eventName, callback) => {
    if (!eventListeners[eventName]) {
      eventListeners[eventName] = [];
    }
    eventListeners[eventName].push(callback);
  };
  
  const off = (eventName, callback) => {
    if (eventListeners[eventName]) {
      eventListeners[eventName] = eventListeners[eventName].filter(cb => cb !== callback);
    }
  };
  
  const emitEvent = (eventName, data = null) => {
    if (eventListeners[eventName]) {
      eventListeners[eventName].forEach(callback => {
        callback(data);
      });
    }
  };
  
  // ============================================
  // INITIALIZATION
  // ============================================
  const init = async (customConfig = {}) => {
    config = { ...config, ...customConfig };
    log('Initializing PWA Manager', { config });
    
    // Setup all features
    setupInstallPrompt();
    setupOfflineDetection();
    setupStandaloneDetection();
    setupVisibilityHandling();
    
    // NOTE: The call to registerServiceWorker has been removed
    
    log('PWA Manager initialized successfully');
    emitEvent('ready');
    
    // Return undefined since no service worker registration is done
    return undefined;
  };
  
  // ============================================
  // PUBLIC API
  // ============================================
  return {
    init,
    setupUpdateChecking,
    setupInstallPrompt,
    setupOfflineDetection,
    setupStandaloneDetection,
    setupVisibilityHandling,
    isStandaloneMode,
    getDisplayMode,
    requestNotificationPermission,
    sendNotification,
    requestBackgroundSync,
    requestPeriodicSync,
    promptInstall,
    isInstallPromptAvailable,
    on,
    off,
    emitEvent
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    PWAManager.init();
  });
} else {
  PWAManager.init();
}
