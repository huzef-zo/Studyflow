/**
 * QUICK REFERENCE: Circular Progress SVG
 * Copy-paste solutions for common use cases
 */

// ============================================
// SNIPPET 1: Basic Circular Progress HTML
// ============================================

const basicProgressHTML = `
<div class="circular-progress-wrapper">
  <svg class="circular-progress" width="160" height="160" viewBox="0 0 160 160">
    <!-- Background circle -->
    <circle cx="80" cy="80" r="70" class="progress-bg" />
    <!-- Progress ring -->
    <circle 
      id="progressRing"
      cx="80" cy="80" r="70"
      class="progress-ring"
    />
  </svg>
  <div class="progress-center">
    <div class="progress-percent" id="progressPercent">0%</div>
    <div class="progress-label">Loading</div>
  </div>
</div>
`;

// ============================================
// SNIPPET 2: CSS for SVG Ring
// ============================================

const progressCSS = `
.circular-progress {
  width: 160px;
  height: 160px;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.progress-ring {
  fill: none;
  stroke: #a855f7;  /* Purple */
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 439.82;    /* IMPORTANT: 2π × radius */
  stroke-dashoffset: 439.82;   /* Start hidden */
  transition: stroke-dashoffset 0.5s ease-in-out;
}

.progress-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
}

.progress-percent {
  font-size: 2rem;
  font-weight: 800;
  color: white;
}

.progress-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}
`;

// ============================================
// SNIPPET 3: JavaScript Class
// ============================================

class CircularProgress {
  constructor(circleSelector, radius = 70) {
    this.circle = document.querySelector(circleSelector);
    this.radius = radius;
    this.circumference = 2 * Math.PI * radius;
    
    // Initialize
    this.circle.style.strokeDasharray = this.circumference;
    this.circle.style.strokeDashoffset = this.circumference;
  }

  /**
   * Update progress from 0-100%
   * @param {number} percentage - 0 to 100
   */
  setPercentage(percentage) {
    const clipped = Math.min(100, Math.max(0, percentage));
    const offset = this.circumference * (1 - clipped / 100);
    this.circle.style.strokeDashoffset = offset;
    return clipped;
  }

  /**
   * Update progress with current/max values
   * @param {number} current - Current value
   * @param {number} max - Maximum value
   */
  updateProgress(current, max) {
    const percentage = (current / max) * 100;
    return this.setPercentage(percentage);
  }

  /**
   * Reset to 0%
   */
  reset() {
    this.setPercentage(0);
  }

  /**
   * Get current percentage
   */
  getPercentage() {
    const offset = parseFloat(this.circle.style.strokeDashoffset);
    return 100 - (offset / this.circumference) * 100;
  }
}

// ============================================
// SNIPPET 4: Usage Example
// ============================================

// Initialize
const progress = new CircularProgress('#progressRing', 70);

// Method 1: Set by percentage
progress.setPercentage(50);  // 50% filled

// Method 2: Set by current/max
progress.updateProgress(5, 10);  // 50% (5 out of 10)

// Method 3: Get current value
const currentPercent = progress.getPercentage();
console.log(`Progress: ${currentPercent}%`);

// ============================================
// SNIPPET 5: Interactive Button Handler
// ============================================

function createProgressController(ringSelector) {
  const progress = new CircularProgress(ringSelector);
  let current = 0;
  const max = 10;

  return {
    increment: () => {
      if (current < max) {
        current++;
        const percent = progress.updateProgress(current, max);
        document.getElementById('progressPercent').textContent = 
          Math.round(percent) + '%';
      }
    },
    reset: () => {
      current = 0;
      progress.reset();
      document.getElementById('progressPercent').textContent = '0%';
    },
    set: (value) => {
      current = Math.min(value, max);
      const percent = progress.updateProgress(current, max);
      document.getElementById('progressPercent').textContent = 
        Math.round(percent) + '%';
    }
  };
}

// Usage
const controller = createProgressController('#progressRing');
// controller.increment();
// controller.set(5);
// controller.reset();

// ============================================
// SNIPPET 6: Circumference Calculator
// ============================================

function calculateCircumference(radius) {
  return 2 * Math.PI * radius;
}

// Common sizes:
const sizes = {
  small: calculateCircumference(50),    // 314.16
  medium: calculateCircumference(70),   // 439.82
  large: calculateCircumference(100),   // 628.32
  xlarge: calculateCircumference(150)   // 942.48
};

console.log('Use these values for stroke-dasharray:');
console.log(sizes);

// ============================================
// SNIPPET 7: Color Variants
// ============================================

const colorVariants = {
  blue: '#3B82F6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  green: '#10B981',
  red: '#EF4444',
  orange: '#F59E0B'
};

function createProgressWithColor(ringSelector, color) {
  const progress = new CircularProgress(ringSelector);
  const circle = document.querySelector(ringSelector);
  circle.style.stroke = color;
  return progress;
}

// Usage
const blueProgress = createProgressWithColor('#progressRing', colorVariants.blue);

// ============================================
// SNIPPET 8: Animation Presets
// ============================================

const animationPresets = {
  fast: '0.3s ease-in-out',
  normal: '0.5s ease-in-out',
  slow: '1s ease-in-out',
  verySlow: '1.5s ease-in-out'
};

function setAnimationSpeed(ringSelector, speed = 'normal') {
  const circle = document.querySelector(ringSelector);
  circle.style.transition = 
    `stroke-dashoffset ${animationPresets[speed]}`;
}

// Usage
setAnimationSpeed('#progressRing', 'fast');

// ============================================
// SNIPPET 9: Multiple Rings (Dashboard)
// ============================================

class ProgressDashboard {
  constructor(config) {
    this.rings = {};
    
    config.forEach(({ id, radius, label, max, color }) => {
      this.rings[id] = {
        progress: new CircularProgress(id, radius),
        current: 0,
        max: max,
        label: label,
        color: color
      };
      
      // Set color
      const circle = document.querySelector(id);
      circle.style.stroke = color;
    });
  }

  update(id, current) {
    if (this.rings[id]) {
      this.rings[id].current = current;
      const percent = this.rings[id].progress.updateProgress(
        current,
        this.rings[id].max
      );
      return percent;
    }
  }

  reset(id) {
    if (this.rings[id]) {
      this.rings[id].current = 0;
      this.rings[id].progress.reset();
    }
  }
}

// Usage
const dashboard = new ProgressDashboard([
  { id: '#mission', radius: 70, label: 'Missions', max: 10, color: '#a855f7' },
  { id: '#focus', radius: 70, label: 'Focus', max: 20, color: '#3B82F6' },
  { id: '#streak', radius: 70, label: 'Streak', max: 30, color: '#10B981' }
]);

// dashboard.update('mission', 5);
// dashboard.update('focus', 10);

// ============================================
// SNIPPET 10: Data Persistence
// ============================================

class PersistentProgress extends CircularProgress {
  constructor(circleSelector, storageKey, radius = 70) {
    super(circleSelector, radius);
    this.storageKey = storageKey;
    this.current = parseInt(localStorage.getItem(storageKey) || '0');
  }

  updateProgress(current, max) {
    this.current = current;
    localStorage.setItem(this.storageKey, current);
    return super.updateProgress(current, max);
  }

  loadFromStorage() {
    return parseInt(localStorage.getItem(this.storageKey) || '0');
  }

  clearStorage() {
    localStorage.removeItem(this.storageKey);
  }
}

// Usage
const persistent = new PersistentProgress('#progressRing', 'my_progress');
persistent.updateProgress(5, 10);  // Saves to localStorage
const saved = persistent.loadFromStorage();  // Loads from localStorage
