/**
 * StudyFlow - Notes Module
 * Fully aligned with Stitch design system.
 */

const Notes = (function() {
  'use strict';

  let elements = {};
  let currentFilterSubject = 'all';

  function initElements() {
    elements = {
      notesList: document.getElementById('notes-list'),
      searchInput: document.getElementById('notes-search-input'),
      notesCountBadge: document.getElementById('notes-count-badge'),
      newNoteBtn: document.getElementById('new-note-btn'),
      subjectFilterChips: document.getElementById('subject-filter-chips')
    };
  }

  function renderSubjectFilterChips() {
    if (!elements.subjectFilterChips) return;

    const subjects = Storage.getSubjects ? Storage.getSubjects() : [];
    let html = `
      <button class="chip-filter ${currentFilterSubject === 'all' ? 'active bg-primary-container/15 text-primary-container' : 'bg-surface-container-high/60 text-text-secondary hover:text-text-primary'} whitespace-nowrap px-3.5 py-1.5 rounded-full font-label-sm text-label-sm transition-all" data-subject="all">
        All Notes
      </button>
    `;

    subjects.forEach(s => {
      const isActive = currentFilterSubject === s.name;
      html += `
        <button class="chip-filter ${isActive ? 'active bg-primary-container/15 text-primary-container' : 'bg-surface-container-high/60 text-text-secondary hover:text-text-primary'} whitespace-nowrap px-3.5 py-1.5 rounded-full font-label-sm text-label-sm transition-all" data-subject="${App.escapeHtml(s.name)}">
          ${App.escapeHtml(s.name)}
        </button>
      `;
    });

    elements.subjectFilterChips.innerHTML = html;

    elements.subjectFilterChips.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilterSubject = chip.getAttribute('data-subject') || 'all';
        renderSubjectFilterChips();
        renderNotes();
      });
    });
  }

  function renderNotes() {
    if (!elements.notesList) return;

    const notes = Storage.getNotes ? Storage.getNotes() : [];
    const query = elements.searchInput ? elements.searchInput.value.trim().toLowerCase() : '';

    let filtered = notes;
    if (query) {
      filtered = filtered.filter(n => (n.title && n.title.toLowerCase().includes(query)) || (n.content && n.content.toLowerCase().includes(query)));
    }

    if (currentFilterSubject !== 'all') {
      filtered = filtered.filter(n => n.subject === currentFilterSubject);
    }

    if (elements.notesCountBadge) {
      elements.notesCountBadge.textContent = `${filtered.length} note${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      elements.notesList.innerHTML = App.createEmptyStateHtml({
        title: 'No notes found',
        text: 'Capture ideas, study summaries, and key concepts.',
        icon: 'description',
        actionText: 'Create note',
        actionId: 'empty-new-note-btn'
      });
      const emptyBtn = elements.notesList.querySelector('#empty-new-note-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => openNoteEditorModal());
      return;
    }

    // Sort: pinned first, then by updatedAt newest
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aTime = a.updatedAt || '';
      const bTime = b.updatedAt || '';
      return bTime < aTime ? -1 : (bTime > aTime ? 1 : 0);
    });

    elements.notesList.innerHTML = filtered.map(note => {
      const words = note.content ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;
      const readMins = Math.max(1, Math.ceil(words / 200));

      const updatedDate = new Date(note.updatedAt || note.createdAt || Date.now());
      const dateText = !isNaN(updatedDate.getTime())
        ? updatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Recent';

      return `
        <article class="relative p-4 rounded-3xl bg-surface-container/70 backdrop-blur-xl shadow-md hover:bg-surface-container-high/70 active:scale-[0.99] transition-all cursor-pointer note-card" data-id="${App.escapeHtml(note.id)}">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-[11px] bg-secondary-container/50 text-secondary">
              ${App.escapeHtml(note.subject || 'General')}
            </span>
            <div class="flex items-center gap-2">
              <button aria-label="${note.pinned ? 'Unpin note' : 'Pin note'}" class="pin-note-btn text-primary hover:text-accent-hover transition-colors" data-id="${App.escapeHtml(note.id)}">
                <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' ${note.pinned ? 1 : 0};">push_pin</span>
              </button>
              <button aria-label="Delete note" class="delete-note-btn text-text-muted hover:text-error transition-colors" data-id="${App.escapeHtml(note.id)}">
                <span class="material-symbols-outlined text-[18px]">delete_forever</span>
              </button>
            </div>
          </div>
          <h2 class="font-headline-sm text-headline-sm text-text-primary tracking-tight mb-1.5 leading-snug truncate">
            ${App.escapeHtml(note.title || 'Untitled Note')}
          </h2>
          <p class="font-body-sm text-body-sm text-text-secondary line-clamp-2 mb-3 leading-relaxed">
            ${App.escapeHtml(note.content || 'Empty note...')}
          </p>
          <div class="flex items-center justify-between text-text-muted font-label-sm text-label-sm pt-2 border-t border-glass-border-subtle">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              ${App.escapeHtml(dateText)}
            </span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">schedule</span>
              ${readMins} min read
            </span>
          </div>
        </article>
      `;
    }).join('');

    // Attach card listeners
    elements.notesList.querySelectorAll('.note-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.pin-note-btn') || e.target.closest('.delete-note-btn')) return;
        const noteId = card.getAttribute('data-id');
        const note = notes.find(n => n.id === noteId);
        if (note) openNoteEditorModal(note);
      });
    });

    // Pin buttons
    elements.notesList.querySelectorAll('.pin-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.getAttribute('data-id');
        const note = notes.find(n => n.id === noteId);
        if (note) {
          note.pinned = !note.pinned;
          note.updatedAt = new Date().toISOString();
          Storage.saveData(Storage.KEYS.NOTES, notes);
          renderNotes();
        }
      });
    });

    // Delete buttons
    elements.notesList.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noteId = btn.getAttribute('data-id');
        const note = notes.find(n => n.id === noteId);
        if (note && await App.confirm({
          title: 'Delete Note',
          message: `Are you sure you want to delete "${note.title}"?`,
          confirmText: 'Delete',
          danger: true
        })) {
          const updated = notes.filter(n => n.id !== noteId);
          Storage.saveData(Storage.KEYS.NOTES, updated);
          App.showToast('Note deleted', 'info');
          renderNotes();
        }
      });
    });
  }

  function openNoteEditorModal(existingNote = null) {
    const isEdit = !!existingNote;
    const subjects = Storage.getSubjects ? Storage.getSubjects() : [];
    const defaultSubject = subjects.length > 0 ? subjects[0].name : 'General';

    const title = existingNote?.title || '';
    const subject = existingNote?.subject || defaultSubject;
    const content = existingNote?.content || '';

    const editorOverlay = document.createElement('div');
    editorOverlay.className = 'fixed inset-0 z-50 flex flex-col bg-surface-base';
    editorOverlay.id = 'note-editor-overlay';

    editorOverlay.innerHTML = `
      <div class="h-16 px-margin flex items-center justify-between border-b border-glass-border bg-surface-base/90 backdrop-blur-xl">
        <button class="flex items-center gap-1 text-text-secondary hover:text-text-primary font-label-md text-label-md" id="close-editor-btn" type="button">
          <span class="material-symbols-outlined text-[20px]">chevron_left</span>
          <span>Back</span>
        </button>
        <span class="font-headline-sm text-headline-sm text-text-primary font-semibold">${isEdit ? 'Edit Note' : 'New Note'}</span>
        <div class="flex items-center gap-2">
          ${isEdit ? `
            <button aria-label="Delete note" class="w-9 h-9 rounded-full bg-surface-container-high text-error hover:bg-error-container/30 flex items-center justify-center transition-colors" id="editor-delete-btn" type="button">
              <span class="material-symbols-outlined text-[18px]">delete_forever</span>
            </button>
          ` : ''}
          <button class="px-4 py-2 rounded-full bg-primary-container text-surface-base font-label-md text-label-md font-semibold hover:bg-accent-hover transition-colors" id="editor-save-btn" type="button">
            Save
          </button>
        </div>
      </div>

      <div class="flex-1 flex flex-col max-w-2xl w-full mx-auto p-margin gap-4 overflow-y-auto">
        <input type="text" id="editor-title-input" class="w-full bg-transparent border-none outline-none font-headline-lg text-headline-lg text-text-primary placeholder:text-text-muted p-0" placeholder="Note title..." value="${App.escapeHtml(title)}" aria-label="Note title"/>

        <div class="flex items-center gap-3">
          <label class="font-label-sm text-label-sm text-text-secondary" for="editor-subject-select">Subject:</label>
          <select id="editor-subject-select" class="px-3 py-1.5 rounded-full bg-surface-container-high text-text-primary font-label-md text-label-md border border-glass-border outline-none cursor-pointer">
            ${subjects.map(s => `
              <option value="${App.escapeHtml(s.name)}" ${s.name === subject ? 'selected' : ''}>${App.escapeHtml(s.name)}</option>
            `).join('')}
          </select>
        </div>

        <textarea id="editor-content-textarea" class="flex-1 w-full bg-transparent border-none outline-none font-body-md text-body-md text-text-primary placeholder:text-text-muted resize-none p-0 leading-relaxed min-h-[300px]" placeholder="Start typing your note here..." aria-label="Note content">${App.escapeHtml(content)}</textarea>
      </div>
    `;

    document.body.appendChild(editorOverlay);

    const titleInput = editorOverlay.querySelector('#editor-title-input');
    const contentInput = editorOverlay.querySelector('#editor-content-textarea');
    const subjectSelect = editorOverlay.querySelector('#editor-subject-select');

    if (!isEdit && titleInput) {
      titleInput.focus();
    }

    const closeEditor = () => {
      if (editorOverlay.parentNode) editorOverlay.parentNode.removeChild(editorOverlay);
    };

    editorOverlay.querySelector('#close-editor-btn').addEventListener('click', closeEditor);

    // Save note
    editorOverlay.querySelector('#editor-save-btn').addEventListener('click', () => {
      const newTitle = titleInput.value.trim() || 'Untitled Note';
      const newContent = contentInput.value;
      const newSubject = subjectSelect.value;

      const notes = Storage.getNotes ? Storage.getNotes() : [];
      if (isEdit) {
        const idx = notes.findIndex(n => n.id === existingNote.id);
        if (idx !== -1) {
          notes[idx] = {
            ...notes[idx],
            title: newTitle,
            content: newContent,
            subject: newSubject,
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        notes.push({
          id: 'note_' + Storage.generateId(),
          title: newTitle,
          content: newContent,
          subject: newSubject,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      Storage.saveData(Storage.KEYS.NOTES, notes);
      App.showToast(isEdit ? 'Note saved' : 'Note created', 'success');
      closeEditor();
      renderNotes();
    });

    // Delete note
    const deleteBtn = editorOverlay.querySelector('#editor-delete-btn');
    if (deleteBtn && isEdit) {
      deleteBtn.addEventListener('click', async () => {
        if (await App.confirm({
          title: 'Delete Note',
          message: `Are you sure you want to delete "${existingNote.title}"?`,
          confirmText: 'Delete',
          danger: true
        })) {
          const notes = Storage.getNotes ? Storage.getNotes() : [];
          const updated = notes.filter(n => n.id !== existingNote.id);
          Storage.saveData(Storage.KEYS.NOTES, updated);
          App.showToast('Note deleted', 'info');
          closeEditor();
          renderNotes();
        }
      });
    }

    // Ctrl+S shortcut
    editorOverlay.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        editorOverlay.querySelector('#editor-save-btn').click();
      }
    });
  }

  function setupEventListeners() {
    if (elements.newNoteBtn) {
      elements.newNoteBtn.onclick = () => openNoteEditorModal();
    }
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', App.debounce(() => renderNotes(), 250));
    }
    window.addEventListener('studyflow_taskDataChanged', () => {
      renderSubjectFilterChips();
      renderNotes();
    });
  }

  function init() {
    initElements();
    setupEventListeners();
    renderSubjectFilterChips();
    renderNotes();
  }

  return { init, renderNotes, openNoteEditorModal };
})();

window.Notes = Notes;
