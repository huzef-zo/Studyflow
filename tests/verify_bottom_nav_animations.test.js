const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Bottom Nav Animation Requirements ---');

// 1. Verify CSS contains expected classes and rules
const cssContent = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');

assert(cssContent.includes('.bottom-nav-indicator'), 'CSS should define .bottom-nav-indicator');
assert(cssContent.includes('cubic-bezier(0.34, 1.56, 0.64, 1)'), 'CSS should contain specified cubic-bezier easing');
assert(cssContent.includes('will-change: transform;'), 'CSS should optimize indicator transform performance');
assert(cssContent.includes('.nav-ripple'), 'CSS should define .nav-ripple class');
assert(cssContent.includes('@keyframes navIconPop'), 'CSS should define navIconPop keyframe');
assert(cssContent.includes('.bottom-nav-indicator { transition: transform 0s !important; }'), 'CSS should override indicator transition for prefers-reduced-motion');

console.log('✅ CSS structure verified successfully');

// 2. Verify JS file includes setupBottomNavAnimations & indicator element
const jsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

assert(jsContent.includes('class="bottom-nav-indicator"'), 'renderBottomNav should render bottom-nav-indicator div');
assert(jsContent.includes('setupBottomNavAnimations'), 'App should contain setupBottomNavAnimations function');
assert(jsContent.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'JS should check prefers-reduced-motion media query');
assert(jsContent.includes('nav-ripple'), 'JS should spawn nav-ripple element on click');

console.log('✅ JS logic verified successfully');
