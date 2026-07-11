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

    console.log('\nMicro-UX Enhancement tests passed successfully!');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
