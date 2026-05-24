/**
 * StudyFlow - Exam Countdown & Battle Prep Module
 */

const Exams = (function() {
  'use strict';

  let elements = {};

  function initElements() {
    elements = {
      examList: document.getElementById('exam-list'),
      addExamBtn: document.getElementById('add-exam-btn')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    renderExams();
  }

  function setupEventListeners() {
    elements.addExamBtn?.addEventListener('click', openAddExamModal);
  }

  function renderExams() {
    const exams = Storage.loadData(Storage.KEYS.EXAMS, Storage.DEFAULTS.exams || []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (exams.length === 0) {
      elements.examList.innerHTML = App.createEmptyStateHtml({
        title: 'No Exams Scheduled',
        text: 'Register upcoming examination events to begin tactical preparation.',
        icon: 'calendar',
        actionText: 'Add First Exam',
        actionId: 'empty-add-exam'
      });
      document.getElementById('empty-add-exam')?.addEventListener('click', openAddExamModal);
      return;
    }

    elements.examList.innerHTML = exams.sort((a, b) => new Date(a.examDate) - new Date(b.examDate)).map(exam => {
      const examDate = new Date(exam.examDate);
      const diffTime = examDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let colorClass = 'var(--success)';
      if (diffDays < 0) colorClass = 'var(--text-muted)';
      else if (diffDays < 7) colorClass = 'var(--danger)';
      else if (diffDays < 14) colorClass = 'var(--warning)';

      return `
        <div class="card exam-card animate-fade-in" style="border-top: 4px solid ${colorClass}">
          <div class="flex items-center justify-between mb-sm">
            <div class="subject-pill" style="--tag-color:${App.hexToRgb(App.getSubjectColor(exam.subject))}; color:white; background:rgba(255,255,255,0.05);">${App.escapeHtml(exam.subject)}</div>
            <button class="btn btn-ghost btn-icon btn-sm del-exam" data-id="${exam.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <h3 style="color:white; margin-bottom: 1rem;">${App.escapeHtml(exam.title)}</h3>
          <div class="exam-countdown" style="color: ${colorClass}">
            ${diffDays < 0 ? 'PAST' : (diffDays === 0 ? 'TODAY' : diffDays)}
            <span style="font-size: 0.875rem; color: var(--text-muted); font-weight: 500;">${diffDays === 1 ? 'day' : 'days'} remaining</span>
          </div>
          <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1.5rem;">
            Target: ${Storage.formatDisplayDate(exam.examDate)}
          </div>
          <button class="btn btn-primary w-full" onclick="Exams.enterBattlePrep('${exam.id}')" ${diffDays < 0 ? 'disabled' : ''}>
            Enter Battle Prep
          </button>
        </div>
      `;
    }).join('');

    elements.examList.querySelectorAll('.del-exam').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        deleteExam(btn.dataset.id);
      };
    });
  }

  function openAddExamModal() {
    const subjects = Storage.getSubjects();
    const content = `
      <form id="add-exam-form">
        <div class="form-group">
          <label class="form-label">Exam Title</label>
          <input type="text" name="title" class="form-input" placeholder="e.g. Final Mathematics" required>
        </div>
        <div class="form-group">
          <label class="form-label">Exam Date</label>
          <input type="date" name="examDate" class="form-input" value="${Storage.formatDate(new Date())}" required>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Subject</label>
            <select name="subject" class="form-input">
              ${subjects.map(s => `<option value="${App.escapeHtml(s.name)}">${App.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Importance (1-5)</label>
            <input type="number" name="weight" class="form-input" min="1" max="5" value="3">
          </div>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: 'Schedule Examination',
      content,
      footer: `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-primary" id="save-exam">Schedule</button>`
    });

    modal.querySelector('#save-exam').onclick = () => {
      const form = modal.querySelector('#add-exam-form');
      const data = App.getFormData(form);
      if (data.title && data.examDate) {
        const exams = Storage.loadData(Storage.KEYS.EXAMS, Storage.DEFAULTS.exams || []);
        exams.push({
          id: 'exam_' + Storage.generateId(),
          ...data,
          createdAt: new Date().toISOString()
        });
        Storage.saveData(Storage.KEYS.EXAMS, exams);
        App.closeModal();
        renderExams();
      }
    };

    modal.querySelector('[data-action="cancel"]').onclick = () => App.closeModal();
    App.openModal(modal);
  }

  async function deleteExam(id) {
    if (await App.confirm({ title: 'Remove Exam?', message: 'This countdown will be permanently removed.', confirmText: 'Remove', danger: true })) {
      const exams = Storage.loadData(Storage.KEYS.EXAMS, Storage.DEFAULTS.exams || []);
      Storage.saveData(Storage.KEYS.EXAMS, exams.filter(e => e.id !== id));
      renderExams();
    }
  }

  function enterBattlePrep(examId) {
    const exams = Storage.loadData(Storage.KEYS.EXAMS, []);
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;

    // Implementation of Battle Prep mode
    // (Essentially a specialized Pomodoro session)
    const overlay = document.createElement('div');
    overlay.className = 'battle-prep-overlay animate-fade-in';
    overlay.innerHTML = `
      <button class="ambient-close" style="top: 2rem; right: 2rem; position: absolute; background: none; border: none; color: white; cursor: pointer;" onclick="this.parentElement.remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
      </button>
      <div class="battle-title">BATTLE PREP: ${App.escapeHtml(exam.title)}</div>
      <div class="battle-timer" id="battle-timer">25:00</div>
      <div style="margin-top: 2rem;">
        <button class="btn btn-primary" id="start-battle" style="background: #ef4444; border-color: #ef4444; padding: 1rem 3rem; font-size: 1.25rem; font-weight: 800;">ENGAGE</button>
      </div>
    `;

    document.body.appendChild(overlay);

    let battleTime = 25 * 60;
    let battleInterval = null;

    const startBtn = overlay.querySelector('#start-battle');
    startBtn.onclick = () => {
      if (battleInterval) {
        clearInterval(battleInterval);
        battleInterval = null;
        startBtn.textContent = 'RESUME';
      } else {
        startBtn.textContent = 'PAUSE';
        battleInterval = setInterval(() => {
          battleTime--;
          const mins = Math.floor(battleTime / 60).toString().padStart(2, '0');
          const secs = (battleTime % 60).toString().padStart(2, '0');
          overlay.querySelector('#battle-timer').textContent = `${mins}:${secs}`;
          if (battleTime <= 0) {
            clearInterval(battleInterval);
            App.showToast('Battle Prep Complete!', 'success');
          }
        }, 1000);
      }
    };
  }

  return { init, enterBattlePrep };
})();

window.Exams = Exams;
