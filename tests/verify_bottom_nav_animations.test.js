const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Bottom Nav Animation Requirements ---');

// 1. Verify CSS contains expected classes and rules
const cssContent = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');

assert(cssContent.includes('.bottom-nav-indicator'), 'CSS should define .bottom-nav-indicator');
assert(cssContent.includes('cubic-bezier(0.16, 1, 0.3, 1)'), 'CSS should contain specified cubic-bezier easing');
assert(cssContent.includes('will-change: transform;'), 'CSS should optimize indicator transform performance');
assert(cssContent.includes('.nav-ripple'), 'CSS should define .nav-ripple class');
assert(cssContent.includes('background: var(--accent-fill);'), 'CSS ripple should use accent-fill blue color');
assert(cssContent.includes('opacity: 0.2;'), 'CSS ripple initial opacity should cap at 0.2');
assert(cssContent.includes('overflow: hidden;'), 'CSS nav item should have overflow: hidden to clip ripple');
assert(cssContent.includes('transition: color 0.22s cubic-bezier(0.16, 1, 0.3, 1)'), 'CSS nav item should sync color transition duration with indicator slide');
assert(cssContent.includes('@keyframes navIconPop'), 'CSS should define navIconPop keyframe');
assert(cssContent.includes('.animate-fade-in'), 'CSS should define animate-fade-in keyframe');
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
assert(jsContent.includes('nav-ripple'), 'JS should spawn nav-ripple element on click');
assert(!jsContent.includes('void item.offsetWidth'), 'JS should not force layout reflow on pop animation');

console.log('✅ JS logic & fixes verified successfully');
