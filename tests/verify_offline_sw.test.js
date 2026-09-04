const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Service Worker & Offline Configuration ---');

// 1. Read version.js and extract version
const versionFile = fs.readFileSync(path.join(__dirname, '../version.js'), 'utf8');
const versionMatch = versionFile.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
assert(versionMatch, 'APP_VERSION must be defined in version.js');
const APP_VERSION = versionMatch[1];
console.log(`Verified APP_VERSION: ${APP_VERSION}`);

// 2. Read sw.js and check cached assets
const swFile = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
assert(swFile.includes(`studyflow-\${APP_VERSION}`), 'sw.js must use APP_VERSION for CACHE_NAME');
assert(swFile.includes('matchCacheWithFallback'), 'sw.js must implement matchCacheWithFallback');
assert(swFile.includes('ignoreSearch: true'), 'sw.js must use ignoreSearch: true fallback for offline query strings');

// 3. Verify all HTML files reference CSS and JS with the exact APP_VERSION
const htmlFiles = [
  'index.html',
  'calendar.html',
  'goals.html',
  'history.html',
  'notes.html',
  'settings.html',
  'tasks.html',
  'timer.html'
];

htmlFiles.forEach((htmlFile) => {
  const content = fs.readFileSync(path.join(__dirname, '..', htmlFile), 'utf8');
  const vMatches = content.match(/\?v=([a-zA-Z0-9_\-]+)/g);
  assert(vMatches && vMatches.length > 0, `${htmlFile} must have versioned asset tags`);
  vMatches.forEach((v) => {
    assert.strictEqual(v, `?v=${APP_VERSION}`, `${htmlFile} asset tag ${v} does not match ${APP_VERSION}`);
  });
});
console.log('Verified version matching across all HTML files.');

// 4. Check cached asset existence
const assetPaths = [
  'index.html',
  'calendar.html',
  'goals.html',
  'history.html',
  'settings.html',
  'tasks.html',
  'timer.html',
  'notes.html',
  'version.js',
  'browserconfig.xml',
  'css/style.css',
  'js/app.js',
  'js/storage.js',
  'js/pwa-manager.js',
  'js/subtask-utils.js',
  'js/pwa-config.js',
  'js/calendar.js',
  'js/goals.js',
  'js/history.js',
  'js/tasks.js',
  'js/timer.js',
  'js/achievements.js',
  'js/scheduler.js',
  'js/notes.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

assetPaths.forEach((assetPath) => {
  const fullPath = path.join(__dirname, '..', assetPath);
  assert(fs.existsSync(fullPath), `Pre-cached asset missing on disk: ${assetPath}`);
});
console.log('Verified all pre-cached assets exist on disk.');

console.log('All Service Worker & Offline verification tests passed successfully!');
