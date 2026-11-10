/**
 * StudyFlow - GPA Module
 * Comprehensive semester and cumulative GPA calculation, component tracking, and what-if analysis.
 */

const Gpa = (function() {
  'use strict';

  let elements = {};
  let selectedSemester = 'all'; // 'all' or semester string
  let includeProjected = false;

  function initElements() {
    elements = {
      cgpaStatValue: document.getElementById('cgpa-stat-value'),
      cgpaStatStanding: document.getElementById('cgpa-stat-standing'),
      semesterGpaStatValue: document.getElementById('semester-gpa-stat-value'),
      semesterGpaStatLabel: document.getElementById('semester-gpa-stat-label'),
      creditsStatValue: document.getElementById('credits-stat-value'),
      coursesCountLabel: document.getElementById('courses-count-label'),
      standingLetterValue: document.getElementById('standing-letter-value'),
      standingLabelDesc: document.getElementById('standing-label-desc'),
      toggleProjectedBtn: document.getElementById('toggle-projected-btn'),
      toggleProjectedDot: document.getElementById('toggle-projected-dot'),
      editTargetGpaBtn: document.getElementById('edit-target-gpa-btn'),
      targetGpaBadge: document.getElementById('target-gpa-badge'),
      targetGpaProgressText: document.getElementById('target-gpa-progress-text'),
      targetGpaProgressFill: document.getElementById('target-gpa-progress-fill'),
      semesterTabsContainer: document.getElementById('semester-tabs-container'),
      coursesListContainer: document.getElementById('courses-list-container'),
      addCourseBtn: document.getElementById('add-course-btn')
    };
  }

  function getAvailableSemesters(courses) {
    const list = [];
    if (!Array.isArray(courses)) return list;
    courses.forEach(c => {
      const s = (c.semester && typeof c.semester === 'string' && c.semester.trim()) ? c.semester.trim() : 'Unassigned';
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }

  function renderSemesterTabs() {
    if (!elements.semesterTabsContainer) return;
    const courses = Storage.getCourses ? Storage.getCourses() : [];
    const semesters = getAvailableSemesters(courses);

    if (selectedSemester !== 'all' && !semesters.includes(selectedSemester) && semesters.length > 0) {
      selectedSemester = semesters[0];
    } else if (semesters.length === 0) {
      selectedSemester = 'all';
    }

    const tabs = [{ id: 'all', label: 'All Semesters' }, ...semesters.map(s => ({ id: s, label: s }))];

    elements.semesterTabsContainer.innerHTML = tabs.map(tab => {
      const isActive = selectedSemester === tab.id;
      return `
        <button
          type="button"
          role="tab"
          aria-selected="${isActive}"
          data-semester="${App.escapeHtml(tab.id)}"
          class="semester-tab px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-all flex-shrink-0 ${
            isActive
              ? 'bg-primary-container text-surface-base font-semibold shadow-sm'
              : 'bg-surface-glass text-text-secondary hover:text-text-primary hover:bg-surface-container-high'
          }">
          ${App.escapeHtml(tab.label)}
        </button>
      `;
    }).join('');

    const tabButtons = elements.semesterTabsContainer.querySelectorAll('.semester-tab');
    tabButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        selectedSemester = btn.getAttribute('data-semester');
        render();
      });

      // Keyboard accessibility (Left/Right arrows)
      btn.addEventListener('keydown', (e) => {
        let targetIndex = null;
        if (e.key === 'ArrowRight') {
          targetIndex = (index + 1) % tabButtons.length;
        } else if (e.key === 'ArrowLeft') {
          targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
        }
        if (targetIndex !== null) {
          e.preventDefault();
          tabButtons[targetIndex].focus();
          tabButtons[targetIndex].click();
        }
      });
    });
  }

  function renderSummary() {
    const courses = Storage.getCourses ? Storage.getCourses() : [];
    const goals = Storage.getGoals ? Storage.getGoals() : {};
    const targetGpa = Number.isFinite(Number(goals.target_gpa)) ? Number(goals.target_gpa) : 3.50;

    // Cumulative GPA
    const cgpaResult = GpaUtils.cgpa(courses, { includeProjected });
    const cgpaVal = cgpaResult.gpa;
    const cgpaGrade = GpaUtils.rawToGrade((cgpaVal / 4.0) * 100);

    if (elements.cgpaStatValue) {
      elements.cgpaStatValue.textContent = cgpaResult.totalCredits > 0 ? cgpaVal.toFixed(2) : '0.00';
    }
    if (elements.cgpaStatStanding) {
      elements.cgpaStatStanding.textContent = cgpaResult.totalCredits > 0
        ? `Standing: ${cgpaGrade.letter} (${cgpaGrade.label})`
        : 'Standing: N/A';
    }
    if (elements.creditsStatValue) {
      elements.creditsStatValue.textContent = cgpaResult.totalCredits;
    }
    if (elements.coursesCountLabel) {
      elements.coursesCountLabel.textContent = `${cgpaResult.countedCourses} courses counted`;
    }
    if (elements.standingLetterValue) {
      elements.standingLetterValue.textContent = cgpaResult.totalCredits > 0 ? cgpaGrade.letter : 'N/A';
    }
    if (elements.standingLabelDesc) {
      elements.standingLabelDesc.textContent = cgpaResult.totalCredits > 0 ? cgpaGrade.label : 'Cumulative tier';
    }

    // Active/Selected Semester GPA
    const semesters = getAvailableSemesters(courses);
    let activeSemLabel = selectedSemester !== 'all' ? selectedSemester : (semesters[0] || 'Active semester');
    let semCourses = courses;
    if (selectedSemester !== 'all') {
      semCourses = courses.filter(c => (c.semester || 'Unassigned') === selectedSemester);
    } else if (semesters.length > 0) {
      semCourses = courses.filter(c => (c.semester || 'Unassigned') === semesters[0]);
    }

    const semResult = GpaUtils.semesterGpa(semCourses, { includeProjected });
    if (elements.semesterGpaStatValue) {
      elements.semesterGpaStatValue.textContent = semResult.totalCredits > 0 ? semResult.gpa.toFixed(2) : '0.00';
    }
    if (elements.semesterGpaStatLabel) {
      elements.semesterGpaStatLabel.textContent = App.escapeHtml(activeSemLabel);
    }

    // Target CGPA Progress
    if (elements.targetGpaBadge) {
      elements.targetGpaBadge.textContent = targetGpa.toFixed(2);
    }
    if (elements.targetGpaProgressText) {
      elements.targetGpaProgressText.textContent = `${cgpaVal.toFixed(2)} / ${targetGpa.toFixed(2)}`;
    }
    if (elements.targetGpaProgressFill) {
      const pct = targetGpa > 0 ? Math.min(100, Math.max(0, (cgpaVal / targetGpa) * 100)) : 0;
      elements.targetGpaProgressFill.style.width = `${pct}%`;
    }
  }

  function renderCoursesList() {
    if (!elements.coursesListContainer) return;
    const courses = Storage.getCourses ? Storage.getCourses() : [];

    let displayCourses = courses;
    if (selectedSemester !== 'all') {
      displayCourses = courses.filter(c => (c.semester || 'Unassigned') === selectedSemester);
    }

    if (displayCourses.length === 0) {
      elements.coursesListContainer.innerHTML = App.createEmptyStateHtml({
        icon: 'school',
        title: 'No courses found',
        text: selectedSemester === 'all'
          ? 'Add your first university course to start tracking grades, GPA, and what-if targets.'
          : `No courses recorded for semester "${App.escapeHtml(selectedSemester)}".`,
        actionText: '+ Add Course',
        actionId: 'empty-add-course-btn'
      });
      const emptyBtn = elements.coursesListContainer.querySelector('#empty-add-course-btn');
      if (emptyBtn) {
        emptyBtn.onclick = () => openCourseModal(null);
      }
      return;
    }

    const goals = Storage.getGoals ? Storage.getGoals() : {};
    const targetGpa = Number.isFinite(Number(goals.target_gpa)) ? Number(goals.target_gpa) : 3.50;
    const targetGrade = GpaUtils.rawToGrade((targetGpa / 4.0) * 100);

    // Calculate semester focus hours cutoff (e.g. past 120 days or all)
    const semesterCutoff = new Date();
    semesterCutoff.setDate(semesterCutoff.getDate() - 120);
    const semesterCutoffIso = semesterCutoff.toISOString().slice(0, 10);

    elements.coursesListContainer.innerHTML = displayCourses.map(course => {
      const status = GpaUtils.courseStatus(course);
      const isComplete = status.isComplete || course.finalized;
      const components = Array.isArray(course.components) ? course.components : [];

      let focusHours = 0;
      if (course.subject && Storage.getFocusMinutesBySubject) {
        const mins = Storage.getFocusMinutesBySubject(semesterCutoffIso, course.subject);
        focusHours = (mins / 60).toFixed(1);
      }

      // What do I need table for in-progress courses
      let whatDoINeedHtml = '';
      if (!isComplete && status.ungradedMax > 0) {
        const targetMarks = [
          { label: 'A (4.0)', mark: 93, letter: 'A' },
          { label: 'A- (3.7)', mark: 90, letter: 'A-' },
          { label: 'B+ (3.3)', mark: 87, letter: 'B+' },
          { label: 'B (3.0)', mark: 83, letter: 'B' },
          { label: 'B- (2.7)', mark: 80, letter: 'B-' },
          { label: 'C+ (2.3)', mark: 77, letter: 'C+' },
          { label: 'C (2.0)', mark: 73, letter: 'C' }
        ];

        whatDoINeedHtml = `
          <div class="mt-3 pt-3 border-t border-glass-border">
            <div class="flex items-center justify-between mb-2">
              <span class="font-label-sm text-[11px] font-semibold text-text-primary uppercase tracking-wider">What Do I Need?</span>
              <span class="font-label-sm text-[11px] text-text-secondary">${status.ungradedMax} pts remaining</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              ${targetMarks.map(tm => {
                const req = GpaUtils.requiredOnRemaining(course, tm.mark);
                const isTargetMatch = tm.letter === targetGrade.letter;
                let text = '';
                let bgClass = 'bg-surface-container-lowest/60 text-text-secondary';
                if (req.status === 'secured') {
                  text = 'Secured';
                  bgClass = 'bg-primary-container/20 text-primary-container font-semibold';
                } else if (req.status === 'unreachable') {
                  text = 'Not reachable';
                  bgClass = 'bg-surface-container-lowest/40 text-text-muted';
                } else {
                  text = `${req.pointsNeeded} pts (${req.percentNeeded}%)`;
                  if (isTargetMatch) {
                    bgClass = 'bg-primary-container/15 text-primary-container border border-primary-container/40 font-semibold';
                  }
                }
                return `
                  <div class="p-1.5 rounded-lg ${bgClass} flex flex-col text-center">
                    <span class="font-label-sm text-[10px] uppercase">${App.escapeHtml(tm.label)}</span>
                    <span class="font-label-sm text-label-sm mt-0.5 truncate">${App.escapeHtml(text)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      const progressPct = Math.min(100, Math.round(status.currentMark));

      return `
        <div class="w-full bg-surface-glass backdrop-blur-xl rounded-lg p-space-md shadow-sm border border-glass-border flex flex-col gap-3 transition-all course-card" data-course-id="${App.escapeHtml(course.id)}">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col min-w-0 cursor-pointer edit-course-trigger" data-course-id="${App.escapeHtml(course.id)}">
              <div class="flex items-center gap-2">
                <h3 class="font-headline-sm text-headline-sm font-bold text-text-primary hover:text-primary-container transition-colors truncate">
                  ${App.escapeHtml(course.name)}
                </h3>
                ${course.finalized ? '<span class="px-2 py-0.5 text-[10px] font-label-sm rounded-full bg-primary-container/20 text-primary-container font-semibold">Finalized</span>' : ''}
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-text-secondary font-label-sm text-[11px] flex-wrap">
                <span>${course.creditHours} credits</span>
                <span>·</span>
                <span>${App.escapeHtml(course.semester || 'Unassigned')}</span>
                ${course.subject ? `<span>·</span><span class="text-primary-container">${App.escapeHtml(course.subject)}</span>` : ''}
                ${course.subject ? `<span>·</span><span>${focusHours}h focus</span>` : ''}
              </div>
            </div>

            <!-- Grade Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <div class="flex flex-col items-end">
                <div class="flex items-baseline gap-1">
                  <span class="font-display-lg text-[22px] font-bold text-text-primary leading-none">${status.grade.letter}</span>
                  <span class="font-label-sm text-[12px] text-text-secondary">(${status.grade.gp.toFixed(2)})</span>
                </div>
                <span class="font-label-sm text-[10px] ${status.grade.isProjected ? 'text-text-muted' : 'text-primary-container'}">
                  ${status.grade.isProjected ? 'Projected' : 'Complete'}
                </span>
              </div>
              <button type="button" aria-label="Edit course ${App.escapeHtml(course.name)}" class="w-8 h-8 rounded-full bg-surface-container-high/80 hover:bg-surface-bright flex items-center justify-center text-text-secondary hover:text-text-primary transition-all edit-course-btn" data-course-id="${App.escapeHtml(course.id)}">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
          </div>

          <!-- Graded Progress Bar -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between font-label-sm text-[11px] text-text-secondary">
              <span>Points Earned: <strong class="text-text-primary">${Math.round(status.earned * 10) / 10}</strong> / 100</span>
              <span>Graded: ${status.gradedMax}/100</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <div class="h-full bg-primary-container rounded-full transition-all duration-300" style="width: ${progressPct}%;"></div>
            </div>
          </div>

          <!-- Components Scores Input Row -->
          <div class="flex flex-col gap-1.5 pt-1">
            <span class="font-label-sm text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Assessment Components</span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              ${components.map(cmp => {
                const isGraded = cmp.earned !== null && cmp.earned !== undefined;
                return `
                  <div class="flex items-center justify-between p-2 rounded-xl bg-surface-container-lowest/60 border border-glass-border-subtle">
                    <div class="flex flex-col min-w-0 pr-2">
                      <span class="font-label-sm text-label-sm text-text-primary font-medium truncate" title="${App.escapeHtml(cmp.name)}">${App.escapeHtml(cmp.name)}</span>
                      <span class="font-label-sm text-[10px] text-text-muted">Max ${cmp.max} pts</span>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="${cmp.max}"
                        step="0.5"
                        placeholder="--"
                        value="${isGraded ? cmp.earned : ''}"
                        aria-label="Score for ${App.escapeHtml(cmp.name)} in ${App.escapeHtml(course.name)}"
                        data-course-id="${App.escapeHtml(course.id)}"
                        data-component-id="${App.escapeHtml(cmp.id)}"
                        class="w-14 px-1.5 py-1 text-center bg-surface-container-high rounded-lg text-text-primary font-mono-timer text-body-sm outline-none border border-glass-border focus:border-primary-container component-score-input"
                      />
                      <span class="font-label-sm text-[11px] text-text-muted">/${cmp.max}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- What-If Section -->
          ${whatDoINeedHtml}
        </div>
      `;
    }).join('');

    // Attach inline score listeners
    elements.coursesListContainer.querySelectorAll('.component-score-input').forEach(input => {
      input.addEventListener('change', () => {
        const courseId = input.getAttribute('data-course-id');
        const componentId = input.getAttribute('data-component-id');
        const val = input.value.trim() === '' ? null : Number(input.value);

        const oldCourses = Storage.getCourses ? Storage.getCourses() : [];
        const oldCourse = oldCourses.find(c => c.id === courseId);
        const oldStatus = oldCourse ? GpaUtils.courseStatus(oldCourse) : null;
        const oldGp = oldStatus ? oldStatus.grade.gp : null;

        const updated = Storage.setComponentScore(courseId, componentId, val);
        if (updated) {
          // Check XP and Badges
          if (typeof Achievements !== 'undefined' && Achievements.awardGpaXP) {
            Achievements.awardGpaXP(updated, oldGp);
          }
          render();
        }
      });
    });

    // Attach edit triggers
    elements.coursesListContainer.querySelectorAll('.edit-course-trigger, .edit-course-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = btn.getAttribute('data-course-id');
        const c = (Storage.getCourses ? Storage.getCourses() : []).find(item => item.id === cId);
        if (c) openCourseModal(c);
      });
    });
  }

  function openCourseModal(existingCourse) {
    const isEdit = Boolean(existingCourse);
    const subjects = Storage.getSubjects ? Storage.getSubjects() : [];
    const availableSemesters = getAvailableSemesters(Storage.getCourses ? Storage.getCourses() : []);

    const name = existingCourse ? existingCourse.name : '';
    const credits = existingCourse ? existingCourse.creditHours : 3;
    const semester = existingCourse ? (existingCourse.semester || '') : (selectedSemester !== 'all' ? selectedSemester : 'Year 1 - Sem 1');
    const subject = existingCourse ? (existingCourse.subject || '') : '';
    const finalized = existingCourse ? Boolean(existingCourse.finalized) : false;

    let components = existingCourse && Array.isArray(existingCourse.components)
      ? existingCourse.components.map(c => ({ ...c }))
      : [
          { id: Storage.generateId ? Storage.generateId() : 'cmp_1', name: 'Mid Exam', max: 30, earned: null },
          { id: Storage.generateId ? Storage.generateId() : 'cmp_2', name: 'Final Exam', max: 60, earned: null },
          { id: Storage.generateId ? Storage.generateId() : 'cmp_3', name: 'Class Assessment', max: 10, earned: null }
        ];

    const content = `
      <form id="course-form" class="flex flex-col gap-3.5 select-none">
        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="course-name-input">Course Name</label>
          <input
            id="course-name-input"
            type="text"
            required
            maxlength="200"
            placeholder="e.g. Data Structures & Algorithms"
            value="${App.escapeHtml(name)}"
            class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="flex flex-col gap-1">
            <label class="font-label-sm text-label-sm text-text-secondary" for="course-credits-input">Credit Hours</label>
            <input
              id="course-credits-input"
              type="number"
              min="0.5"
              max="12"
              step="0.5"
              value="${credits}"
              required
              class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-label-sm text-label-sm text-text-secondary" for="course-semester-input">Semester</label>
            <input
              id="course-semester-input"
              type="text"
              list="semester-options"
              maxlength="100"
              placeholder="e.g. Year 1 - Sem 1"
              value="${App.escapeHtml(semester)}"
              required
              class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container"
            />
            <datalist id="semester-options">
              ${availableSemesters.map(s => `<option value="${App.escapeHtml(s)}">`).join('')}
            </datalist>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-label-sm text-label-sm text-text-secondary" for="course-subject-select">Link Subject (for Focus Time tracking)</label>
          <select
            id="course-subject-select"
            class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container cursor-pointer"
          >
            <option value="">No linked subject</option>
            ${subjects.map(s => `
              <option value="${App.escapeHtml(s.name)}" ${s.name === subject ? 'selected' : ''}>
                ${App.escapeHtml(s.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest/60 border border-glass-border">
          <div class="flex flex-col">
            <span class="font-label-sm text-label-sm text-text-primary font-semibold">Course Finalized</span>
            <span class="font-label-sm text-[11px] text-text-secondary">Mark final grade as recorded</span>
          </div>
          <input
            type="checkbox"
            id="course-finalized-checkbox"
            ${finalized ? 'checked' : ''}
            class="w-5 h-5 rounded accent-primary-container cursor-pointer"
          />
        </div>

        <!-- Dynamic Components Section -->
        <div class="flex flex-col gap-2 pt-2 border-t border-glass-border">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-label-sm text-label-sm text-text-primary font-semibold">Assessment Components</span>
              <span class="font-label-sm text-[11px] px-2 py-0.5 rounded-full font-bold" id="modal-components-total-badge">
                Total: 100 / 100
              </span>
            </div>
            <button type="button" id="add-component-row-btn" class="flex items-center gap-1 text-primary-container hover:text-accent-hover font-label-sm text-[12px] font-semibold">
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>Add</span>
            </button>
          </div>

          <div class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1" id="modal-components-list">
            <!-- Populated dynamically -->
          </div>
        </div>
      </form>
    `;

    const footer = `
      <div class="flex items-center justify-between w-full">
        ${isEdit ? '<button type="button" class="px-4 py-2 rounded-full font-label-md text-error hover:bg-error/10 transition-colors" data-action="delete">Delete Course</button>' : '<div></div>'}
        <div class="flex items-center gap-2">
          <button type="button" class="px-4 py-2 rounded-full font-label-md text-text-secondary hover:text-text-primary transition-colors" data-action="cancel">Cancel</button>
          <button type="button" class="px-5 py-2 rounded-full font-label-md bg-primary-container text-surface-base font-semibold hover:bg-accent-hover transition-colors" data-action="save">${isEdit ? 'Save Changes' : 'Create Course'}</button>
        </div>
      </div>
    `;

    const modal = App.createModal({
      id: 'course-editor-modal',
      title: isEdit ? 'Edit Course' : 'Add Course',
      content,
      footer
    });

    const componentsList = modal.querySelector('#modal-components-list');
    const totalBadge = modal.querySelector('#modal-components-total-badge');

    function updateRunningTotal() {
      const rows = componentsList.querySelectorAll('.component-row');
      let sum = 0;
      rows.forEach(r => {
        const maxInput = r.querySelector('.component-max-input');
        const v = maxInput ? Number(maxInput.value) : 0;
        if (Number.isFinite(v)) sum += v;
      });

      if (totalBadge) {
        totalBadge.textContent = `Total: ${sum} / 100`;
        if (sum === 100) {
          totalBadge.className = 'font-label-sm text-[11px] px-2 py-0.5 rounded-full font-bold bg-primary-container/20 text-primary-container';
        } else {
          totalBadge.className = 'font-label-sm text-[11px] px-2 py-0.5 rounded-full font-bold bg-error-container/30 text-error';
        }
      }
      return sum;
    }

    function renderComponentRows() {
      componentsList.innerHTML = components.map((cmp, idx) => `
        <div class="flex items-center gap-2 p-2 rounded-xl bg-surface-container-lowest/80 component-row" data-cmp-id="${App.escapeHtml(cmp.id || '')}">
          <input
            type="text"
            required
            maxlength="100"
            placeholder="Component name"
            value="${App.escapeHtml(cmp.name || '')}"
            class="flex-1 bg-transparent text-text-primary text-body-sm outline-none component-name-input"
          />
          <div class="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min="1"
              max="100"
              required
              value="${cmp.max}"
              placeholder="Max"
              class="w-14 px-1.5 py-1 text-center bg-surface-container-high rounded text-text-primary text-body-sm outline-none border border-glass-border component-max-input"
            />
            <span class="font-label-sm text-[11px] text-text-muted">pts</span>
          </div>
          <button type="button" aria-label="Remove component" class="p-1 text-text-muted hover:text-error transition-colors remove-cmp-btn">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      `).join('');

      componentsList.querySelectorAll('.component-max-input').forEach(input => {
        input.addEventListener('input', updateRunningTotal);
      });

      componentsList.querySelectorAll('.remove-cmp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.component-row');
          if (row) {
            row.remove();
            updateRunningTotal();
          }
        });
      });

      updateRunningTotal();
    }

    renderComponentRows();

    const addRowBtn = modal.querySelector('#add-component-row-btn');
    if (addRowBtn) {
      addRowBtn.addEventListener('click', () => {
        components.push({
          id: Storage.generateId ? Storage.generateId() : 'cmp_' + Date.now(),
          name: '',
          max: 10,
          earned: null
        });
        renderComponentRows();
        const inputs = componentsList.querySelectorAll('.component-name-input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
      });
    }

    // Save action
    const saveBtn = modal.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const nameInput = modal.querySelector('#course-name-input');
        const creditsInput = modal.querySelector('#course-credits-input');
        const semesterInput = modal.querySelector('#course-semester-input');
        const subjectSelect = modal.querySelector('#course-subject-select');
        const finalizedBox = modal.querySelector('#course-finalized-checkbox');

        const courseName = nameInput ? nameInput.value.trim() : '';
        if (!courseName) {
          App.showToast('Please enter a course name', 'warning');
          if (nameInput) nameInput.focus();
          return;
        }

        const creditHours = creditsInput ? Number(creditsInput.value) : 3;
        if (!Number.isFinite(creditHours) || creditHours < 0.5 || creditHours > 12) {
          App.showToast('Credit hours must be between 0.5 and 12', 'warning');
          if (creditsInput) creditsInput.focus();
          return;
        }

        const courseSemester = semesterInput ? semesterInput.value.trim() : '';
        if (!courseSemester) {
          App.showToast('Please enter a semester', 'warning');
          if (semesterInput) semesterInput.focus();
          return;
        }

        // Validate components sum
        const rows = componentsList.querySelectorAll('.component-row');
        if (rows.length === 0) {
          App.showToast('Course must have at least one assessment component', 'warning');
          return;
        }

        let totalMax = 0;
        const updatedComponents = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const cmpId = row.getAttribute('data-cmp-id') || Storage.generateId();
          const nameVal = row.querySelector('.component-name-input')?.value.trim() || 'Component';
          const maxVal = Number(row.querySelector('.component-max-input')?.value);

          if (!Number.isFinite(maxVal) || maxVal <= 0) {
            App.showToast('Each component max points must be greater than 0', 'warning');
            return;
          }

          totalMax += maxVal;

          // Preserve earned score if exists
          const oldCmp = existingCourse?.components?.find(c => c.id === cmpId);
          const earned = oldCmp ? oldCmp.earned : null;

          updatedComponents.push({
            id: cmpId,
            name: nameVal,
            max: maxVal,
            earned: earned !== null ? Math.min(maxVal, earned) : null
          });
        }

        if (totalMax !== 100) {
          App.showToast(`Component weights must sum to exactly 100 (current total: ${totalMax})`, 'warning');
          return;
        }

        const courseData = {
          name: courseName,
          creditHours,
          semester: courseSemester,
          subject: subjectSelect ? subjectSelect.value : '',
          finalized: Boolean(finalizedBox && finalizedBox.checked),
          components: updatedComponents
        };

        if (isEdit) {
          const updated = Storage.updateCourse(existingCourse.id, courseData);
          if (updated && typeof Achievements !== 'undefined' && Achievements.awardGpaXP) {
            Achievements.awardGpaXP(updated, null);
          }
          App.showToast('Course updated!', 'success');
        } else {
          const created = Storage.addCourse(courseData);
          if (created && typeof Achievements !== 'undefined' && Achievements.awardGpaXP) {
            Achievements.awardGpaXP(created, null);
          }
          App.showToast('Course created!', 'success');
        }

        App.closeModal(modal);
        render();
      });
    }

    // Cancel action
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => App.closeModal(modal));
    }

    // Delete action
    const deleteBtn = modal.querySelector('[data-action="delete"]');
    if (deleteBtn && isEdit) {
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await App.confirm({
          title: 'Delete Course',
          message: `Are you sure you want to delete "${existingCourse.name}"? This cannot be undone.`,
          confirmText: 'Delete',
          danger: true
        });
        if (confirmed) {
          Storage.deleteCourse(existingCourse.id);
          App.showToast('Course deleted', 'info');
          App.closeModal(modal);
          render();
        }
      });
    }

    App.openModal(modal);
  }

  function openEditTargetGpaModal() {
    const goals = Storage.getGoals ? Storage.getGoals() : {};
    const currentTarget = Number.isFinite(Number(goals.target_gpa)) ? Number(goals.target_gpa) : 3.50;

    const content = `
      <form id="target-gpa-form" class="flex flex-col gap-3">
        <label class="font-label-sm text-label-sm text-text-secondary" for="modal-target-gpa-input">
          Target Cumulative GPA (0.00 – 4.00)
        </label>
        <input
          type="number"
          id="modal-target-gpa-input"
          min="0"
          max="4"
          step="0.05"
          required
          value="${currentTarget.toFixed(2)}"
          class="w-full bg-surface-container-lowest/80 rounded-xl px-3 py-2 text-text-primary text-body-md border border-glass-border outline-none focus:border-primary-container"
        />
        <p class="font-body-sm text-[11px] text-text-muted">
          Your target GPA highlights required assessment scores on in-progress courses.
        </p>
      </form>
    `;

    const footer = `
      <button type="button" class="px-4 py-2 rounded-full font-label-md text-text-secondary hover:text-text-primary transition-colors" data-action="cancel">Cancel</button>
      <button type="button" class="px-5 py-2 rounded-full font-label-md bg-primary-container text-surface-base font-semibold hover:bg-accent-hover transition-colors" data-action="save">Save Target</button>
    `;

    const modal = App.createModal({
      id: 'target-gpa-modal',
      title: 'Edit Target GPA',
      content,
      footer
    });

    const saveBtn = modal.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const input = modal.querySelector('#modal-target-gpa-input');
        const val = input ? parseFloat(input.value) : NaN;
        if (!Number.isFinite(val) || val < 0 || val > 4) {
          App.showToast('Target GPA must be between 0.00 and 4.00', 'warning');
          if (input) input.focus();
          return;
        }

        Storage.updateGoals({ target_gpa: val });
        App.showToast('Target GPA updated!', 'success');
        App.closeModal(modal);
        render();
      });
    }

    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => App.closeModal(modal));
    }

    App.openModal(modal);
  }

  function setupEventListeners() {
    if (elements.toggleProjectedBtn) {
      elements.toggleProjectedBtn.addEventListener('click', () => {
        includeProjected = !includeProjected;
        elements.toggleProjectedBtn.setAttribute('aria-checked', String(includeProjected));
        if (includeProjected) {
          elements.toggleProjectedBtn.className = 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-primary-container';
          if (elements.toggleProjectedDot) elements.toggleProjectedDot.className = 'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5';
        } else {
          elements.toggleProjectedBtn.className = 'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-surface-container-high';
          if (elements.toggleProjectedDot) elements.toggleProjectedDot.className = 'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0';
        }
        render();
      });
    }

    if (elements.editTargetGpaBtn) {
      elements.editTargetGpaBtn.addEventListener('click', openEditTargetGpaModal);
    }

    if (elements.addCourseBtn) {
      elements.addCourseBtn.addEventListener('click', () => openCourseModal(null));
    }

    window.addEventListener('studyflow_taskDataChanged', render);
  }

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add') {
      openCourseModal(null);
    }
  }

  function render() {
    renderSemesterTabs();
    renderSummary();
    renderCoursesList();
  }

  function init() {
    initElements();
    setupEventListeners();
    render();
    checkUrlParams();
  }

  return {
    init,
    render,
    openCourseModal,
    openEditTargetGpaModal
  };
})();

window.Gpa = Gpa;
