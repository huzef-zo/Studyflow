# PWA Architecture & Flow Diagrams

## 1. Overall Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER / OS                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         PWA APPLICATION WINDOW (Standalone)          │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                        │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │              HTML / CSS / JS                     │ │   │
│  │  │  ┌────────────────┐  ┌────────────────────────┐ │ │   │
│  │  │  │  index.html    │  │  tasks.html            │ │ │   │
│  │  │  │  timer.html    │  │  goals.html            │ │ │   │
│  │  │  │  settings.html │  │  calendar.html         │ │ │   │
│  │  │  └────────────────┘  └────────────────────────┘ │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │    PWA Manager (js/pwa-manager.js)              │ │   │
│  │  │  • SW Registration                              │ │   │
│  │  │  • Offline Detection                            │ │   │
│  │  │  • Install Prompts                              │ │   │
│  │  │  • Notifications                                │ │   │
│  │  │  • Background Sync                              │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │    Local Storage / IndexedDB                     │ │   │
│  │  │    • Task Data                                   │ │   │
│  │  │    • User Preferences                            │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Service Worker (sw.js)                       │   │
│  │  • Request Interception                              │   │
│  │  • Cache Management                                  │   │
│  │  • Offline Fallbacks                                 │   │
│  │  • Background Sync Handler                           │   │
│  │  • Push Notifications Handler                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Cache Storage                                │   │
│  │  • studyflow-v2 (Main Cache)                         │   │
│  │    ├─ HTML Pages                                     │   │
│  │    ├─ CSS Files                                      │   │
│  │    ├─ JavaScript Files                               │   │
│  │    ├─ Images & Fonts                                 │   │
│  │    └─ manifest.json                                  │   │
│  │  • studyflow-offline-v2 (Offline Cache)              │   │
│  │    └─ Fallback Pages                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

         ↓ (Network Available)

┌─────────────────────────────────────────────────────────────┐
│                     NETWORK / SERVER                        │
├─────────────────────────────────────────────────────────────┤
│  • API Endpoints                                             │
│  • Static Assets                                             │
│  • Sync Data                                                 │
│  • Push Notifications                                        │
└─────────────────────────────────────────────────────────────┘
```

## 2. Service Worker Fetch Routing

```
HTTP Request from App
         ↓
    [sw.js]
         ↓
  Check Origin
     ↙    ↘
SAME    CROSS
ORIGIN  ORIGIN
  ↓       ↓
  ✓      ✗ Skip
  ↓
Check Request Method
     ↓
   GET?
   ↙  ↘
  ✓    ✗ Skip
  ↓
Check File Type
     ↓
  ┌─────────────────────────────────────────┐
  │                                         │
  ├─→ .html, / ?                           │
  │   Strategy: Network-First (3s timeout) │
  │   ↓                                     │
  │   Try Network (max 3s)                 │
  │   ├─ Success? → Return + Cache         │
  │   └─ Fail/Timeout? → Use Cache         │
  │                                         │
  ├─→ .css, .js ?                          │
  │   Strategy: Cache-First                │
  │   ↓                                     │
  │   Check Cache                          │
  │   ├─ Found? → Return Cached            │
  │   └─ Not found? → Fetch Network        │
  │                                         │
  ├─→ Images, Fonts ?                      │
  │   Strategy: Cache-First                │
  │   ↓                                     │
  │   Check Cache                          │
  │   ├─ Found? → Return Cached            │
  │   └─ Not found? → Fetch Network        │
  │                                         │
  └─→ Other Files ?                        │
      Strategy: Stale-While-Revalidate     │
      ↓                                     │
      Return Cache Immediately             │
      Update in Background                 │
  
      ↓
  Offline?
  ├─ HTML → Fallback Page
  ├─ Image → SVG Placeholder
  └─ Other → Offline Message
     ↓
  Return Response
     ↓
  Cache Updated (if needed)
```

## 3. Installation & Launch Flow

```
User Visits App
     ↓
[beforeinstallprompt]
  Event Fired
     ↓
  ┌─────────────────────────────────┐
  │ Install Prompt Ready            │
  │ PWAManager.on('install-prompt') │
  │ Show Custom Install Button      │
  └─────────────────────────────────┘
     ↓
