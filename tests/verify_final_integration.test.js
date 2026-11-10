const fs = require('fs');
const path = require('path');

console.log('--- Verifying Final Integration ---');

const filesToVerify = [
  'index.html', 'tasks.html', 'calendar.html', 'timer.html',
  'notes.html', 'goals.html', 'history.html', 'settings.html', 'gpa.html',
  'js/storage.js', 'js/app.js', 'js/gpa.js', 'js/gpa-utils.js',
  'js/notes.js', 'js/achievements.js', 'js/scheduler.js', 'sw.js', 'version.js'
];

let allExist = true;
filesToVerify.forEach(file => {
  if (fs.existsSync(file)) {
    // console.log('✅ ' + file);
  } else {
    console.log('❌ MISSING: ' + file);
    allExist = false;
  }
});

if (!allExist) process.exit(1);

// Verify Service Worker cache list
const swContent = fs.readFileSync('sw.js', 'utf8');
const assets = ['notes.html', 'gpa.html', 'js/achievements.js', 'js/scheduler.js', 'js/notes.js', 'js/gpa.js', 'js/gpa-utils.js'];
assets.forEach(asset => {
  if (!swContent.includes(asset)) {
    console.log('❌ SW missing asset: ' + asset);
    allExist = false;
  }
});

// Verify Navigation
const appContent = fs.readFileSync('js/app.js', 'utf8');
const navItems = ['notes', 'gpa'];
navItems.forEach(item => {
  if (!appContent.includes("id: '" + item + "'")) {
    console.log('❌ Navigation missing item: ' + item);
    allExist = false;
  }
});

// Verify Storage KEYS
const storageContent = fs.readFileSync('js/storage.js', 'utf8');
const keys = ['NOTES', 'ACHIEVEMENTS', 'XP_STATE', 'REFLECTIONS', 'COURSES'];
keys.forEach(key => {
  if (!storageContent.includes(key + ':')) {
    console.log('❌ Storage KEYS missing: ' + key);
    allExist = false;
  }
});

if (allExist) {
  console.log('✅ All core integrations verified successfully.');
} else {
  process.exit(1);
}
