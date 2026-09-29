const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Bottom Nav Animation Requirements ---');

// 1. Verify CSS contains expected classes and rules
const cssContent = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');

assert(cssContent.includes('.bottom-nav-indicator'), 'CSS should define .bottom-nav-indicator');
assert(cssContent.includes('.bottom-nav-item'), 'CSS should define .bottom-nav-item');
assert(cssContent.includes('.bottom-nav-indicator { transition: transform 0s !important; }'), 'CSS should override indicator transition for prefers-reduced-motion');

console.log('✅ CSS structure & fixes verified successfully');

// 2. Verify JS file includes setupBottomNavAnimations & indicator element
const jsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

assert(jsContent.includes('class="bottom-nav-indicator"'), 'renderBottomNav should render bottom-nav-indicator div');
assert(jsContent.includes('setupBottomNavAnimations'), 'App should contain setupBottomNavAnimations function');
assert(jsContent.includes('updateIndicatorLayout'), 'JS should calculate full layout bounds during setup/resize');
assert(jsContent.includes('updateIndicatorPosition'), 'JS should update indicator transform on tap');
assert(jsContent.includes('studyflow_prev_nav_left'), 'JS should persist previous nav tab offset in sessionStorage');
assert(jsContent.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'JS should check prefers-reduced-motion media query');

console.log('✅ JS logic & fixes verified successfully');
