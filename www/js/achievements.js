/**
 * StudyFlow - Achievement and Rank Engine
 * Handles XP awards, leveling, and badges
 */

const Achievements = (function() {
  'use strict';

  const RANKS = [
    { title: 'Novice', minXP: 0, color: '#6B7280' },
    { title: 'Apprentice', minXP: 500, color: '#3B82F6' },
    { title: 'Scholar', minXP: 2000, color: '#8B5CF6' },
    { title: 'Sage', minXP: 5000, color: '#F59E0B' },
    { title: 'Archmage', minXP: 10000, color: '#EF4444' },
    { title: 'Transcendent', minXP: 25000, color: '#06B6D4' }
  ];

  const BADGE_TYPES = {
    STREAK: 'streak',
    COMPLETION: 'completion',
    TIME: 'time',
    SUBJECT: 'subject',
    MASTERY: 'mastery',
    GPA: 'gpa'
  };

  /**
   * Calculate level based on XP formula: XP = 100 * n^1.5
   * Inverse: n = (XP / 100)^(1/1.5)
   */
  function calculateLevel(totalXP) {
    if (totalXP <= 0) return 1;
    return Math.floor(Math.pow(totalXP / 100, 1 / 1.5)) + 1;
  }

  function getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level - 1, 1.5));
  }

  function getRank(totalXP) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (totalXP >= RANKS[i].minXP) return RANKS[i];
    }
    return RANKS[0];
  }

  function awardXP(amount, source) {
    const xpState = Storage.loadData(Storage.KEYS.XP_STATE, Storage.DEFAULTS.xpState);
    const oldLevel = calculateLevel(xpState.totalXP);

    xpState.totalXP += amount;
    xpState.history.push({
      date: new Date().toISOString(),
      xpGained: amount,
      source
    });

    const newLevel = calculateLevel(xpState.totalXP);
    const rank = getRank(xpState.totalXP);
    xpState.currentLevel = newLevel;
    xpState.currentRank = rank.title;

    Storage.saveData(Storage.KEYS.XP_STATE, xpState);

    if (newLevel > oldLevel) {
      showLevelUpToast(newLevel, rank.title);
    } else {
      App.showToast(`+${amount} XP (${source})`, 'info');
    }

    // Trigger UI refresh
    if (typeof Storage !== 'undefined' && Storage.notifyTaskDataChanged) {
      Storage.notifyTaskDataChanged();
    }

    checkBadges();
    return xpState;
  }

  function showLevelUpToast(level, rank) {
    const content = `
      <div class="text-center">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎊</div>
        <h3 class="mb-xs">Level Up!</h3>
        <p class="text-secondary mb-md">You've reached Level ${level}</p>
        <div class="badge" style="background: var(--primary-glow); color: var(--primary); font-size: 1rem; padding: 8px 16px;">
          Rank: ${rank}
        </div>
      </div>
    `;

    const modal = App.createModal({
      title: 'New Achievement',
      content: content,
      footer: `<button class="btn btn-primary w-full" data-action="ok">Continue</button>`
    });

    modal.querySelector('[data-action="ok"]').onclick = () => App.closeModal();
    App.openModal(modal);
  }

  function checkBadges() {
    const stats = Storage.getStats();
    const achievements = Storage.loadData(Storage.KEYS.ACHIEVEMENTS, Storage.DEFAULTS.achievements);
    const xpState = Storage.loadData(Storage.KEYS.XP_STATE, Storage.DEFAULTS.xpState);

    const newBadges = [];

    // Streak Badges
    const streakMilestones = [
      { threshold: 7, icon: '🔥' },
      { threshold: 14, icon: '⚡' },
      { threshold: 30, icon: '💎' }
    ];

    streakMilestones.forEach(m => {
      if (stats.bestStreak >= m.threshold && !hasBadge(achievements, BADGE_TYPES.STREAK, m.threshold)) {
        newBadges.push(unlockBadge(achievements, BADGE_TYPES.STREAK, m.threshold, m.icon));
      }
    });

    // Completion Badges
    const completionMilestones = [
      { threshold: 10, icon: '🎯' },
      { threshold: 50, icon: '🏆' },
      { threshold: 100, icon: '👑' }
    ];

    completionMilestones.forEach(m => {
      if (stats.tasks.completed >= m.threshold && !hasBadge(achievements, BADGE_TYPES.COMPLETION, m.threshold)) {
        newBadges.push(unlockBadge(achievements, BADGE_TYPES.COMPLETION, m.threshold, m.icon));
      }
    });

    // GPA Badges
    if (typeof Storage.getCourses === 'function' && typeof GpaUtils !== 'undefined') {
      const courses = Storage.getCourses();
      const finalizedOrComplete = courses.filter(c => {
        if (c.finalized) return true;
        const st = GpaUtils.courseStatus(c);
        return st.isComplete;
      });

      // First course finalized badge
      if (finalizedOrComplete.length >= 1 && !hasBadge(achievements, BADGE_TYPES.GPA, 'first_course')) {
        newBadges.push(unlockBadge(achievements, BADGE_TYPES.GPA, 'first_course', '🎓', 'First course finalized'));
      }

      // CGPA milestones: 3.0, 3.5, 3.7, 4.0 (require total completed credits >= 15)
      const gpaResult = GpaUtils.cgpa(courses, { includeProjected: false });
      if (gpaResult.totalCredits >= 15) {
        const milestones = [
          { threshold: 3.0, icon: '🥉' },
          { threshold: 3.5, icon: '🥈' },
          { threshold: 3.7, icon: '🥇' },
          { threshold: 4.0, icon: '💎' }
        ];
        milestones.forEach(m => {
          if (gpaResult.gpa >= m.threshold && !hasBadge(achievements, BADGE_TYPES.GPA, m.threshold)) {
            newBadges.push(unlockBadge(achievements, BADGE_TYPES.GPA, m.threshold, m.icon, `CGPA ${m.threshold} reached`));
          }
        });
      }
    }

    if (newBadges.length > 0) {
      Storage.saveData(Storage.KEYS.ACHIEVEMENTS, achievements);
    }
  }

  function hasBadge(achievements, type, condition) {
    return achievements.some(a => a.type === type && a.condition === condition);
  }

  function unlockBadge(achievements, type, condition, icon, customLabel) {
    const badge = {
      id: 'badge_' + Storage.generateId(),
      type,
      condition,
      icon,
      unlockedAt: new Date().toISOString(),
      label: customLabel || null
    };
    achievements.push(badge);
    showBadgeToast(badge);
    return badge;
  }

  function showBadgeToast(badge) {
    let message;
    if (badge.type === BADGE_TYPES.GPA && badge.label) {
      message = `Achievement Unlocked: ${badge.icon} ${badge.label}!`;
    } else {
      message = `Achievement Unlocked: ${badge.icon} ${badge.condition} ${badge.type} milestone!`;
    }
    App.showToast(message, 'success');
    // Apply special achievement styling to the last toast
    setTimeout(() => {
      const toasts = document.querySelectorAll('.toast-success');
      const lastToast = toasts[toasts.length - 1];
      if (lastToast && lastToast.textContent.includes('Achievement Unlocked')) {
        lastToast.classList.add('toast-achievement');
      }
    }, 10);
  }

  /**
   * Award XP for GPA accomplishments.
   * Anti-farming: checks course.xpAwarded. Awards only the positive difference vs xpAwarded.
   * Never subtracts XP, never awards twice for the same grade.
   * Checks semester bonus (+250 XP if >= 3.0, +400 XP if >= 3.7) once per semester label.
   */
  function awardGpaXP(course, oldGradePoint) {
    if (!course || typeof GpaUtils === 'undefined') return 0;
    const status = GpaUtils.courseStatus(course);
    if (!status.isComplete && !course.finalized) return 0;

    const letterXpMap = {
      'A': 150,
      'A-': 130,
      'B+': 110,
      'B': 90,
      'B-': 75,
      'C+': 60,
      'C': 45,
      'C-': 30,
      'D+': 20,
      'D': 10,
      'D-': 5,
      'F': 0
    };

    const targetXp = letterXpMap[status.grade.letter] !== undefined ? letterXpMap[status.grade.letter] : 0;
    const previousXp = Number.isFinite(Number(course.xpAwarded)) ? Number(course.xpAwarded) : 0;
    const deltaXp = targetXp - previousXp;

    let totalAwarded = 0;
    if (deltaXp > 0) {
      course.xpAwarded = targetXp;
      Storage.updateCourse(course.id, { xpAwarded: targetXp });
      awardXP(deltaXp, `Course Grade: ${course.name} (${status.grade.letter})`);
      totalAwarded += deltaXp;
    }

    // Semester Bonus Check
    if (course.semester && typeof course.semester === 'string' && course.semester.trim()) {
      const semLabel = course.semester.trim();
      const allCourses = Storage.getCourses ? Storage.getCourses() : [];
      const semCourses = allCourses.filter(c => (c.semester || '').trim() === semLabel);

      const allComplete = semCourses.length > 0 && semCourses.every(c => {
        const st = GpaUtils.courseStatus(c);
        return c.finalized || st.isComplete;
      });

      if (allComplete) {
        const semResult = GpaUtils.semesterGpa(semCourses, { includeProjected: false });
        const xpState = Storage.loadData(Storage.KEYS.XP_STATE, Storage.DEFAULTS.xpState);
        const history = Array.isArray(xpState.history) ? xpState.history : [];

        // Check if bonus was already awarded for this semester
        const source30 = `Semester Completion Bonus (>=3.0): ${semLabel}`;
        const source37 = `Semester Completion Bonus (>=3.7): ${semLabel}`;
        const has30 = history.some(h => h.source === source30);
        const has37 = history.some(h => h.source === source37);

        if (semResult.gpa >= 3.7 && !has37) {
          awardXP(400, source37);
          totalAwarded += 400;
        } else if (semResult.gpa >= 3.0 && !has30 && !has37) {
          awardXP(250, source30);
          totalAwarded += 250;
        }
      }
    }

    checkBadges();
    return totalAwarded;
  }

  return {
    init: checkBadges,
    awardXP,
    awardGpaXP,
    checkBadges,
    calculateLevel,
    getXPForLevel,
    getRank,
    RANKS,
    BADGE_TYPES
  };
})();

window.Achievements = Achievements;
