/**
 * PWA Configuration
 * FIX: Removed `export default` — file is loaded as a plain <script>, not an ES module.
 * Using export default in a non-module context throws SyntaxError in Safari/older Chromium.
 */

const PWAConfig = {
  app: {
    name: 'StudyFlow',
    shortName: 'StudyFlow',
    id: 'studyflow-dashboard',
    description: 'Your personal space-themed study organizer and productivity hub'
  },
  serviceWorker: {
    path: 'sw.js',
    scope: './',
    updateCheckInterval: 60000,
    cacheVersioning: true
  },
  features: {
    offlineSupport: true,
    backgroundSync: true,
    periodicSync: true,
    notifications: true,
    installPrompt: true,
    windowControlsOverlay: true
  },
  caching: {
    networkTimeout: 3000,
    strategies: {
      html: 'network-first',
      css: 'cache-first',
      js: 'cache-first',
      images: 'cache-first',
      fonts: 'cache-first',
      api: 'stale-while-revalidate'
    }
  },
  displayModes: [
    'window-controls-overlay',
    'standalone',
    'minimal-ui',
    'browser'
  ],
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
  performance: {
    preloadCriticalAssets: true,
    lazyLoadImages: true,
    minifyAssets: true
  },
  debug: {
    enabled: false,
    logServiceWorker: true,
    logFetch: false,
    logCache: false
  }
};