User Clicks Install
     ↓
Browser Shows Install Dialog
     ↓
┌─────────────────────────────────────┐
│ User Confirms Installation          │
│ [Chrome/Edge]                       │
│ ✓ Add StudyFlow to your system      │
└─────────────────────────────────────┘
     ↓
Installation Process:
  1. Download manifest.json
  2. Validate manifest
  3. Download icons (192x192, 512x512)
  4. Create app entry
  5. Register protocols
     ↓
[appinstalled] Event
  PWAManager.on('app-installed')
     ↓
App Window Created
     ↓
┌─────────────────────────────────────┐
│  Standalone App Window              │
│  ┌─────────────────────────────────┐│
│  │ StudyFlow - Standalone App      ││
│  ├─────────────────────────────────┤│
│  │                                 ││
│  │  [App Content Here]             ││
│  │                                 ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
     ↓
Start URL Loaded
     ↓
Service Worker Activated
     ↓
App Ready for Use ✅
```

## 4. Online/Offline State Management

```
App Initializes
       ↓
  Check navigator.onLine
       ↓
       ├─→ true? → Online Mode ✓
       │     ↓
       │   PWAManager.on('online')
       │     ↓
       │   Enable:
       │   • Network requests
       │   • Background sync
       │   • API calls
       │     ↓
       │   Listen for offline event
       │
       └─→ false? → Offline Mode
             ↓
           PWAManager.on('offline')
             ↓
           Disable:
           • Network requests
           • Background sync
           • Real-time features
             ↓
           Enable:
           • Cached data
           • Local storage
           • Offline UI
             ↓
           Listen for online event
                ↓
           When online detected:
           ├─ Trigger background sync
           ├─ Refresh data
           ├─ Update UI
           ├─ PWAManager.on('online')
           └─ Resume normal operation
```

## 5. Caching Strategy Comparison

```
┌────────────────────────────────────────────────────────────┐
│ NETWORK-FIRST (HTML Pages)                                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Request → Network → Success? ────→ Return + Cache        │
│             ↓                                              │
│          Timeout (3s)                                      │
│             ↓                                              │
│            Try Cache → Return Cached                       │
│             ↓                                              │
│          Not Found? → Offline Fallback                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ CACHE-FIRST (CSS, JS, Images)                              │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Request → Cache → Found? ────────→ Return Cached         │
│             ↓                                              │
│          Not Found? → Network                              │
│             ↓                                              │
│          Success? → Cache + Return                         │
│             ↓                                              │
│          Fail? → Offline Fallback                          │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ STALE-WHILE-REVALIDATE (API Data)                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Request → Return Cache Immediately                        │
│             ↓                                              │
│          Fetch Network in Background                       │
│             ↓                                              │
│          Success? → Update Cache                           │
│             ↓                                              │
│          Notify App of Update                              │
│             ↓                                              │
│          App Updates UI with Fresh Data                    │
└────────────────────────────────────────────────────────────┘
```

## 6. Background Sync Flow

```
User Offline
    ↓
Data Created/Updated Locally
    ↓
Request sync registration
    ↓
PWAManager.requestBackgroundSync('sync-tasks')
    ↓
Service Worker registers sync tag
    ↓
App goes offline completely
    ↓
User comes online
    ↓
Browser detects connection
    ↓
Service Worker fires 'sync' event
    ↓
┌──────────────────────────┐
│ Sync Handler Triggered   │
│                          │
│ if (event.tag === 'sync-tasks') {
│   event.waitUntil(syncTasks());
│ }
└──────────────────────────┘
    ↓
Send Queued Data to Server
    ↓
Success?
  ├─ YES → Clear queue, notify clients
  └─ NO → Retry later (browser handles)
    ↓
Clients Notified via postMessage
    ↓
App Updates UI with sync status
```

## 7. Push Notification Flow

```
Server Has Message
       ↓
Send Push to Browser
       ↓
Service Worker 'push' Event
       ↓
Parse Notification Data
       ↓
┌────────────────────────────────────┐
│ registration.showNotification()     │
│ • Title: "Task Complete"            │
│ • Body: "You finished..."           │
│ • Icon: icon-192.png                │
│ • Actions: [Open, Dismiss]          │
└────────────────────────────────────┘
       ↓
