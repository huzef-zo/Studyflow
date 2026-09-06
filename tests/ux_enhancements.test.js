const fs = require('fs');
const path = require('path');

async function runTests() {
    console.log('Running Micro-UX Enhancement Tests...');

    // Test 1: Verify aria-label in tasks.html content (string check)
    (function testTasksAriaStrings() {
        const html = fs.readFileSync(path.join(__dirname, '../tasks.html'), 'utf8');

        if (!html.includes('aria-label="Search objectives"')) {
            throw new Error('Search input missing aria-label="Search objectives"');
        }
        if (!html.includes('aria-label="Filter by priority"')) {
            throw new Error('Priority filter missing aria-label="Filter by priority"');
        }
        if (!html.includes('aria-label="Filter by subject"')) {
            throw new Error('Subject filter missing aria-label="Filter by subject"');
        }

        console.log('  Passed: Tasks page ARIA labels verified in source.');
    })();

    // Test 2: App.createModal ARIA attributes logic (string check of the generator function)
    (function testModalLogic() {
        const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

        if (!appCode.includes('role="dialog"')) {
            throw new Error('App.createModal missing role="dialog" injection');
        }
        if (!appCode.includes('aria-modal="true"')) {
            throw new Error('App.createModal missing aria-modal="true" injection');
        }
        if (!appCode.includes('aria-labelledby="${escapeHtml(titleId)}"')) {
            throw new Error('App.createModal missing aria-labelledby injection');
        }
        if (!appCode.includes('id="${escapeHtml(titleId)}"')) {
            throw new Error('App.createModal missing id injection for title');
        }

        console.log('  Passed: Modal ARIA generation logic verified in source.');
    })();

    // Test 3: Tasks.init "action=add" logic
    (function testTasksActionAdd() {
        const tasksCode = fs.readFileSync(path.join(__dirname, '../js/tasks.js'), 'utf8');

        if (!tasksCode.includes("urlParams.get('action') === 'add'")) {
            throw new Error('Tasks.init missing check for action=add');
        }
        if (!tasksCode.includes("openTaskModal()")) {
            throw new Error('Tasks.init missing openTaskModal() trigger');
        }
        if (!tasksCode.includes("window.history.replaceState")) {
            throw new Error('Tasks.init missing URL cleanup logic');
        }

        console.log('  Passed: Task Manager "action=add" logic verified in source.');
    })();

    // Test 4: Verify form control accessibility (for attributes and aria-label attributes)
    (function testFormControlAccessibility() {
        const settingsHtml = fs.readFileSync(path.join(__dirname, '../settings.html'), 'utf8');
        const timerHtml = fs.readFileSync(path.join(__dirname, '../timer.html'), 'utf8');
        const notesHtml = fs.readFileSync(path.join(__dirname, '../notes.html'), 'utf8');
        const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

        // Settings label 'for' attributes
        ['theme-selector', 'display-name', 'user-email', 'work-duration', 'short-break', 'long-break', 'sessions-until-long-break'].forEach(id => {
            if (!settingsHtml.includes(`for="${id}"`)) {
                throw new Error(`settings.html missing for="${id}" on corresponding label`);
            }
        });

        // Timer label 'for' and aria-label attributes
        ['timer-task', 'timer-subtask'].forEach(id => {
            if (!timerHtml.includes(`for="${id}"`)) {
                throw new Error(`timer.html missing for="${id}" on corresponding label`);
            }
        });
        if (!timerHtml.includes('id="session-notes"') || !timerHtml.includes('aria-label="Session notes"')) {
            throw new Error('timer.html #session-notes missing aria-label="Session notes"');
        }

        // Notes aria-labels and icons
        if (!notesHtml.includes('id="new-note-btn"') || !notesHtml.includes('aria-label="Create new note entry"')) {
            throw new Error('notes.html #new-note-btn missing aria-label="Create new note entry"');
        }
        if (!notesHtml.includes('<svg xmlns="http://www.w3.org/2000/svg"') || !notesHtml.includes('line x1="12" x2="12" y1="5" y2="19"')) {
            throw new Error('notes.html #new-note-btn missing inline SVG plus icon');
        }
        if (!notesHtml.includes('id="note-title"') || !notesHtml.includes('aria-label="Note Title"')) {
            throw new Error('notes.html #note-title missing aria-label="Note Title"');
        }
        if (!notesHtml.includes('id="note-subject"') || !notesHtml.includes('aria-label="Note Subject"')) {
            throw new Error('notes.html #note-subject missing aria-label="Note Subject"');
        }
        if (!notesHtml.includes('id="note-content"') || !notesHtml.includes('aria-label="Note Content"')) {
            throw new Error('notes.html #note-content missing aria-label="Note Content"');
        }
        if (!notesHtml.includes('id="search-notes"') || !notesHtml.includes('placeholder="Search vault... (Ctrl+K)"')) {
            throw new Error('notes.html #search-notes missing placeholder="Search vault... (Ctrl+K)"');
        }
        if (!notesHtml.includes('id="save-note-btn"') || !notesHtml.includes('aria-label="Save note entry (Ctrl+S)"') || !notesHtml.includes('title="Save transmission (Ctrl+S)"')) {
            throw new Error('notes.html #save-note-btn missing shortcut hint title or aria-label');
        }
        if (!notesHtml.includes('id="delete-note-btn"') || !notesHtml.includes('aria-label="Delete note entry"')) {
            throw new Error('notes.html #delete-note-btn missing aria-label="Delete note entry"');
        }

        // Dashboard reflection input aria-label
        if (!indexHtml.includes('id="reflection-input"') || !indexHtml.includes('aria-label="Daily Reflection"')) {
            throw new Error('index.html #reflection-input missing aria-label="Daily Reflection"');
        }

        console.log('  Passed: Form control label associations and ARIA attributes verified in source.');
    })();

    console.log('\nMicro-UX Enhancement tests passed successfully!');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
