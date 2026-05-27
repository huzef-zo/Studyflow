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
    MASTERY: 'mastery'
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

    if (newBadges.length > 0) {
      Storage.saveData(Storage.KEYS.ACHIEVEMENTS, achievements);
    }
  }

  function hasBadge(achievements, type, condition) {
    return achievements.some(a => a.type === type && a.condition === condition);
  }

  function unlockBadge(achievements, type, condition, icon) {
    const badge = {
      id: 'badge_' + Storage.generateId(),
      type,
      condition,
      icon,
      unlockedAt: new Date().toISOString()
    };
    achievements.push(badge);
    showBadgeToast(badge);
    return badge;
  }

  function showBadgeToast(badge) {
    const message = `Achievement Unlocked: ${badge.icon} ${badge.condition} ${badge.type} milestone!`;
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

  return {
    init: checkBadges,
    awardXP,
    calculateLevel,
    getXPForLevel,
    getRank,
    RANKS
  };
})();

window.Achievements = Achievements;
