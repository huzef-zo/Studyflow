# Circular Progress Bars - Technical Guide

## Problem Solved
The percentage text was updating correctly, but the SVG purple ring wasn't filling up dynamically based on the percentage value. This guide explains the complete solution with the math behind it.

---

## The Math Behind Stroke-DashOffset

### Formula

For an SVG circle with `stroke-dasharray` and `stroke-dashoffset`:

```
Circumference = 2 × π × r
```

For a circle with radius **70px**:
```
C = 2 × π × 70 = 439.82 px
```

### Stroke-DashOffset Calculation

The `stroke-dashoffset` determines how much of the stroke is "hidden":

```javascript
offset = circumference × (1 - percentage / 100)
```

**Examples:**
- **0% complete:** offset = 439.82 × (1 - 0/100) = 439.82 → Empty ring
- **50% complete:** offset = 439.82 × (1 - 50/100) = 219.91 → Half-filled ring
- **100% complete:** offset = 439.82 × (1 - 100/100) = 0 → Full ring

---

## SVG Circle Setup

```html
<svg class="circular-progress" width="160" height="160" viewBox="0 0 160 160">
  <!-- Background circle (light, always visible) -->
  <circle cx="80" cy="80" r="70" class="progress-bg" />
  
  <!-- Progress ring (purple, fills up) -->
  <circle 
    id="missionCircle"
    cx="80" 
    cy="80" 
    r="70"
    class="progress-ring"
    data-max="10"
    data-circumference="439.82"
  />
</svg>
```

### Key SVG Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `cx`, `cy` | 80 | Center position (viewBox is 160×160) |
| `r` | 70 | Radius of the circle |
| `stroke-width` | 8 | Thickness of the ring |
| `transform` | `rotate(-90deg)` | Start angle at top (not left) |

---

## CSS Styling

```css
.progress-ring {
  fill: none;                          /* No fill, just stroke */
  stroke: var(--neon-purple);          /* Purple color */
  stroke-width: 8;                     /* Ring thickness */
  stroke-linecap: round;               /* Rounded ends */
  stroke-dasharray: 439.82;            /* Dashes equal to circumference */
  stroke-dashoffset: 439.82;           /* Initially hidden */
  transition: stroke-dashoffset 0.5s ease-in-out;  /* Smooth animation */
  filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.6));
}
```

---

## JavaScript Implementation

### Class: CircularProgress

```javascript
class CircularProgress {
  constructor(circleElement) {
    this.circle = circleElement;
    this.radius = parseFloat(circleElement.getAttribute('r'));
    this.circumference = 2 * Math.PI * this.radius;
    
    // Initialize
    this.circle.style.strokeDasharray = this.circumference;
    this.circle.style.strokeDashoffset = this.circumference;
  }

  updateProgress(current, max) {
    // Calculate percentage (0-100)
    const percentage = Math.min(100, Math.max(0, (current / max) * 100));
    
    // Calculate offset
    const offset = this.circumference * (1 - percentage / 100);
    
    // Apply animation
    this.circle.style.strokeDashoffset = offset;
    
    return percentage;
  }

  reset() {
    this.circle.style.strokeDashoffset = this.circumference;
  }
}
```

### Usage

```javascript
// Initialize
const missionProgress = new CircularProgress(document.getElementById('missionCircle'));

// Update progress
missionProgress.updateProgress(3, 10);  // 30% filled

// The CSS transition will smoothly animate the ring filling
```

---

## Complete Example: Mission Quota

### HTML
```html
<div class="goal-card">
  <div class="circular-progress-wrapper">
    <svg class="circular-progress" width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="70" class="progress-bg" />
      <circle 
        id="missionCircle"
        cx="80" cy="80" r="70"
        class="progress-ring"
      />
    </svg>
    <div class="progress-center">
      <div class="progress-percent" id="missionPercent">0%</div>
      <div class="progress-label">Mission Quota</div>
    </div>
  </div>
</div>
```

### JavaScript
```javascript
// State
let missionState = { current: 0, max: 10 };
let missionProgress = new CircularProgress(
  document.getElementById('missionCircle')
);

// Increment function
function incrementMission() {
  if (missionState.current < missionState.max) {
    missionState.current++;
    updateMissionUI();
  }
}

// Update UI
function updateMissionUI() {
  const percentage = missionProgress.updateProgress(
    missionState.current,
    missionState.max
  );
  
  document.getElementById('missionPercent').textContent = 
    Math.round(percentage) + '%';
  document.getElementById('missionCurrent').textContent = 
    missionState.current;
}
```

---

## Why This Works

1. **Initial State:** `stroke-dashoffset = circumference` hides the entire stroke
2. **As percentage increases:** offset decreases, revealing more of the stroke
3. **At 100%:** `stroke-dashoffset = 0` shows the complete ring
4. **CSS transition:** Makes the change smooth and animated

The key insight: **stroke-dashoffset creates the illusion of the ring "filling up"** by progressively revealing the stroke as the offset decreases.

---

## Customization Guide

### Change Ring Color
```css
.progress-ring {
  stroke: #your-color; /* Replace var(--neon-purple) */
}
```

### Change Ring Thickness
```css
.progress-ring {
  stroke-width: 12; /* Thicker ring */
}
```

### Change Circle Size
For a larger circle (e.g., radius = 100):
```javascript
const radius = 100;
const circumference = 2 * Math.PI * radius; // 628.32
```

Then update SVG:
```html
<circle cx="100" cy="100" r="100" />
```

### Faster/Slower Animation
```css
.progress-ring {
  transition: stroke-dashoffset 0.3s ease-in-out; /* Faster: 0.3s */
  /* or */
  transition: stroke-dashoffset 1s ease-in-out;   /* Slower: 1s */
}
```

---

## Browser Compatibility

| Feature | Support |
|---------|---------|
| SVG stroke-dasharray | ✅ All modern browsers |
| stroke-dashoffset | ✅ All modern browsers |
| CSS transitions | ✅ All modern browsers |
| drop-shadow filter | ✅ All modern browsers |

---

## Performance Notes

- **Smooth 60fps animations:** The CSS transition handles rendering
- **Minimal JavaScript:** Only updates DOM when percentage changes
- **No animation libraries needed:** Pure SVG + CSS solution
- **Mobile optimized:** Works perfectly on all devices

---

## Summary Table

| Element | Purpose | Value |
|---------|---------|-------|
| `<circle>` with `r="70"` | Ring container | circumference ≈ 439.82 |
| `stroke-dasharray` | Defines dash pattern | = circumference |
| `stroke-dashoffset` | Hides/shows stroke | = C × (1 - %/100) |
| `transition` | Smooth animation | `0.5s ease-in-out` |
| `rotate(-90deg)` | Start at top | Visually correct |

The mathematics ensures that the ring perfectly fills from 0% to 100%! 🎯
