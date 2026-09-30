const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Bottom Nav Animation Requirements ---');

// 1. Verify CSS contains expected classes and rules
const cssContent = fs.readFileSync(path.join(__dirname, '../css/app.css'), 'utf8');

assert(cssContent.includes('prefers-reduced-motion'), 'CSS should support prefers-reduced-motion');

console.log('✅ CSS structure & fixes verified successfully');

// 2. Verify JS file includes renderBottomNav and active page tracking
const jsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

assert(jsContent.includes('renderBottomNav'), 'App should contain renderBottomNav function');
assert(jsContent.includes('aria-current="page"'), 'JS should set aria-current="page" on active nav item');

console.log('✅ JS logic & fixes verified successfully');
