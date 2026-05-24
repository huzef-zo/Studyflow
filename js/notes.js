/**
 * StudyFlow - Knowledge Vault (Notes) Module
 */

const Notes = (function() {
  'use strict';

  let elements = {};
  let currentNoteId = null;

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
      deleteNoteBtn: document.getElementById('delete-note-btn')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    populateSubjects();
    renderNotes();
  }

  function setupEventListeners() {
    elements.newNoteBtn?.addEventListener('click', createNewNote);
    elements.saveNoteBtn?.addEventListener('click', saveCurrentNote);
    elements.deleteNoteBtn?.addEventListener('click', deleteCurrentNote);
    elements.searchNotes?.addEventListener('input', App.debounce(() => renderNotes(), 300));
  }

  function populateSubjects() {
    const subjects = Storage.getSubjects();
    elements.noteSubject.innerHTML = subjects.map(s => `<option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>`).join('');
  }

  function renderNotes() {
    const notes = Storage.loadData(Storage.KEYS.NOTES, Storage.DEFAULTS.notes || []);
    const searchTerm = elements.searchNotes?.value.toLowerCase();

    let filtered = notes;
    if (searchTerm) {
      filtered = notes.filter(n => n.title.toLowerCase().includes(searchTerm) || n.content.toLowerCase().includes(searchTerm));
    }

    elements.notesList.innerHTML = filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(note => `
      <div class="note-item ${note.id === currentNoteId ? 'active' : ''}" onclick="Notes.loadNote('${note.id}')">
        <div style="font-weight: 700; color: white; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${App.escapeHtml(note.title || 'Untitled')}</div>
        <div class="flex items-center justify-between">
          <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">${App.escapeHtml(note.subject)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(note.updatedAt).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');

    if (filtered.length === 0) {
      elements.notesList.innerHTML = '<p class="text-secondary text-center py-md">No entries found.</p>';
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
    elements.noteTitle.value = note.title;
    elements.noteContent.value = note.content;
    elements.noteSubject.value = note.subject;

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

    const noteData = {
      id: currentNoteId,
      title: elements.noteTitle.value.trim() || 'Untitled',
      content: elements.noteContent.value,
      subject: elements.noteSubject.value,
      updatedAt: new Date().toISOString()
    };

    if (idx !== -1) {
      notes[idx] = noteData;
    } else {
      noteData.createdAt = new Date().toISOString();
      notes.push(noteData);
    }

    Storage.saveData(Storage.KEYS.NOTES, notes);
    App.showToast('Transmission saved to vault', 'success');
    renderNotes();
  }

  async function deleteCurrentNote() {
    if (!currentNoteId) return;
    if (await App.confirm({ title: 'Purge Entry?', message: 'This note will be permanently erased from the vault.', confirmText: 'Purge', danger: true })) {
      const notes = Storage.loadData(Storage.KEYS.NOTES, []);
      Storage.saveData(Storage.KEYS.NOTES, notes.filter(n => n.id !== currentNoteId));
      currentNoteId = null;
      elements.noteEditor.style.display = 'none';
      elements.emptyEditorState.style.display = 'flex';
      renderNotes();
    }
  }

  return { init, loadNote };
})();

window.Notes = Notes;
