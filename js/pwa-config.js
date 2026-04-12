/**
 * PWA Configuration
 * Centralized configuration for PWA behavior and features
 */

const PWAConfig = {
  // App Identity
  app: {
    name: 'StudyFlow',
    shortName: 'StudyFlow',
    id: 'studyflow-dashboard',
    description: 'Your personal space-themed study organizer and productivity hub'
  },

  // Service Worker
  serviceWorker: {
    path: 'sw.js',
    scope: '/',
    updateCheckInterval: 60000, // 60 seconds
    cacheVersioning: true
  },

  // Features
  features: {
    offlineSupport: true,
    backgroundSync: true,
    periodicSync: true,
    notifications: true,
    installPrompt: true,
    windowControlsOverlay: true
  },

  // Caching Strategy
  caching: {
    networkTimeout: 3000, // 3 seconds before timeout
    strategies: {
      html: 'network-first',
      css: 'cache-first',
      js: 'cache-first',
      images: 'cache-first',
      fonts: 'cache-first',
      api: 'stale-while-revalidate'
    }
  },

  // Display Modes (in order of preference)
  displayModes: [
    'window-controls-overlay',
    'standalone',
    'minimal-ui',
    'browser'
  ],

  // Platform-specific configurations
  platforms: {
    android: {
      theme_color: '#3B82F6',
      background_color: '#000000',
      orientation: 'portrait-primary'
    },
    ios: {
      statusBarStyle: 'black-translucent',
      fullscreen: true
    },
    windows: {
      tileColor: '#0B0F19',
      displayName: 'StudyFlow'
    }
  },

  // Performance
  performance: {
    preloadCriticalAssets: true,
    lazyLoadImages: true,
    minifyAssets: true
  },

  // Logging
  debug: {
    enabled: false,
    logServiceWorker: true,
    logFetch: false,
    logCache: false
  }
};

export default PWAConfig;
