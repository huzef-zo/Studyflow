/**
 * StudyFlow - Spaced Repetition System (SRS) Module
 * Implements SM-2 algorithm and deck management
 */

const Flashcards = (function() {
  'use strict';

  let elements = {};
  let currentDeck = null;
  let dueCards = [];
  let currentIndex = 0;
  let sessionLogs = [];

  function initElements() {
    elements = {
      deckView: document.getElementById('deck-view'),
      studyView: document.getElementById('study-view'),
      summaryView: document.getElementById('summary-view'),
      deckList: document.getElementById('deck-list'),
      currentCard: document.getElementById('current-card'),
      cardFront: document.getElementById('card-front-text'),
      cardBack: document.getElementById('card-back-text'),
      ratingControls: document.getElementById('rating-controls'),
      flipHint: document.getElementById('flip-hint'),
      progressText: document.getElementById('study-progress-text'),
      progressBar: document.getElementById('study-progress-bar'),
      viewTitle: document.getElementById('view-title'),
      viewSubtitle: document.getElementById('view-subtitle'),
      addCardBtn: document.getElementById('add-card-btn'),
      exitStudyBtn: document.getElementById('exit-study-btn'),
      finishSummaryBtn: document.getElementById('finish-summary-btn'),
      summaryReviewed: document.getElementById('summary-reviewed'),
      summaryEase: document.getElementById('summary-ease'),
      summaryXP: document.getElementById('summary-xp')
    };
  }

  function init() {
    initElements();
    setupEventListeners();
    renderDecks();
  }

  function setupEventListeners() {
    elements.addCardBtn?.addEventListener('click', openAddCardModal);
    elements.exitStudyBtn?.addEventListener('click', exitStudy);
    elements.finishSummaryBtn?.addEventListener('click', () => {
      elements.summaryView.style.display = 'none';
      elements.deckView.style.display = 'block';
      elements.viewTitle.textContent = 'Knowledge Decks';
      elements.viewSubtitle.textContent = 'Spaced repetition for long-term retention';
      renderDecks();
    });

    elements.currentCard?.addEventListener('click', flipCard);

    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rating = parseInt(btn.dataset.rating);
        handleRating(rating);
      });
    });

    // Keyboard shortcuts for study mode
    document.addEventListener('keydown', (e) => {
      if (elements.studyView.style.display === 'block') {
        if (e.code === 'Space' || e.code === 'Enter') {
          if (!elements.currentCard.classList.contains('flipped')) {
            flipCard();
          }
        } else if (elements.currentCard.classList.contains('flipped')) {
          if (e.key === '1') handleRating(0);
          else if (e.key === '2') handleRating(1);
          else if (e.key === '3') handleRating(2);
          else if (e.key === '4') handleRating(3);
        }
      }
    });
  }

  // ── Deck Management ─────────────────────────────────────────────────────────

  function renderDecks() {
    const subjects = Storage.getSubjects();
    const allCards = Storage.getFlashcards();
    const today = Storage.formatDate(new Date());

    if (subjects.length === 0) {
      elements.deckList.innerHTML = App.createEmptyStateHtml({
        title: 'No Subjects',
        text: 'Define subjects in Settings to create flashcard decks.',
        icon: 'settings'
      });
      return;
    }

    elements.deckList.innerHTML = subjects.map(subject => {
      const deck = Storage.getDeckBySubject(subject.id);
      const deckCards = allCards.filter(c => c.deckId === deck.id);
      const dueCount = deckCards.filter(c => c.nextReview <= today).length;
      const mastery = deckCards.length > 0
        ? Math.round((deckCards.filter(c => c.repetitions > 2).length / deckCards.length) * 100)
        : 0;

      return `
        <div class="card deck-card animate-fade-in" onclick="Flashcards.startStudy('${deck.id}')">
          <div class="flex items-center justify-between mb-md">
            <div class="subject-pill" style="--tag-color:${App.hexToRgb(subject.color)};color:white;background:rgba(255,255,255,0.05);">${App.escapeHtml(subject.name)}</div>
            ${dueCount > 0 ? `<span class="badge" style="background:var(--danger-glow);color:var(--danger);">${dueCount} DUE</span>` : ''}
          </div>
          <div style="font-size: 1.25rem; font-weight: 800; color: white; margin-bottom: 4px;">${deckCards.length} Cards</div>
          <div class="flex items-center justify-between mt-md">
            <div style="font-size: 0.75rem; color: var(--text-muted);">Mastery: ${mastery}%</div>
            <div class="progress-bar-bg" style="width: 60%; height: 6px;">
              <div class="progress-bar-fill" style="width: ${mastery}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Study Mode ─────────────────────────────────────────────────────────────

  function startStudy(deckId) {
    const allCards = Storage.getFlashcards();
    const today = Storage.formatDate(new Date());
    dueCards = allCards.filter(c => c.deckId === deckId && c.nextReview <= today);

    if (dueCards.length === 0) {
      App.showToast('No cards due for review in this deck!', 'info');
      return;
    }

    // Shuffle due cards
    dueCards.sort(() => Math.random() - 0.5);

    currentDeck = deckId;
    currentIndex = 0;
    sessionLogs = [];

    elements.deckView.style.display = 'none';
    elements.studyView.style.display = 'block';
    elements.viewTitle.textContent = 'Study Session';
    elements.viewSubtitle.textContent = 'Recall and rate your knowledge';

    showCard();
  }

  function showCard() {
    const card = dueCards[currentIndex];
    elements.cardFront.textContent = card.front;
    elements.cardBack.textContent = card.back;

    elements.currentCard.classList.remove('flipped');
    elements.ratingControls.style.display = 'none';
    elements.flipHint.style.display = 'block';

    const progress = Math.round((currentIndex / dueCards.length) * 100);
    elements.progressBar.style.width = `${progress}%`;
    elements.progressText.textContent = `Card ${currentIndex + 1} of ${dueCards.length}`;
  }

  function flipCard() {
    elements.currentCard.classList.add('flipped');
    elements.ratingControls.style.display = 'grid';
    elements.flipHint.style.display = 'none';
  }

  function handleRating(rating) {
    const card = dueCards[currentIndex];
    const updatedCard = sm2(card, rating);

    Storage.updateFlashcard(card.id, updatedCard);
    Storage.addReviewLog(card.id, rating);

    sessionLogs.push({ cardId: card.id, rating, ease: updatedCard.easeFactor });

    currentIndex++;
    if (currentIndex < dueCards.length) {
      showCard();
    } else {
      showSummary();
    }
  }

  function sm2(card, rating) {
    // rating: 0=Again, 1=Hard, 2=Good, 3=Easy
    let { easeFactor, interval, repetitions } = card;

    if (rating < 2) { // Failed recall
      repetitions = 0;
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else { // Successful recall
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
      // easeFactor change: 0=Again, 1=Hard, 2=Good, 3=Easy
      // Map to: Hard=-0.15, Good=0, Easy=+0.15
      const adjustment = [0, -0.15, 0, 0.15][rating];
      easeFactor = Math.max(1.3, easeFactor + adjustment);
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
      ...card,
      easeFactor,
      interval,
      repetitions,
      nextReview: Storage.formatDate(nextReviewDate)
    };
  }

  function showSummary() {
    elements.studyView.style.display = 'none';
    elements.summaryView.style.display = 'block';

    const avgEase = sessionLogs.length > 0
      ? (sessionLogs.reduce((acc, log) => acc + log.ease, 0) / sessionLogs.length).toFixed(2)
      : 0;

    const xpGained = sessionLogs.length * 5;

    elements.summaryReviewed.textContent = sessionLogs.length;
    elements.summaryEase.textContent = avgEase;
    elements.summaryXP.textContent = xpGained;

    // Award XP (logic will be added when Achievement system is ready)
    // For now just toast
    App.showToast(`Session complete! Gained ${xpGained} XP`, 'success');
  }

  function exitStudy() {
    App.confirm({
      title: 'Exit Session?',
      message: 'Your progress on current card won\'t be saved.',
      confirmText: 'Exit'
    }).then(confirmed => {
      if (confirmed) {
        elements.studyView.style.display = 'none';
        elements.deckView.style.display = 'block';
        elements.viewTitle.textContent = 'Knowledge Decks';
        elements.viewSubtitle.textContent = 'Spaced repetition for long-term retention';
        renderDecks();
      }
    });
  }

  // ── Add Card Modal ──────────────────────────────────────────────────────────

  function openAddCardModal() {
    const subjects = Storage.getSubjects();
    const decks = subjects.map(s => Storage.getDeckBySubject(s.id));

    const content = `
      <form id="add-card-form">
        <div class="form-group">
          <label class="form-label">Subject Deck</label>
          <select name="deckId" class="form-input">
            ${subjects.map((s, i) => `<option value="${decks[i].id}">${App.escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Front (Question)</label>
          <textarea name="front" class="form-input" placeholder="Enter question..." required style="height: 100px;"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Back (Answer)</label>
          <textarea name="back" class="form-input" placeholder="Enter answer..." required style="height: 100px;"></textarea>
        </div>
      </form>
    `;

    const modal = App.createModal({
      title: 'Create Flashcard',
      content,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" id="save-card">Save Card</button>
      `
    });

    modal.querySelector('#save-card').onclick = () => {
      const form = modal.querySelector('#add-card-form');
      const data = App.getFormData(form);
      if (data.front && data.back) {
        Storage.addFlashcard(data);
        App.closeModal();
        App.showToast('Card added!', 'success');
        renderDecks();
      }
    };

    modal.querySelector('[data-action="cancel"]').onclick = () => App.closeModal();
    App.openModal(modal);
  }

  return { init, startStudy };
})();

window.Flashcards = Flashcards;
