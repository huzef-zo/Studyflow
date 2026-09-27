/**
 * StudyFlow - Command Palette Module
 * Global search command palette over page titles, block contents, and quick app actions.
 */

const CommandPalette = (function() {
  'use strict';

  function open() {
    const pages = typeof Storage !== 'undefined' ? Storage.loadData(Storage.KEYS.NOTES, []) : [];

    const modal = App.createModal({
      title: 'Command Palette',
      content: `
        <div class="flex flex-col gap-sm">
          <input type="text" id="cmd-search-input" class="form-input" placeholder="Type a command or search pages & blocks..." style="font-size: 15px; padding: 10px;" />
          <div id="cmd-results" class="flex flex-col gap-xs mt-xs" style="max-height: 300px; overflow-y: auto;">
            <!-- Populated dynamically -->
          </div>
        </div>
      `
    });

    App.openModal(modal);

    const inputEl = modal.querySelector('#cmd-search-input');
    const resultsEl = modal.querySelector('#cmd-results');

    inputEl.focus();

    const quickActions = [
      { type: 'action', title: '🚀 Jump to Tasks', href: 'tasks.html' },
      { type: 'action', title: '⏱️ Jump to Timer', href: 'timer.html' },
      { type: 'action', title: '📅 Jump to Calendar', href: 'calendar.html' },
      { type: 'action', title: '🎯 Jump to Goals', href: 'goals.html' },
      { type: 'action', title: '➕ Create New Page', action: 'new_page' }
    ];

    function renderResults(query = '') {
      const q = query.toLowerCase().trim();
      let matches = [];

      if (!q) {
        matches = [...quickActions];
      } else {
        // Quick Action Matches
        const matchedActions = quickActions.filter(a => a.title.toLowerCase().includes(q));
        matches.push(...matchedActions);

        // Page Title & Block Content Matches
        pages.forEach(p => {
          const titleMatch = (p.title || '').toLowerCase().includes(q);
          const blockMatch = p.blocks && p.blocks.some(b => (b.content || '').toLowerCase().includes(q));

          if (titleMatch || blockMatch) {
            matches.push({
              type: 'page',
              title: `${p.icon || '📄'} ${p.title || 'Untitled'}`,
              pageId: p.id,
              snippet: titleMatch ? 'Title match' : 'Content match'
            });
          }
        });
      }

      if (matches.length === 0) {
        resultsEl.innerHTML = '<p class="text-secondary text-center py-md" style="font-size:12px;">No matching results found.</p>';
        return;
      }

      resultsEl.innerHTML = matches.map((m, idx) => `
        <div class="cmd-item card flex items-center justify-between p-xs" data-idx="${idx}" style="cursor: pointer; background: var(--bg-tertiary);">
          <span style="font-weight: 500;">${App.escapeHtml(m.title)}</span>
          ${m.snippet ? `<span class="badge">${App.escapeHtml(m.snippet)}</span>` : ''}
        </div>
      `).join('');

      resultsEl.querySelectorAll('.cmd-item').forEach((itemEl, idx) => {
        itemEl.onclick = () => {
          const match = matches[idx];
          App.closeModal(modal);

          if (match.type === 'action') {
            if (match.href) window.location.href = match.href;
            if (match.action === 'new_page') window.location.href = 'notes.html?action=new';
          } else if (match.type === 'page') {
            window.location.href = `notes.html?pageId=${match.pageId}`;
          }
        };
      });
    }

    renderResults('');

    inputEl.addEventListener('input', (e) => {
      renderResults(e.target.value);
    });
  }

  return { open };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommandPalette;
} else {
  window.CommandPalette = CommandPalette;
}
