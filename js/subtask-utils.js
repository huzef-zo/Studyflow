/**
 * StudyFlow - Subtask Utilities
 * Provides helper functions for subtask progress tracking and state management
 */

const SubtaskUtils = (function() {
  'use strict';

  /**
   * Calculate progress statistics for a task with subtasks
   * @param {Object} task - The task object with subtasks array
   * @returns {Object} Progress metrics including completed count, total count, percentage, and status
   */
  function calculateProgress(task) {
    if (!task.subtasks || task.subtasks.length === 0) {
      return {
        completed: 0,
        total: 0,
        percentage: 0,
        status: 'no-subtasks',
        isFullyComplete: false,
        isPartialComplete: false
      };
    }

    const completed = task.subtasks.filter(s => s.isCompleted).length;
    const total = task.subtasks.length;
    const percentage = Math.round((completed / total) * 100);
    const isFullyComplete = completed === total;
    const isPartialComplete = completed > 0 && !isFullyComplete;

    return {
      completed,
      total,
      percentage,
      status: isFullyComplete ? 'complete' : isPartialComplete ? 'partial' : 'pending',
      isFullyComplete,
      isPartialComplete,
      remaining: total - completed
    };
  }

  /**
   * Format progress text for display
   * @param {number} completed - Number of completed subtasks
   * @param {number} total - Total number of subtasks
   * @returns {string} Formatted progress text
   */
  function formatProgressText(completed, total) {
    return `${completed}/${total}`;
  }

  /**
   * Get visual class based on progress percentage
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {string} CSS class for styling
   */
  function getProgressClass(percentage) {
    if (percentage === 0) return 'progress-empty';
    if (percentage < 33) return 'progress-low';
    if (percentage < 67) return 'progress-medium';
    if (percentage < 100) return 'progress-high';
    return 'progress-full';
  }

  /**
   * Get milestone message for completion milestones
   * @param {number} percentage - Progress percentage
   * @returns {string|null} Milestone message or null
   */
  function getMilestoneMessage(percentage) {
    if (percentage === 25) return '25% of sub-missions complete!';
    if (percentage === 50) return '50% progress! You\'re halfway there!';
    if (percentage === 75) return '75% done! Finish strong!';
    if (percentage === 100) return 'All sub-missions complete! Objective achieved!';
    return null;
  }

  /**
   * Determine if auto-complete should trigger
   * @param {Object} task - The task object
   * @returns {boolean} Whether parent task should auto-complete
   */
  function shouldAutoCompleteParent(task) {
    if (!task.subtasks || task.subtasks.length === 0) return false;
    return task.subtasks.every(s => s.isCompleted);
  }

  /**
   * Get animation class for completion feedback
   * @returns {string} Animation class name
   */
  function getCompletionAnimationClass() {
    return 'subtask-complete-pulse';
  }

  /**
   * Build progress indicator HTML
   * @param {Object} task - Task with subtasks
   * @returns {string} HTML for progress indicator
   */
  function buildProgressIndicator(task) {
    const progress = calculateProgress(task);
    if (progress.total === 0) return '';
    
    const progressClass = getProgressClass(progress.percentage);
    return `
      <div class="progress-badge ${progressClass}" title="Progress: ${progress.completed}/${progress.total}">
        <span class="progress-text">${progress.completed}/${progress.total}</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress.percentage}%"></div>
        </div>
      </div>
    `;
  }

  return {
    calculateProgress,
    formatProgressText,
    getProgressClass,
    getMilestoneMessage,
    shouldAutoCompleteParent,
    getCompletionAnimationClass,
    buildProgressIndicator
  };
})();
