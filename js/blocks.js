/**
 * StudyFlow - Blocks Engine Module
 * Manages Notion-style block data models, tree manipulation, and safe HTML rendering.
 */

const Blocks = (function() {
  'use strict';

  const BLOCK_TYPES = [
    'paragraph',
    'heading1',
    'heading2',
    'heading3',
    'bulleted_list',
    'numbered_list',
    'todo',
    'toggle',
    'quote',
    'divider',
    'code',
    'callout',
    'page_link'
  ];

  function generateBlockId() {
    if (typeof Storage !== 'undefined' && Storage.generateId) {
      return 'blk_' + Storage.generateId();
    }
    return 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  function createBlock(type = 'paragraph', content = '', children = [], properties = {}) {
    const safeType = BLOCK_TYPES.includes(type) ? type : 'paragraph';
    return {
      id: generateBlockId(),
      type: safeType,
      content: String(content || '').substring(0, 5000),
      children: Array.isArray(children) ? children.map(c => sanitizeBlock(c)).filter(Boolean) : [],
      properties: properties && typeof properties === 'object' && !Array.isArray(properties) ? sanitizeProperties(properties) : {}
    };
  }

  function sanitizeProperties(props) {
    const clean = {};
    for (const key in props) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        const val = props[key];
        if (typeof val === 'string') {
          clean[key] = val.substring(0, 500);
        } else if (typeof val === 'boolean' || typeof val === 'number') {
          clean[key] = val;
        } else if (Array.isArray(val)) {
          clean[key] = val.slice(0, 50).map(v => typeof v === 'string' ? v.substring(0, 200) : v);
        }
      }
    }
    return clean;
  }

  function sanitizeBlock(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const isValidId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(id);
    const id = isValidId(raw.id) ? raw.id : generateBlockId();
    const type = BLOCK_TYPES.includes(raw.type) ? raw.type : 'paragraph';
    const content = String(raw.content || '').substring(0, 5000);
    const children = Array.isArray(raw.children) ? raw.children.map(c => sanitizeBlock(c)).filter(Boolean) : [];
    const properties = sanitizeProperties(raw.properties || {});

    return {
      id,
      type,
      content,
      children,
      properties
    };
  }

  function renderInlineFormatted(content) {
    if (!content) return '';
    let escaped = typeof App !== 'undefined' && App.escapeHtml ? App.escapeHtml(content) : String(content).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

    // Bold: **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code: `text`
    escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');

    return escaped;
  }

  function renderBlockHtml(block, index = 0, options = {}) {
    if (!block) return '';
    const { isEditable = true } = options;
    const id = block.id;
    const type = block.type;
    const content = block.content || '';
    const props = block.properties || {};

    const formattedContent = renderInlineFormatted(content);
    let innerHtml = '';

    switch (type) {
      case 'heading1':
        innerHtml = `<h1 class="block-content" contenteditable="${isEditable}" data-placeholder="Heading 1">${formattedContent}</h1>`;
        break;
      case 'heading2':
        innerHtml = `<h2 class="block-content" contenteditable="${isEditable}" data-placeholder="Heading 2">${formattedContent}</h2>`;
        break;
      case 'heading3':
        innerHtml = `<h3 class="block-content" contenteditable="${isEditable}" data-placeholder="Heading 3">${formattedContent}</h3>`;
        break;
      case 'bulleted_list':
        innerHtml = `<div class="block-list-item"><span class="block-bullet">•</span><div class="block-content" contenteditable="${isEditable}" data-placeholder="List item">${formattedContent}</div></div>`;
        break;
      case 'numbered_list':
        innerHtml = `<div class="block-list-item"><span class="block-number">${index + 1}.</span><div class="block-content" contenteditable="${isEditable}" data-placeholder="List item">${formattedContent}</div></div>`;
        break;
      case 'todo':
        const checked = Boolean(props.checked);
        innerHtml = `<div class="block-todo-item"><input type="checkbox" class="block-checkbox" ${checked ? 'checked' : ''} aria-label="To-do checkbox"><div class="block-content ${checked ? 'completed' : ''}" contenteditable="${isEditable}" data-placeholder="To-do">${formattedContent}</div></div>`;
        break;
      case 'toggle':
        const expanded = props.expanded !== false;
        innerHtml = `<details class="block-toggle-item" ${expanded ? 'open' : ''}><summary class="block-toggle-summary"><span class="toggle-arrow">▶</span><div class="block-content" contenteditable="${isEditable}" data-placeholder="Toggle">${formattedContent}</div></summary></details>`;
        break;
      case 'quote':
        innerHtml = `<blockquote class="block-quote"><div class="block-content" contenteditable="${isEditable}" data-placeholder="Empty quote">${formattedContent}</div></blockquote>`;
        break;
      case 'divider':
        innerHtml = `<hr class="block-divider" />`;
        break;
      case 'code':
        const lang = props.language ? App.escapeHtml(props.language) : 'Plain Text';
        innerHtml = `<div class="block-code-wrapper"><div class="block-code-header"><span class="block-code-lang">${lang}</span></div><pre class="block-code-body"><code class="block-content" contenteditable="${isEditable}" data-placeholder="Code">${formattedContent}</code></pre></div>`;
        break;
      case 'callout':
        const icon = props.icon ? App.escapeHtml(props.icon) : '💡';
        innerHtml = `<div class="block-callout"><span class="callout-icon">${icon}</span><div class="block-content" contenteditable="${isEditable}" data-placeholder="Callout">${formattedContent}</div></div>`;
        break;
      case 'page_link':
        const pageTitle = props.pageTitle ? App.escapeHtml(props.pageTitle) : 'Untitled Page';
        const pageId = props.pageId ? App.escapeHtml(props.pageId) : '';
        innerHtml = `<div class="block-page-link" data-page-id="${pageId}"><span class="page-link-icon">📄</span><a href="#" class="page-link-anchor" data-page-id="${pageId}">${pageTitle}</a></div>`;
        break;
      case 'paragraph':
      default:
        innerHtml = `<div class="block-content" contenteditable="${isEditable}" data-placeholder="Type '/' for commands">${formattedContent}</div>`;
        break;
    }

    const childrenHtml = block.children && block.children.length > 0
      ? `<div class="block-children">${block.children.map((child, i) => renderBlockHtml(child, i, options)).join('')}</div>`
      : '';

    return `
      <div class="block-item" data-id="${block.id}" data-type="${type}" draggable="true">
        <div class="block-drag-handle" title="Drag to reorder block" role="button" tabindex="0" aria-label="Drag block handle">⋮⋮</div>
        <div class="block-body">
          ${innerHtml}
          ${childrenHtml}
        </div>
      </div>
    `;
  }

  return {
    BLOCK_TYPES,
    createBlock,
    sanitizeBlock,
    renderBlockHtml,
    renderInlineFormatted
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Blocks;
} else {
  window.Blocks = Blocks;
}
