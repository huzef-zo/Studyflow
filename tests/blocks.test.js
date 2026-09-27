const assert = require('assert');
const Blocks = require('../js/blocks.js');

console.log('--- Starting Blocks Engine Unit Tests ---');

// Test 1: Block Creation & Sanitization
console.log('Test 1: createBlock and sanitizeBlock');
const b1 = Blocks.createBlock('heading1', 'Title Text');
assert.strictEqual(b1.type, 'heading1');
assert.strictEqual(b1.content, 'Title Text');
assert.strictEqual(Array.isArray(b1.children), true);
assert(b1.id.startsWith('blk_'));

const invalidBlock = Blocks.sanitizeBlock({
  id: 'invalid-id-$$$',
  type: 'invalid_type',
  content: 'a'.repeat(6000),
  properties: {
    __proto__: { polluted: true },
    normal: 'valid string'
  }
});

assert.strictEqual(invalidBlock.type, 'paragraph');
assert.strictEqual(invalidBlock.content.length, 5000);
assert.strictEqual(invalidBlock.properties.polluted, undefined);
assert.strictEqual(invalidBlock.properties.normal, 'valid string');
assert(invalidBlock.id.startsWith('blk_'));
console.log('✅ Test 1 Passed');

// Test 2: Inline Formatting Renderer
console.log('Test 2: renderInlineFormatted');
const rawText = 'Hello **bold** and *italic* and `code` <script>alert(1)</script>';
const formatted = Blocks.renderInlineFormatted(rawText);
assert(formatted.includes('<strong>bold</strong>'));
assert(formatted.includes('<em>italic</em>'));
assert(formatted.includes('<code>code</code>'));
assert(!formatted.includes('<script>'));
assert(formatted.includes('&lt;script&gt;'));
console.log('✅ Test 2 Passed');

// Test 3: Block HTML Rendering
console.log('Test 3: renderBlockHtml');
const todoBlock = Blocks.createBlock('todo', 'Task 1', [], { checked: true });
const html = Blocks.renderBlockHtml(todoBlock);
assert(html.includes('data-type="todo"'));
assert(html.includes('checked'));
assert(html.includes('completed'));
assert(html.includes('Task 1'));
console.log('✅ Test 3 Passed');

console.log('--- All Blocks Engine Unit Tests Passed ---');
