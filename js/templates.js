/**
 * StudyFlow - Templates Module
 * Built-in template gallery and custom template persistence.
 */

const Templates = (function() {
  'use strict';

  const STORAGE_KEY = 'studyflow_templates';

  const BUILTIN_TEMPLATES = [
    {
      id: 'tmpl_meeting',
      title: 'Meeting Notes',
      icon: '📝',
      blocks: [
        { type: 'heading1', content: 'Meeting Notes' },
        { type: 'callout', content: 'Date: ' + new Date().toLocaleDateString(), properties: { icon: '📅' } },
        { type: 'heading2', content: 'Attendees' },
        { type: 'bulleted_list', content: 'Person 1' },
        { type: 'bulleted_list', content: 'Person 2' },
        { type: 'heading2', content: 'Action Items' },
        { type: 'todo', content: 'Follow up on discussion' }
      ]
    },
    {
      id: 'tmpl_weekly_review',
      title: 'Weekly Review',
      icon: '🎯',
      blocks: [
        { type: 'heading1', content: 'Weekly Review' },
        { type: 'heading2', content: 'Wins' },
        { type: 'bulleted_list', content: 'Completed project milestone' },
        { type: 'heading2', content: 'Challenges' },
        { type: 'bulleted_list', content: 'Time management on research' },
        { type: 'heading2', content: 'Next Week Goals' },
        { type: 'todo', content: 'Prepare for midterm exam' }
      ]
    },
    {
      id: 'tmpl_reading_list',
      title: 'Reading List',
      icon: '📚',
      blocks: [
        { type: 'heading1', content: 'Reading Vault' },
        { type: 'todo', content: 'Read Chapter 1 - Organic Chemistry' },
        { type: 'todo', content: 'Read Chapter 2 - Linear Algebra' }
      ]
    }
  ];

  function getCustomTemplates() {
    return Storage.loadData(STORAGE_KEY, []);
  }

  function saveCustomTemplate(title, blocks, icon = '📄') {
    const templates = getCustomTemplates();
    const newTmpl = {
      id: 'tmpl_' + Storage.generateId(),
      title: String(title || 'Custom Template').substring(0, 200),
      icon: icon,
      blocks: Array.isArray(blocks) ? blocks.map(b => Blocks.sanitizeBlock(b)) : []
    };
    templates.push(newTmpl);
    Storage.saveData(STORAGE_KEY, templates);
    return newTmpl;
  }

  function getAllTemplates() {
    return [...BUILTIN_TEMPLATES, ...getCustomTemplates()];
  }

  function openGallery(onSelectTemplate) {
    const templates = getAllTemplates();

    const modal = App.createModal({
      title: 'Template Gallery',
      content: `
        <div class="flex flex-col gap-sm">
          <p class="text-secondary" style="font-size:12px;">Choose a pre-built layout to start your page:</p>
          <div class="grid grid-2 gap-sm" style="max-height:300px; overflow-y:auto;">
            ${templates.map((t, idx) => `
              <div class="tmpl-card card p-sm flex items-center gap-sm" data-idx="${idx}" style="cursor:pointer; background:var(--bg-tertiary);">
                <span style="font-size:1.5rem;">${App.escapeHtml(t.icon)}</span>
                <div>
                  <div style="font-weight:600;">${App.escapeHtml(t.title)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${t.blocks.length} blocks</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `
    });

    App.openModal(modal);

    modal.querySelectorAll('.tmpl-card').forEach(cardEl => {
      cardEl.onclick = () => {
        const idx = cardEl.dataset.idx;
        const selected = templates[idx];
        App.closeModal(modal);
        if (onSelectTemplate) onSelectTemplate(selected);
      };
    });
  }

  return {
    getAllTemplates,
    saveCustomTemplate,
    openGallery
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Templates;
} else {
  window.Templates = Templates;
}