Browser Shows System Notification
       ↓
┌──────────────────────────┐
│ User Clicks Notification │
└──────────────────────────┘
       ↓
'notificationclick' Event
       ↓
Check action:
├─ 'open' → Open app window
├─ 'dismiss' → Close notification
└─ null → Default (open app)
       ↓
App Brings to Focus
       ↓
Navigate to relevant page
```

## 8. Data Flow Architecture

```
┌────────────────────┐
│   User Input       │
│   (Tasks, Goals)   │
└─────────┬──────────┘
          ↓
┌────────────────────────────────────┐
│  PWA Application                   │
│  • tasks.html                      │
│  • goals.html                      │
└─────────┬──────────────────────────┘
          ↓
    ┌─────────────┐
    │  Storage.js │ (Local Data Layer)
    └──┬────┬─────┘
       ↓    ↓
┌──────────────────────────────────┐
│  Browser Storage Options         │
│  • localStorage (User Data)      │
│  • IndexedDB (Large Data)        │
│  • SessionStorage (Temp)         │
└──┬────────────────────────────┬──┘
   ↓                            ↓
Persisted Locally        Ready for Sync
   ↓                            ↓
┌──────────────────────────────────┐
│  Service Worker Cache            │
│  (Backup for restore)            │
└──────────────────────────────────┘
   ↓
   ├─ Offline? ──→ Use Cached Data
   │
   └─ Online? ──→ Sync with Server
              ↓
        ┌──────────────┐
        │  API Server  │
        │  (Remote)    │
        └──────────────┘
              ↓
        Data Persisted
        on Server
```

## 9. Browser Support Decision Tree

```
User Visits App
       ↓
Check Browser
       ├─ Chrome 90+? ──────────→ Full PWA (Window Controls)
       ├─ Edge 90+? ────────────→ Full PWA (Windows Integration)
       ├─ Firefox 95+? ────────→ Full PWA (Desktop Entry)
       ├─ Safari 15+? ─────────→ Limited PWA (Minimal-UI)
       ├─ Android Chrome? ─────→ Full PWA (Standalone)
       ├─ iOS Safari? ─────────→ Limited PWA (Home Screen)
       ├─ Opera 76+? ──────────→ Full PWA (Chromium)
       └─ Other? ──────────────→ Web App (Browser Tab)
              ↓
         Apply Appropriate
         Display Mode & Features
         Per manifest.json
         display_override
```

## 10. Performance Timeline

```
Time ────────────────────────────────────────────→

0ms
│
├─ HTML Download Start
│
100ms
├─ HTML Download Complete
├─ CSS Start Download
├─ JS Start Download
│
200ms
├─ CSS Download Complete
├─ DOM Parsing
├─ Paint
│
300ms  ┌─ First Contentful Paint (FCP)
├─ JS Download Complete
│
500ms
├─ JS Execution Complete
├─ App Interactive
│  ┌─ Time to Interactive (TTI)
│
700ms
├─ Images Start Loading
│
1000ms
├─ Images Loaded
├─ Full Page Ready

Future Loads (With Cache):

0ms
│
├─ Service Worker Intercept
│
100ms ┌─ Cache Hit
│
200ms
├─ FCP (From Cache)
├─ TTI (From Cache)
│
300ms
├─ Full Page Ready
│
Offline Loads: Instant (All from Cache)
```

---

## File Size & Performance

```
Asset            Size    Cached  Repeat Load
─────────────────────────────────────────
index.html       ~20KB   ✓       <50ms
CSS              ~50KB   ✓       <50ms
JS (app.js)      ~30KB   ✓       <50ms
JS (pwa-mgr)     ~15KB   ✓       <50ms
Images (all)     ~200KB  ✓       <100ms
Manifest         ~2KB    ✓       <10ms
Service Worker   ~12KB   ✓       <20ms

Total Cache:     ~330KB
Init Load:       ~500-1000ms
Repeat Load:     ~200-300ms
Offline Load:    <100ms
```

---

**Diagram Version**: 1.0  
**Created**: April 12, 2026  
**Purpose**: Visual understanding of PWA architecture and data flows
