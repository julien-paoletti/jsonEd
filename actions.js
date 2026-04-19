import { newId, makeEntry, makeNode, makeArrayItem, makeArray } from './model.js';

// ── focus helpers ────────────────────────────────────────────────────────────

export function focusById(id, selector, select = false) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-entry-id="${id}"]`)?.querySelector(selector);
    if (el) { el.focus(); if (select) el.select(); }
  });
}

export function focusEntryKey(entryId) { focusById(entryId, '.key-input'); }
export function focusArrayItem(itemId)  { focusById(itemId,  '.val-input'); }

export function focusParentKeyFromRow(row) {
  const ancestorRow = row.closest('.entry-row')?.parentElement?.closest('.entry-row');
  if (ancestorRow) {
    const keyInput = ancestorRow.querySelector(':scope > .key-input');
    if (keyInput) keyInput.focus();
  }
}

// ── clone ────────────────────────────────────────────────────────────────────

export function cloneValue(value) {
  if (value.type === 'string') return { type: 'string', text: value.text };
  if (value.type === 'object') return { type: 'object', node: cloneNode(value.node) };
  if (value.type === 'array')  return { type: 'array',  arr:  cloneArr(value.arr)  };
  throw new Error(`cloneValue: unhandled type "${value.type}"`);
}

function cloneNode(node) {
  return {
    type: 'object',
    collapsed: false,
    entries: node.entries.map(e => ({ id: newId(), key: e.key, value: cloneValue(e.value) })),
  };
}

function cloneArr(arr) {
  return {
    type: 'array',
    collapsed: false,
    items: arr.items.map(it => ({ id: newId(), value: cloneValue(it.value) })),
  };
}

function collapseValue(value) {
  if (value.type === 'object') value.node.collapsed = true;
  else if (value.type === 'array') value.arr.collapsed = true;
}

// ── entry / item mutations ───────────────────────────────────────────────────

// rerender is injected to avoid a circular dependency with render.js
let _rerender;
export function setRerender(fn) { _rerender = fn; }

export function addEntryAfter(entry, parentNode) {
  const idx = parentNode.entries.indexOf(entry);
  const newEntry = makeEntry();
  parentNode.entries.splice(idx + 1, 0, newEntry);
  _rerender();
  focusEntryKey(newEntry.id);
}

export function removeEntry(entry, parentNode) {
  const idx = parentNode.entries.indexOf(entry);
  if (parentNode.entries.length === 1) return;
  parentNode.entries.splice(idx, 1);
  _rerender();
}

export function removeEntryAndFocusPrev(entry, parentNode) {
  const idx = parentNode.entries.indexOf(entry);
  parentNode.entries.splice(idx, 1);
  _rerender();
  const prev = parentNode.entries[Math.max(0, idx - 1)];
  if (prev) focusEntryKey(prev.id);
}

export function duplicateEntry(entry, parentNode) {
  const i = parentNode.entries.indexOf(entry);
  collapseValue(entry.value);
  const copy = { id: newId(), key: entry.key, value: cloneValue(entry.value) };
  parentNode.entries.splice(i + 1, 0, copy);
  _rerender();
  focusById(copy.id, '.key-input', true);
}

export function duplicateItem(item, parentArr) {
  const i = parentArr.items.indexOf(item);
  collapseValue(item.value);
  const copy = { id: newId(), value: cloneValue(item.value) };
  parentArr.items.splice(i + 1, 0, copy);
  _rerender();
  focusById(copy.id, '.val-input');
}

export function convertToObject(target) {
  const initialKey = target.value.type === 'string' ? target.value.text : '';
  const subEntry = makeEntry(initialKey);
  target.value = { type: 'object', node: makeNode([subEntry]) };
  _rerender();
  focusEntryKey(subEntry.id);
}

export function convertToArray(target) {
  const initialText = target.value.type === 'string' ? target.value.text : '';
  const firstItem = makeArrayItem(initialText);
  target.value = { type: 'array', arr: makeArray([firstItem]) };
  _rerender();
  focusArrayItem(firstItem.id);
}

// ── type picker menu ─────────────────────────────────────────────────────────

let activeTypeMenu = null;

export function showTypeMenu(e, onObject, onArray) {
  dismissTypeMenu();

  const inputEl = e.target;
  const rect = inputEl.getBoundingClientRect();

  const menu = document.createElement('div');
  menu.className = 'type-menu';
  menu.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = (rect.left   + window.scrollX)     + 'px';

  const choices = [
    { label: 'Object', glyph: '{ }', glyphClass: 'glyph-obj', action: onObject },
    { label: 'Array',  glyph: '[ ]', glyphClass: 'glyph-arr', action: onArray  },
  ];

  let selectedIdx = 0;

  const buttons = choices.map((it, i) => {
    const btn = document.createElement('button');
    btn.className = 'type-menu-item' + (i === 0 ? ' active' : '');
    btn.innerHTML = `<span class="glyph ${it.glyphClass}">${it.glyph}</span>${it.label}`;
    btn.addEventListener('mousedown', (ev) => { ev.preventDefault(); choose(i); });
    menu.appendChild(btn);
    return btn;
  });

  document.body.appendChild(menu);
  activeTypeMenu = menu;

  function setSelected(idx) {
    buttons[selectedIdx].classList.remove('active');
    selectedIdx = idx;
    buttons[selectedIdx].classList.add('active');
  }

  function choose(idx) {
    cleanup();
    dismissTypeMenu();
    choices[idx].action();
  }

  function onKey(ev) {
    if      (ev.key === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); setSelected((selectedIdx + 1) % buttons.length); }
    else if (ev.key === 'ArrowUp')   { ev.preventDefault(); ev.stopPropagation(); setSelected((selectedIdx - 1 + buttons.length) % buttons.length); }
    else if (ev.key === 'Enter')     { ev.preventDefault(); ev.stopPropagation(); choose(selectedIdx); }
    else if (ev.key === 'Escape')    { cleanup(); dismissTypeMenu(); }
  }

  function onFocusOut() {
    setTimeout(() => { if (activeTypeMenu === menu) { cleanup(); dismissTypeMenu(); } }, 100);
  }

  function cleanup() {
    document.removeEventListener('keydown', onKey, true);
    inputEl.removeEventListener('blur', onFocusOut);
  }

  document.addEventListener('keydown', onKey, true);
  inputEl.addEventListener('blur', onFocusOut);
}

function dismissTypeMenu() {
  if (activeTypeMenu) { activeTypeMenu.remove(); activeTypeMenu = null; }
}
