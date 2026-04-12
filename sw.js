const CACHE_VERSION = 'v2';
const CACHE_NAME = `studyflow-${CACHE_VERSION}`;
const OFFLINE_CACHE = `studyflow-offline-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './calendar.html',
  './goals.html',
  './history.html',
  './settings.html',
  './tasks.html',
  './timer.html',
  './css/style.css',
  './js/app.js',
  './js/storage.js',
  './js/pwa-manager.js',
  './js/pwa-config.js',
  './js/calendar.js',
  './js/goals.js',
  './js/history.js',
  './js/tasks.js',
  './js/timer.js',
  './manifest.json'
];

// ============================================
// SERVICE WORKER LIFECYCLE: INSTALL
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Install event triggered');
  
  event.waitUntil(
    Promise.all([
      // Cache all core assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      // Pre-cache offline fallback
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('[SW] Setting up offline cache');
        return cache.add('./index.html');
      })
    ])
  );
  
  // Take control immediately
  self.skipWaiting();
});

// ============================================
// SERVICE WORKER LIFECYCLE: ACTIVATE
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event triggered');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Claim all clients immediately
  self.clients.claim();
});

// ============================================
// FETCH EVENT HANDLER - INTELLIGENT ROUTING
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (!url.origin.includes(self.location.origin)) {
    return;
  }
  
  // Route based on request type
  if (request.method === 'GET') {
    // HTML pages: Network-first with fallback to cache
    if (request.url.endsWith('.html') || request.url.endsWith('/')) {
      event.respondWith(networkFirstStrategy(request, 3000));
    }
    // CSS and JS: Cache-first (versioned)
    else if (request.url.endsWith('.css') || request.url.endsWith('.js')) {
      event.respondWith(cacheFirstStrategy(request));
    }
    // Images and fonts: Cache-first with network fallback
    else if (/\.(png|jpg|jpeg|gif|svg|woff|woff2)$/i.test(request.url)) {
      event.respondWith(cacheFirstStrategy(request));
    }
    // Default: Stale-while-revalidate
    else {
      event.respondWith(staleWhileRevalidateStrategy(request));
    }
  }
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Network-first strategy with timeout fallback to cache
 * Used for HTML pages to ensure fresh content
 */
function networkFirstStrategy(request, timeout = 3000) {
  return new Promise((resolve, reject) => {
    let timeoutId = setTimeout(() => {
      console.log('[SW] Network timeout, using cache:', request.url);
      resolve(caches.match(request).then(response => response || getOfflineFallback(request)));
    }, timeout);
    
    fetch(request)
      .then((networkResponse) => {
        clearTimeout(timeoutId);
        
        if (!networkResponse || networkResponse.status !== 200) {
          console.log('[SW] Invalid network response, using cache:', request.url);
          resolve(caches.match(request).then(response => response || getOfflineFallback(request)));
          return;
        }
        
        // Update cache in background
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        clearTimeout(timeoutId);
        resolve(networkResponse);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.log('[SW] Network error, using cache:', request.url, error);
        resolve(caches.match(request).then(response => response || getOfflineFallback(request)));
      });
  });
}

/**
 * Cache-first strategy
 * Used for assets that don't change frequently (CSS, JS, images)
 */
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then((cachedResponse) => {
      if (cachedResponse) {
        console.log('[SW] Cache hit:', request.url);
        return cachedResponse;
      }
      
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // Cache successful responses
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          
          return networkResponse;
        })
        .catch((error) => {
          console.log('[SW] Fetch failed:', request.url, error);
          return getOfflineFallback(request);
        });
    });
}

/**
 * Stale-while-revalidate strategy
 * Return cache immediately, update in background
 */
function staleWhileRevalidateStrategy(request) {
  return caches.match(request)
    .then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.log('[SW] Background fetch failed:', request.url, error);
          return cachedResponse || getOfflineFallback(request);
        });
      
      return cachedResponse || fetchPromise;
    });
}

/**
 * Offline fallback handler
 */
function getOfflineFallback(request) {
  if (request.destination === 'document') {
    return caches.match('./index.html').catch(() => new Response('Offline - please check your connection', { status: 503 }));
  }
  
  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#1a1a1a" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#666">Image</text></svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
  
  return new Response('Resource unavailable offline', { status: 503 });
}

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  try {
    const allClients = await self.clients.matchAll();
    
    for (const client of allClients) {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        data: { synced: true, timestamp: Date.now() }
      });
    }
    
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync error:', error);
    throw error;
  }
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  const options = {
    body: event.data ? event.data.text() : 'StudyFlow notification',
    icon: 'https://huzef-zo.github.io/Studyflow/icon-192.png',
    badge: 'https://huzef-zo.github.io/Studyflow/icon-192.png',
    tag: 'studyflow-notification',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('StudyFlow', options)
  );
});

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if not open
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});

// ============================================
// MESSAGE HANDLER (for client communication)
// ============================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received from client:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    event.ports[0].postMessage({ updated: false });
  }
});
