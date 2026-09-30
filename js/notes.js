/**
 * StudyFlow - Notes Module
 */

const Notes = (function() {
  'use strict';

  let elements = {};
  let currentNoteId = null;
  let currentSubjectFilter = 'all';

  function initElements() {
    elements = {
      notesList: document.getElementById('notes-list'),
      searchNotes: document.getElementById('search-notes'),
      newNoteBtn: document.getElementById('new-note-btn'),
      noteEditor: document.getElementById('note-editor'),
      emptyEditorState: document.getElementById('empty-editor-state'),
      noteTitle: document.getElementById('note-title'),
      noteSubject: document.getElementById('note-subject'),
      noteContent: document.getElementById('note-content'),
      saveNoteBtn: document.getElementById('save-note-btn'),
      deleteNoteBtn: document.getElementById('delete-note-btn'),
      countBadge: document.getElementById('notes-count-badge'),
      subjectFilters: document.getElementById('notes-subject-filters')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    populateSubjects();
    renderSubjectFilterChips();
    renderNotes();
  }

  function setupEventListeners() {
    elements.newNoteBtn?.addEventListener('click', createNewNote);
    elements.saveNoteBtn?.addEventListener('click', saveCurrentNote);
    elements.deleteNoteBtn?.addEventListener('click', deleteCurrentNote);
    elements.searchNotes?.addEventListener('input', App.debounce(() => renderNotes(), 300));

    elements.notesList?.addEventListener('click', (e) => {
      const pinBtn = e.target.closest('.pin-note-btn');
      if (pinBtn && pinBtn.dataset.id) {
        e.stopPropagation();
        togglePinNote(pinBtn.dataset.id);
        return;
      }

      const delBtn = e.target.closest('.del-note-btn');
      if (delBtn && delBtn.dataset.id) {
        e.stopPropagation();
        deleteNoteById(delBtn.dataset.id);
        return;
      }

      const item = e.target.closest('.note-card');
      if (item && item.dataset.id) {
        loadNote(item.dataset.id);
      }
    });

    elements.notesList?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.note-card');
        if (item && item.dataset.id) {
          e.preventDefault();
          loadNote(item.dataset.id);
        }
      }
    });

    const handleSaveShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentNote();
      }
    };

    elements.noteTitle?.addEventListener('keydown', handleSaveShortcut);
    elements.noteContent?.addEventListener('keydown', handleSaveShortcut);
  }

  function populateSubjects() {
    const subjects = Storage.getSubjects();
    if (elements.noteSubject) {
      elements.noteSubject.innerHTML = subjects.map(s => `<option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>`).join('');
    }
  }

  function renderSubjectFilterChips() {
    if (!elements.subjectFilters) return;
    const subjects = Storage.getSubjects();
    elements.subjectFilters.innerHTML = `
      <button type="button" class="filter-tab ${currentSubjectFilter === 'all' ? 'active' : ''}" data-subject="all">All</button>
      ${subjects.map(s => `
        <button type="button" class="filter-tab ${currentSubjectFilter === s.name ? 'active' : ''}" data-subject="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</button>
      `).join('')}
    `;

    elements.subjectFilters.querySelectorAll('.filter-tab').forEach(chip => {
      chip.onclick = () => {
        elements.subjectFilters.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentSubjectFilter = chip.dataset.subject;
        renderNotes();
      };
    });
  }

  function calculateMinRead(content) {
    if (!content) return 1;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  function renderNotes() {
    const notes = Storage.loadData(Storage.KEYS.NOTES, Storage.DEFAULTS.notes || []);
    const searchTerm = elements.searchNotes?.value.toLowerCase();

    let filtered = notes;
    if (searchTerm) {
      filtered = notes.filter(n => (n.title || '').toLowerCase().includes(searchTerm) || (n.content || '').toLowerCase().includes(searchTerm) || (n.subject || '').toLowerCase().includes(searchTerm));
    }

    if (currentSubjectFilter && currentSubjectFilter !== 'all') {
      filtered = filtered.filter(n => n.subject === currentSubjectFilter);
    }

    if (elements.countBadge) {
      elements.countBadge.textContent = `${filtered.length} note${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      elements.notesList.innerHTML = '<p class="text-muted text-center py-md" style="font-size:13px;">No notes found.</p>';
      return;
    }

    // Sort pinned notes first, then newest updated
    const sorted = [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aVal = a.updatedAt || '';
      const bVal = b.updatedAt || '';
      return bVal < aVal ? -1 : (bVal > aVal ? 1 : 0);
    });

    elements.notesList.innerHTML = sorted.map(note => {
      const subjectColor = App.getSubjectColor(note.subject);
      const minRead = calculateMinRead(note.content);
      const dateStr = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const preview = (note.content || '').replace(/\n+/g, ' ').substring(0, 90);

      return `
        <div class="note-card ${note.id === currentNoteId ? 'active' : ''}"
             data-id="${App.escapeHtml(note.id)}"
             tabindex="0"
             role="button"
             aria-label="Open note: ${App.escapeHtml(note.title || 'Untitled')}">
          <div class="flex items-center justify-between mb-xs">
            <span class="subject-tag" style="background:rgba(${App.hexToRgb(subjectColor)}, 0.12);color:${subjectColor};font-size:10px;padding:2px 8px;">
              ${App.escapeHtml(note.subject || 'Other')}
            </span>
            <div class="flex items-center gap-xs">
              <button type="button" class="btn btn-ghost btn-icon btn-sm pin-note-btn" data-id="${App.escapeHtml(note.id)}" aria-label="${note.pinned ? 'Unpin note' : 'Pin note'}" title="${note.pinned ? 'Unpin note' : 'Pin note'}">
                📌
              </button>
              <button type="button" class="btn btn-ghost btn-icon btn-sm del-note-btn" data-id="${App.escapeHtml(note.id)}" aria-label="Delete note" title="Delete note">
                &times;
              </button>
            </div>
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${note.pinned ? '📌 ' : ''}${App.escapeHtml(note.title || 'Untitled')}
          </div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${App.escapeHtml(preview || 'No content')}
          </div>
          <div class="flex items-center justify-between" style="font-size:11px;color:var(--text-muted);">
            <span>${dateStr}</span>
            <span>${minRead} min read</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function togglePinNote(id) {
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const idx = notes.findIndex(n => n.id === id);
    if (idx !== -1) {
      notes[idx].pinned = !notes[idx].pinned;
      Storage.saveData(Storage.KEYS.NOTES, notes);
      App.showToast(notes[idx].pinned ? 'Note pinned' : 'Note unpinned', 'info');
      renderNotes();
    }
  }

  async function deleteNoteById(id) {
    if (await App.confirm({ title: 'Delete Note?', message: 'This note will be permanently deleted.', confirmText: 'Delete', danger: true })) {
      const notes = Storage.loadData(Storage.KEYS.NOTES, []);
      Storage.saveData(Storage.KEYS.NOTES, notes.filter(n => n.id !== id));
      if (currentNoteId === id) {
        currentNoteId = null;
        elements.noteEditor.style.display = 'none';
        elements.emptyEditorState.style.display = 'flex';
      }
      App.showToast('Note deleted', 'info');
      renderNotes();
    }
  }

  function createNewNote() {
    currentNoteId = 'note_' + Storage.generateId();
    elements.noteTitle.value = '';
    elements.noteContent.value = '';
    elements.noteSubject.value = Storage.getSubjects()[0]?.name || 'Other';

    showEditor();
  }

  function loadNote(id) {
    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const note = notes.find(n => n.id === id);
    if (!note) return;

    currentNoteId = id;
    elements.noteTitle.value = note.title || '';
    elements.noteContent.value = note.content || '';
    elements.noteSubject.value = note.subject || (Storage.getSubjects()[0]?.name || 'Other');

    showEditor();
    renderNotes();
  }

  function showEditor() {
    elements.noteEditor.style.display = 'flex';
    elements.emptyEditorState.style.display = 'none';
  }

  function saveCurrentNote() {
    if (!currentNoteId) return;

    const notes = Storage.loadData(Storage.KEYS.NOTES, []);
    const idx = notes.findIndex(n => n.id === currentNoteId);

    const existingPinned = idx !== -1 ? Boolean(notes[idx].pinned) : false;

    const noteData = {
      id: currentNoteId,
      title: String(elements.noteTitle.value || '').trim().substring(0, 200) || 'Untitled',
      content: String(elements.noteContent.value || '').substring(0, 10000),
      subject: elements.noteSubject.value,
      pinned: existingPinned,
      updatedAt: new Date().toISOString()
    };

    if (idx !== -1) {
      notes[idx] = noteData;
    } else {
      noteData.createdAt = new Date().toISOString();
      notes.push(noteData);
    }

    Storage.saveData(Storage.KEYS.NOTES, notes);
    App.showToast('Note saved', 'success');
    renderNotes();
  }

  async function deleteCurrentNote() {
    if (!currentNoteId) return;
    await deleteNoteById(currentNoteId);
  }

  return { init, loadNote };
})();

window.Notes = Notes;
