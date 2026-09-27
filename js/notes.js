/**
 * StudyFlow - Knowledge Vault (Notes Module)
 * Supports Notion-style Block Editor engine, slash menus, auto-markdown, page tree, cross-linking, linked mentions, and templates.
 */

const Notes = (function() {
  'use strict';

  let elements = {};
  let currentNoteId = null;
  let currentNoteBlocks = [];
  let slashMenuEl = null;
  let inlineToolbarEl = null;
  let crossLinkPopupEl = null;
  let draggedBlockId = null;

  const COVERS = [
    'linear-gradient(135deg, #3B82F6, #1E40AF)',
    'linear-gradient(135deg, #10B981, #065F46)',
    'linear-gradient(135deg, #F59E0B, #92400E)',
    'linear-gradient(135deg, #EF4444, #991B1B)',
    'linear-gradient(135deg, #8B5CF6, #5B21B6)',
    'linear-gradient(135deg, #EC4899, #9D174D)'
  ];

  const EMOJIS = ['📄', '📚', '💡', '📝', '🎯', '⚡', '🔬', '💻', '🎨', '🧠', '📅', '📌'];

  function initElements() {
    elements = {
      notesList: document.getElementById('notes-list'),
      searchNotes: document.getElementById('search-notes'),
      newNoteBtn: document.getElementById('new-note-btn'),
      templateGalleryBtn: document.getElementById('template-gallery-btn'),
      saveAsTemplateBtn: document.getElementById('save-as-template-btn'),
      noteEditor: document.getElementById('note-editor'),
      emptyEditorState: document.getElementById('empty-editor-state'),
      noteTitle: document.getElementById('note-title'),
      noteSubject: document.getElementById('note-subject'),
      noteBlocksContainer: document.getElementById('note-blocks-container'),
      linkedMentionsContainer: document.getElementById('linked-mentions-container'),
      saveNoteBtn: document.getElementById('save-note-btn'),
      deleteNoteBtn: document.getElementById('delete-note-btn'),
      addSubpageBtn: document.getElementById('add-subpage-btn'),
      pageCoverStrip: document.getElementById('page-cover-strip'),
      changeCoverBtn: document.getElementById('change-cover-btn'),
      pageIconBtn: document.getElementById('page-icon-btn')
    };
  }

  function init() {
    initElements();
    migrateFlatNotes();
    setupEventListeners();
    populateSubjects();
    renderNotes();
  }

  function migrateFlatNotes() {
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    let modified = false;

    const migrated = notes.map(note => {
      let updated = { ...note };
      if (!updated.blocks || !Array.isArray(updated.blocks)) {
        modified = true;
        const textContent = updated.content || '';
        const lines = textContent.split('\n').filter(Boolean);
        updated.blocks = lines.length > 0
          ? lines.map(line => Blocks.createBlock('paragraph', line))
          : [Blocks.createBlock('paragraph', '')];
      }
      if (updated.parentId === undefined) { updated.parentId = null; modified = true; }
      if (!updated.icon) { updated.icon = '📄'; modified = true; }
      if (!updated.coverColor) { updated.coverColor = COVERS[0]; modified = true; }
      if (updated.isExpanded === undefined) { updated.isExpanded = true; modified = true; }
      return updated;
    });

    if (modified) {
      Storage.saveData(Storage.KEYS.NOTES, migrated);
    }
  }

  function setupEventListeners() {
    elements.newNoteBtn?.addEventListener('click', () => createNewNote());
    elements.saveNoteBtn?.addEventListener('click', saveCurrentNote);
    elements.deleteNoteBtn?.addEventListener('click', deleteCurrentNote);
    elements.addSubpageBtn?.addEventListener('click', () => createNewNote(currentNoteId));
    elements.searchNotes?.addEventListener('input', App.debounce(() => renderNotes(), 300));

    elements.templateGalleryBtn?.addEventListener('click', () => {
      if (typeof Templates !== 'undefined') {
        Templates.openGallery((tmpl) => {
          createNewNoteFromTemplate(tmpl);
        });
      }
    });

    elements.saveAsTemplateBtn?.addEventListener('click', () => {
      if (!currentNoteId) return;
      const title = elements.noteTitle.value.trim() || 'Custom Template';
      if (typeof Templates !== 'undefined') {
        Templates.saveCustomTemplate(title, currentNoteBlocks, elements.pageIconBtn.innerText);
        App.showToast('Page layout saved as custom template!', 'success');
      }
    });

    elements.changeCoverBtn?.addEventListener('click', cycleCoverColor);
    elements.pageIconBtn?.addEventListener('click', openEmojiPicker);

    elements.notesList?.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tree-toggle-arrow');
      if (toggle) {
        e.stopPropagation();
        const item = toggle.closest('.note-tree-item');
        if (item && item.dataset.id) {
          togglePageExpand(item.dataset.id);
        }
        return;
      }

      const addBtn = e.target.closest('.tree-add-subpage-btn');
      if (addBtn) {
        e.stopPropagation();
        const item = addBtn.closest('.note-tree-item');
        if (item && item.dataset.id) {
          createNewNote(item.dataset.id);
        }
        return;
      }

      const item = e.target.closest('.note-tree-item');
      if (item && item.dataset.id) {
        loadNote(item.dataset.id);
      }
    });

    elements.linkedMentionsContainer?.addEventListener('click', (e) => {
      const link = e.target.closest('.linked-mention-item');
      if (link && link.dataset.pageId) {
        loadNote(link.dataset.pageId);
      }
    });

    const handleSaveShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentNote();
      }
    };

    elements.noteTitle?.addEventListener('keydown', handleSaveShortcut);
    elements.noteBlocksContainer?.addEventListener('keydown', handleSaveShortcut);

    setupBlockEditorEvents();
  }

  function togglePageExpand(id) {
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const page = notes.find(n => n.id === id);
    if (page) {
      page.isExpanded = !page.isExpanded;
      Storage.saveData(Storage.KEYS.NOTES, notes);
      renderNotes();
    }
  }

  function cycleCoverColor() {
    if (!currentNoteId) return;
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
      const currentIdx = COVERS.indexOf(note.coverColor);
      const nextIdx = (currentIdx + 1) % COVERS.length;
      note.coverColor = COVERS[nextIdx];
      elements.pageCoverStrip.style.background = note.coverColor;
      Storage.saveData(Storage.KEYS.NOTES, notes);
    }
  }

  function openEmojiPicker(e) {
    if (!currentNoteId) return;
    const picker = document.createElement('div');
    picker.className = 'slash-menu-popup';
    picker.style.top = `${e.clientY + 10}px`;
    picker.style.left = `${e.clientX}px`;
    picker.style.width = '180px';
    picker.style.display = 'grid';
    picker.style.gridTemplateColumns = 'repeat(4, 1fr)';
    picker.style.gap = '6px';
    picker.style.padding = '8px';

    picker.innerHTML = EMOJIS.map(emoji => `
      <div class="slash-menu-item" style="justify-content:center;font-size:1.4rem;padding:4px;" data-emoji="${emoji}">${emoji}</div>
    `).join('');

    picker.addEventListener('click', (ev) => {
      const item = ev.target.closest('[data-emoji]');
      if (item && item.dataset.emoji) {
        const emoji = item.dataset.emoji;
        elements.pageIconBtn.innerText = emoji;
        const notes = Storage.loadData(Storage.KEYS.NOTES, []);
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
          note.icon = emoji;
          Storage.saveData(Storage.KEYS.NOTES, notes);
          renderNotes();
        }
        picker.parentNode.removeChild(picker);
      }
    });

    document.body.appendChild(picker);
  }

  function setupBlockEditorEvents() {
    const container = elements.noteBlocksContainer;
    if (!container) return;

    container.addEventListener('keydown', handleBlockKeyDown);
    container.addEventListener('input', handleBlockInput);
    container.addEventListener('change', handleBlockChange);

    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    document.addEventListener('selectionchange', handleSelectionChange);
  }

  function handleBlockKeyDown(e) {
    const blockContentEl = e.target.closest('.block-content');
    if (!blockContentEl) return;

    const blockItemEl = blockContentEl.closest('.block-item');
    if (!blockItemEl) return;

    const blockId = blockItemEl.dataset.id;
    const text = blockContentEl.innerText;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      closeSlashMenu();
      closeCrossLinkPopup();

      const newBlock = Blocks.createBlock('paragraph', '');
      const blockIndex = currentNoteBlocks.findIndex(b => b.id === blockId);

      if (blockIndex !== -1) {
        currentNoteBlocks.splice(blockIndex + 1, 0, newBlock);
      } else {
        currentNoteBlocks.push(newBlock);
      }

      renderBlocks();
      focusBlock(newBlock.id);
      return;
    }

    if (e.key === 'Backspace' && (text === '' || text === '\n')) {
      const blockIndex = currentNoteBlocks.findIndex(b => b.id === blockId);
      if (blockIndex > 0) {
        e.preventDefault();
        closeSlashMenu();
        closeCrossLinkPopup();
        const prevBlock = currentNoteBlocks[blockIndex - 1];
        currentNoteBlocks.splice(blockIndex, 1);
        renderBlocks();
        focusBlock(prevBlock.id, true);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const blockIndex = currentNoteBlocks.findIndex(b => b.id === blockId);
      if (blockIndex > 0) {
        if (e.shiftKey) {
          const parentBlock = currentNoteBlocks[blockIndex];
          if (parentBlock && parentBlock.children && parentBlock.children.length > 0) {
            const child = parentBlock.children.pop();
            currentNoteBlocks.splice(blockIndex + 1, 0, child);
            renderBlocks();
            focusBlock(child.id);
          }
        } else {
          const target = currentNoteBlocks[blockIndex];
          const prev = currentNoteBlocks[blockIndex - 1];
          currentNoteBlocks.splice(blockIndex, 1);
          prev.children = prev.children || [];
          prev.children.push(target);
          renderBlocks();
          focusBlock(target.id);
        }
      }
    }
  }

  function handleBlockInput(e) {
    const blockContentEl = e.target.closest('.block-content');
    if (!blockContentEl) return;

    const blockItemEl = blockContentEl.closest('.block-item');
    if (!blockItemEl) return;

    const blockId = blockItemEl.dataset.id;
    const text = blockContentEl.innerText;

    const block = findBlockById(currentNoteBlocks, blockId);
    if (block) {
      block.content = text;
    }

    checkAutoMarkdown(blockContentEl, block);

    if (text.endsWith('@') || text.endsWith('[[')) {
      openCrossLinkPopup(blockContentEl, block);
    } else if (text.startsWith('/')) {
      const query = text.substring(1).trim();
      openSlashMenu(blockContentEl, block, query);
    } else {
      closeSlashMenu();
    }
  }

  function openCrossLinkPopup(contentEl, block) {
    closeCrossLinkPopup();

    const rect = contentEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'slash-menu-popup';
    popup.style.top = `${window.scrollY + rect.bottom + 4}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;

    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const otherNotes = notes.filter(n => n.id !== currentNoteId);

    if (otherNotes.length === 0) {
      popup.innerHTML = '<div class="p-xs text-muted" style="font-size:12px;">No other pages to link.</div>';
    } else {
      popup.innerHTML = otherNotes.map(n => `
        <div class="slash-menu-item" data-page-id="${App.escapeHtml(n.id)}" data-page-title="${App.escapeHtml(n.title || 'Untitled')}">
          <span class="slash-menu-icon">${App.escapeHtml(n.icon || '📄')}</span>
          <span>${App.escapeHtml(n.title || 'Untitled')}</span>
        </div>
      `).join('');

      popup.addEventListener('click', (e) => {
        const item = e.target.closest('.slash-menu-item');
        if (item && item.dataset.pageId) {
          const pageId = item.dataset.pageId;
          const pageTitle = item.dataset.pageTitle;

          block.type = 'page_link';
          block.content = pageTitle;
          block.properties = { pageId, pageTitle };

          closeCrossLinkPopup();
          renderBlocks();
          saveCurrentNote();
        }
      });
    }

    document.body.appendChild(popup);
    crossLinkPopupEl = popup;
  }

  function closeCrossLinkPopup() {
    if (crossLinkPopupEl && crossLinkPopupEl.parentNode) {
      crossLinkPopupEl.parentNode.removeChild(crossLinkPopupEl);
      crossLinkPopupEl = null;
    }
  }

  function handleBlockChange(e) {
    if (e.target.classList.contains('block-checkbox')) {
      const blockItemEl = e.target.closest('.block-item');
      if (blockItemEl) {
        const blockId = blockItemEl.dataset.id;
        const block = findBlockById(currentNoteBlocks, blockId);
        if (block) {
          block.properties = block.properties || {};
          block.properties.checked = e.target.checked;
          const contentEl = blockItemEl.querySelector('.block-content');
          if (contentEl) {
            contentEl.classList.toggle('completed', e.target.checked);
          }
        }
      }
    }
  }

  function findBlockById(blocks, id) {
    for (const b of blocks) {
      if (b.id === id) return b;
      if (b.children && b.children.length > 0) {
        const found = findBlockById(b.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function checkAutoMarkdown(contentEl, block) {
    if (!block) return;
    const text = block.content;

    const markdownRules = [
      { prefix: '# ', type: 'heading1' },
      { prefix: '## ', type: 'heading2' },
      { prefix: '### ', type: 'heading3' },
      { prefix: '- ', type: 'bulleted_list' },
      { prefix: '* ', type: 'bulleted_list' },
      { prefix: '1. ', type: 'numbered_list' },
      { prefix: '[] ', type: 'todo' },
      { prefix: '[ ] ', type: 'todo' },
      { prefix: '> ', type: 'quote' },
      { prefix: '```', type: 'code' },
      { prefix: '---', type: 'divider' }
    ];

    for (const rule of markdownRules) {
      if (text.startsWith(rule.prefix)) {
        block.type = rule.type;
        block.content = text.substring(rule.prefix.length);
        renderBlocks();
        focusBlock(block.id);
        break;
      }
    }
  }

  function openSlashMenu(contentEl, block, query = '') {
    closeSlashMenu();

    const rect = contentEl.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'slash-menu-popup';
    menu.style.top = `${window.scrollY + rect.bottom + 4}px`;
    menu.style.left = `${window.scrollX + rect.left}px`;

    const options = [
      { type: 'paragraph', label: 'Text', icon: '📄' },
      { type: 'heading1', label: 'Heading 1', icon: 'H1' },
      { type: 'heading2', label: 'Heading 2', icon: 'H2' },
      { type: 'heading3', label: 'Heading 3', icon: 'H3' },
      { type: 'bulleted_list', label: 'Bulleted List', icon: '•' },
      { type: 'numbered_list', label: 'Numbered List', icon: '1.' },
      { type: 'todo', label: 'To-do List', icon: '☑' },
      { type: 'toggle', label: 'Toggle List', icon: '▶' },
      { type: 'quote', label: 'Quote', icon: '❝' },
      { type: 'divider', label: 'Divider', icon: '―' },
      { type: 'code', label: 'Code', icon: '</>' },
      { type: 'callout', label: 'Callout', icon: '💡' }
    ];

    const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));

    if (filtered.length === 0) return;

    menu.innerHTML = filtered.map((o, idx) => `
      <div class="slash-menu-item ${idx === 0 ? 'selected' : ''}" data-type="${o.type}">
        <span class="slash-menu-icon">${o.icon}</span>
        <span>${o.label}</span>
      </div>
    `).join('');

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.slash-menu-item');
      if (item && item.dataset.type) {
        block.type = item.dataset.type;
        block.content = '';
        closeSlashMenu();
        renderBlocks();
        focusBlock(block.id);
      }
    });

    document.body.appendChild(menu);
    slashMenuEl = menu;
  }

  function closeSlashMenu() {
    if (slashMenuEl && slashMenuEl.parentNode) {
      slashMenuEl.parentNode.removeChild(slashMenuEl);
      slashMenuEl = null;
    }
  }

  function handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !elements.noteBlocksContainer?.contains(selection.anchorNode)) {
      closeInlineToolbar();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (!inlineToolbarEl) {
      const toolbar = document.createElement('div');
      toolbar.className = 'inline-formatting-toolbar';
      toolbar.innerHTML = `
        <button class="inline-fmt-btn" data-fmt="bold">B</button>
        <button class="inline-fmt-btn" data-fmt="italic">I</button>
        <button class="inline-fmt-btn" data-fmt="code">&lt;/&gt;</button>
      `;

      toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.inline-fmt-btn');
        if (btn) {
          e.preventDefault();
          const fmt = btn.dataset.fmt;
          if (fmt === 'bold') document.execCommand('bold', false, null);
          if (fmt === 'italic') document.execCommand('italic', false, null);
          if (fmt === 'code') document.execCommand('insertHTML', false, `<code>${selection.toString()}</code>`);
        }
      });

      document.body.appendChild(toolbar);
      inlineToolbarEl = toolbar;
    }

    inlineToolbarEl.style.top = `${window.scrollY + rect.top - 36}px`;
    inlineToolbarEl.style.left = `${window.scrollX + rect.left}px`;
  }

  function closeInlineToolbar() {
    if (inlineToolbarEl && inlineToolbarEl.parentNode) {
      inlineToolbarEl.parentNode.removeChild(inlineToolbarEl);
      inlineToolbarEl = null;
    }
  }

  function handleDragStart(e) {
    const item = e.target.closest('.block-item');
    if (item) {
      draggedBlockId = item.dataset.id;
      e.dataTransfer.setData('text/plain', draggedBlockId);
      item.style.opacity = '0.5';
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.block-item');
    if (targetItem && draggedBlockId) {
      const targetId = targetItem.dataset.id;
      if (targetId !== draggedBlockId) {
        const fromIdx = currentNoteBlocks.findIndex(b => b.id === draggedBlockId);
        const toIdx = currentNoteBlocks.findIndex(b => b.id === targetId);

        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = currentNoteBlocks.splice(fromIdx, 1);
          currentNoteBlocks.splice(toIdx, 0, moved);
          renderBlocks();
        }
      }
    }
    draggedBlockId = null;
  }

  function focusBlock(id, atEnd = false) {
    requestAnimationFrame(() => {
      const item = elements.noteBlocksContainer.querySelector(`[data-id="${id}"]`);
      if (item) {
        const contentEl = item.querySelector('.block-content');
        if (contentEl) {
          contentEl.focus();
          if (atEnd) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(contentEl);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    });
  }

  function populateSubjects() {
    const subjects = Storage.getSubjects();
    elements.noteSubject.innerHTML = subjects.map(s => `<option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>`).join('');
  }

  function renderTreeNodes(allNotes, parentId = null) {
    const children = allNotes.filter(n => (n.parentId || null) === parentId);
    if (children.length === 0) return '';

    return children.map(note => {
      const subpages = allNotes.filter(n => n.parentId === note.id);
      const hasChildren = subpages.length > 0;
      const isExpanded = note.isExpanded !== false;

      return `
        <div class="note-tree-node">
          <div class="note-tree-item ${note.id === currentNoteId ? 'active' : ''}"
               data-id="${App.escapeHtml(note.id)}"
               tabindex="0"
               role="button"
               aria-label="Open page: ${App.escapeHtml(note.title || 'Untitled')}">
            <span class="tree-toggle-arrow">${hasChildren ? (isExpanded ? '▼' : '▶') : '•'}</span>
            <span class="tree-icon">${App.escapeHtml(note.icon || '📄')}</span>
            <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
              ${App.escapeHtml(note.title || 'Untitled')}
            </span>
            <span class="tree-add-subpage-btn" title="Add sub-page">+</span>
          </div>
          ${hasChildren && isExpanded ? `<div class="tree-subpages-container">${renderTreeNodes(allNotes, note.id)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderLinkedMentions() {
    if (!elements.linkedMentionsContainer || !currentNoteId) return;

    const allNotes = Storage.loadData(Storage.KEYS.NOTES, []);
    const referencingNotes = allNotes.filter(note => {
      if (note.id === currentNoteId) return false;
      if (!note.blocks) return false;
      return note.blocks.some(b => b.type === 'page_link' && b.properties?.pageId === currentNoteId);
    });

    if (referencingNotes.length === 0) {
      elements.linkedMentionsContainer.style.display = 'none';
      return;
    }

    elements.linkedMentionsContainer.style.display = 'block';
    elements.linkedMentionsContainer.innerHTML = `
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
        <h4 style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Linked Mentions (${referencingNotes.length})</h4>
        <div class="flex flex-col gap-xs">
          ${referencingNotes.map(n => `
            <div class="linked-mention-item card flex items-center gap-sm p-xs" data-page-id="${App.escapeHtml(n.id)}" style="cursor: pointer; background: var(--bg-tertiary);">
              <span>${App.escapeHtml(n.icon || '📄')}</span>
              <span style="font-weight: 500;">${App.escapeHtml(n.title || 'Untitled')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderNotes() {
    const notes = Storage.loadData(Storage.KEYS.NOTES, Storage.DEFAULTS.notes || []);
    const searchTerm = elements.searchNotes?.value.toLowerCase();

    if (searchTerm) {
      const filtered = notes.filter(n => (n.title || '').toLowerCase().includes(searchTerm));
      elements.notesList.innerHTML = filtered.map(note => `
        <div class="note-tree-item ${note.id === currentNoteId ? 'active' : ''}" data-id="${App.escapeHtml(note.id)}">
          <span>${App.escapeHtml(note.icon || '📄')}</span>
          <span>${App.escapeHtml(note.title || 'Untitled')}</span>
        </div>
      `).join('');
      return;
    }

    elements.notesList.innerHTML = renderTreeNodes(notes, null);

    if (notes.length === 0) {
      elements.notesList.innerHTML = '<p class="text-secondary text-center py-md">No pages found.</p>';
    }
  }

  function renderBlocks() {
    if (!elements.noteBlocksContainer) return;
    elements.noteBlocksContainer.innerHTML = currentNoteBlocks.map((block, idx) => Blocks.renderBlockHtml(block, idx)).join('');
  }

  function createNewNote(parentId = null) {
    currentNoteId = 'note_' + Storage.generateId();
    currentNoteBlocks = [Blocks.createBlock('paragraph', '')];

    elements.noteTitle.value = '';
    elements.noteSubject.value = Storage.getSubjects()[0]?.name || 'Other';
    elements.pageCoverStrip.style.background = COVERS[0];
    elements.pageIconBtn.innerText = '📄';

    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    notes.push({
      id: currentNoteId,
      parentId: parentId,
      title: 'Untitled',
      icon: '📄',
      coverColor: COVERS[0],
      isExpanded: true,
      subject: elements.noteSubject.value,
      blocks: currentNoteBlocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    Storage.saveData(Storage.KEYS.NOTES, notes);
    renderBlocks();
    showEditor();
    renderNotes();
    renderLinkedMentions();
  }

  function createNewNoteFromTemplate(tmpl) {
    currentNoteId = 'note_' + Storage.generateId();
    currentNoteBlocks = tmpl.blocks.map(b => Blocks.createBlock(b.type, b.content, b.children, b.properties));

    elements.noteTitle.value = tmpl.title;
    elements.noteSubject.value = Storage.getSubjects()[0]?.name || 'Other';
    elements.pageCoverStrip.style.background = COVERS[0];
    elements.pageIconBtn.innerText = tmpl.icon || '📄';

    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    notes.push({
      id: currentNoteId,
      parentId: null,
      title: tmpl.title,
      icon: tmpl.icon || '📄',
      coverColor: COVERS[0],
      isExpanded: true,
      subject: elements.noteSubject.value,
      blocks: currentNoteBlocks,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    Storage.saveData(Storage.KEYS.NOTES, notes);
    renderBlocks();
    showEditor();
    renderNotes();
    renderLinkedMentions();
  }

  function loadNote(id) {
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    currentNoteId = id;
    elements.noteTitle.value = note.title || '';
    elements.noteSubject.value = note.subject || 'Other';
    elements.pageCoverStrip.style.background = note.coverColor || COVERS[0];
    elements.pageIconBtn.innerText = note.icon || '📄';

    currentNoteBlocks = Array.isArray(note.blocks) && note.blocks.length > 0
      ? note.blocks.map(b => Blocks.sanitizeBlock(b)).filter(Boolean)
      : [Blocks.createBlock('paragraph', note.content || '')];

    renderBlocks();
    showEditor();
    renderNotes();
    renderLinkedMentions();
  }

  function showEditor() {
    elements.noteEditor.style.display = 'flex';
    elements.emptyEditorState.style.display = 'none';
  }

  function saveCurrentNote() {
    if (!currentNoteId) return;

    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const idx = notes.findIndex(n => n.id === currentNoteId);

    const blockElements = elements.noteBlocksContainer.querySelectorAll('.block-item');
    blockElements.forEach(item => {
      const id = item.dataset.id;
      const contentEl = item.querySelector('.block-content');
      if (contentEl) {
        const block = findBlockById(currentNoteBlocks, id);
        if (block) {
          block.content = contentEl.innerText.substring(0, 5000);
        }
      }
    });

    const flatContent = currentNoteBlocks.map(b => b.content).join('\n');

    const noteData = {
      id: currentNoteId,
      title: String(elements.noteTitle.value || '').trim().substring(0, 200) || 'Untitled',
      subject: elements.noteSubject.value,
      icon: elements.pageIconBtn.innerText,
      coverColor: elements.pageCoverStrip.style.background,
      content: flatContent.substring(0, 10000),
      blocks: currentNoteBlocks,
      updatedAt: new Date().toISOString()
    };

    if (idx !== -1) {
      notes[idx] = { ...notes[idx], ...noteData };
    } else {
      noteData.createdAt = new Date().toISOString();
      notes.push(noteData);
    }

    Storage.saveData(Storage.KEYS.NOTES, notes);
    App.showToast('Transmission saved to vault', 'success');
    renderNotes();
    renderLinkedMentions();
  }

  async function deleteCurrentNote() {
    if (!currentNoteId) return;
    if (await App.confirm({ title: 'Purge Page?', message: 'This page will be permanently erased from the vault.', confirmText: 'Purge', danger: true })) {
      const notes = Storage.loadData(Storage.KEYS.NOTES, []);
      Storage.saveData(Storage.KEYS.NOTES, notes.filter(n => n.id !== currentNoteId && n.parentId !== currentNoteId));
      currentNoteId = null;
      elements.noteEditor.style.display = 'none';
      elements.emptyEditorState.style.display = 'flex';
      renderNotes();
    }
  }

  return { init, loadNote, createNewNote, renderBlocks, renderLinkedMentions };
})();

window.Notes = Notes;
