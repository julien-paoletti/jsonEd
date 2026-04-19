import { newId, makeArrayItem, getChildren } from './model.js';
import {
  focusEntryKey, focusArrayItem, focusParentKeyFromRow,
  addEntryAfter, removeEntry, removeEntryAndFocusPrev,
  duplicateEntry, duplicateItem,
  convertToObject, convertToArray,
  showTypeMenu, isShortcut,
} from './actions.js';

let _updatePreview;
let _rerender;
export function setUpdatePreview(fn) { _updatePreview = fn; }
export function setRerender(fn)      { _rerender = fn; }

// ── icon buttons ──────────────────────────────────────────────────────────────

function makeIconBtn(className, title, glyph, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.innerHTML = glyph;
  btn.addEventListener('click', onClick);
  return btn;
}

const makeRemoveBtn    = onClick => makeIconBtn('remove-btn', 'Remove entry',    '×', onClick);
const makeDuplicateBtn = onClick => makeIconBtn('dupe-btn',   'Duplicate entry', '⎘', onClick);

function makeDragHandle() {
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.title = 'Drag to reorder';
  handle.textContent = '⠿';
  handle.draggable = true;
  return handle;
}

// ── drag-and-drop ─────────────────────────────────────────────────────────────

let _drag = null; // { item, parent }
let _dragOverRow = null;

function clearDropIndicators() {
  if (_dragOverRow) {
    _dragOverRow.classList.remove('drag-over-top', 'drag-over-bottom');
    _dragOverRow = null;
  }
}

function getDropTarget(e, row) {
  const rect = row.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
}

function attachDrag(handle, row, item, parent) {
  handle.addEventListener('dragstart', (e) => {
    _drag = { item, parent };
    e.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging');
  });

  handle.addEventListener('dragend', () => {
    _drag = null;
    row.classList.remove('dragging');
    clearDropIndicators();
  });

  row.addEventListener('dragover', (e) => {
    if (!_drag || _drag.parent !== parent) return;
    if (_drag.item === item) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    _dragOverRow = row;
    row.classList.add(getDropTarget(e, row) === 'top' ? 'drag-over-top' : 'drag-over-bottom');
  });

  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget)) {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });

  row.addEventListener('drop', (e) => {
    if (!_drag || _drag.parent !== parent || _drag.item === item) return;
    e.preventDefault();
    clearDropIndicators();

    const children = getChildren(parent);
    const fromIdx = children.indexOf(_drag.item);
    let toIdx = children.indexOf(item);
    if (getDropTarget(e, row) === 'bottom') toIdx++;
    if (fromIdx === toIdx || fromIdx === toIdx - 1) return;

    children.splice(fromIdx, 1);
    const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
    children.splice(insertAt, 0, _drag.item);
    _rerender();
  });
}

// ── auto-size input ───────────────────────────────────────────────────────────

export function autoSize(input) {
  const len = Math.max(input.value.length, input.placeholder.length, 3);
  input.style.width = (len + 2) + 'ch';
}

// ── container ─────────────────────────────────────────────────────────────────

function renderContainer(data, openChar, closeChar, renderItemFn, items, extraPreviewClass) {
  const el = document.createElement('div');
  el.className = 'json-node' + (data.collapsed ? ' collapsed' : '');

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'toggle-btn' + (data.collapsed ? ' collapsed' : '');
  toggleBtn.title = 'Collapse/expand';
  toggleBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="currentColor"><polygon points="1,2 9,2 5,8"/></svg>';
  toggleBtn.addEventListener('click', () => {
    data.collapsed = !data.collapsed;
    el.classList.toggle('collapsed', data.collapsed);
    toggleBtn.classList.toggle('collapsed', data.collapsed);
    _updatePreview();
  });

  const openLine = document.createElement('div');
  openLine.className = 'node-open-line';
  openLine.appendChild(toggleBtn);

  const openBrace = document.createElement('span');
  openBrace.className = 'node-brace' + (extraPreviewClass ? ' node-bracket' : '');
  openBrace.textContent = openChar;
  openLine.appendChild(openBrace);

  const collapsedPreview = document.createElement('span');
  collapsedPreview.className = 'collapsed-preview' + (extraPreviewClass ? ' ' + extraPreviewClass : '');
  collapsedPreview.textContent = '… ' + closeChar;
  openLine.appendChild(collapsedPreview);

  el.appendChild(openLine);

  const collapsible = document.createElement('div');
  collapsible.className = 'node-collapsible';

  const collapsibleInner = document.createElement('div');
  collapsibleInner.className = 'node-collapsible-inner';

  const itemsEl = document.createElement('div');
  itemsEl.className = 'node-entries';
  items.forEach((item, idx) => itemsEl.appendChild(renderItemFn(item, data, idx)));
  collapsibleInner.appendChild(itemsEl);

  const closeBrace = document.createElement('span');
  closeBrace.className = 'node-brace node-brace-close' + (extraPreviewClass ? ' node-bracket' : '');
  closeBrace.textContent = closeChar;
  collapsibleInner.appendChild(closeBrace);

  collapsible.appendChild(collapsibleInner);
  el.appendChild(collapsible);

  return el;
}

export function renderNode(node) {
  return renderContainer(node, '{', '}', renderEntry, node.entries, null);
}

export function renderArray(arr) {
  return renderContainer(arr, '[', ']', renderArrayItem, arr.items, 'collapsed-preview-array');
}

// ── nested wrapper ────────────────────────────────────────────────────────────

function makeNestedWrapper(subEl, isLastItem, dupeBtn, removeBtn) {
  const wrapper = document.createElement('div');
  wrapper.className = 'val-node-wrapper';

  const closingBrace = subEl.querySelector('.node-collapsible-inner > .node-brace-close');
  closingBrace.parentNode.removeChild(closingBrace);

  const closingLine = document.createElement('div');
  closingLine.className = 'node-closing-line';
  closingLine.appendChild(closingBrace);

  if (!isLastItem) {
    const comma = document.createElement('span');
    comma.className = 'comma';
    comma.textContent = ',';
    closingLine.appendChild(comma);
  }

  closingLine.appendChild(dupeBtn);
  closingLine.appendChild(removeBtn);
  subEl.querySelector('.node-collapsible-inner').appendChild(closingLine);
  wrapper.appendChild(subEl);
  return wrapper;
}

// ── array item ────────────────────────────────────────────────────────────────

function renderArrayItem(item, parentArr, idx) {
  const row = document.createElement('div');
  row.className = 'array-item-row';
  row.dataset.entryId = item.id;

  const handle = makeDragHandle();
  attachDrag(handle, row, item, parentArr);
  row.appendChild(handle);

  const idxLabel = document.createElement('span');
  idxLabel.className = 'array-idx';
  idxLabel.textContent = idx + ':';
  row.appendChild(idxLabel);

  if (item.value.type === 'string') {
    const valEl = document.createElement('input');
    valEl.type = 'text';
    valEl.className = 'val-input';
    valEl.value = item.value.text;
    valEl.placeholder = 'value';
    valEl.setAttribute('spellcheck', 'false');
    autoSize(valEl);

    valEl.addEventListener('input', () => {
      item.value.text = valEl.value;
      autoSize(valEl);
      _updatePreview();
    });
    valEl.addEventListener('keydown', (e) => onArrayItemKeyInput(e, item, parentArr, valEl, row));

    row.appendChild(valEl);

    if (idx < parentArr.items.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'comma';
      comma.textContent = ',';
      row.appendChild(comma);
    }

    row.appendChild(makeDuplicateBtn(() => duplicateItem(item, parentArr)));
    row.appendChild(makeRemoveBtn(() => {
      const i = parentArr.items.indexOf(item);
      if (parentArr.items.length > 1) { parentArr.items.splice(i, 1); _rerender(); }
    }));
  } else {
    const subEl = item.value.type === 'object' ? renderNode(item.value.node) : renderArray(item.value.arr);
    const isLast = idx === parentArr.items.length - 1;
    const dupeBtn = makeDuplicateBtn(() => duplicateItem(item, parentArr));
    const rmBtn = makeRemoveBtn(() => {
      const i = parentArr.items.indexOf(item);
      if (parentArr.items.length > 1) { parentArr.items.splice(i, 1); _rerender(); }
    });
    row.appendChild(makeNestedWrapper(subEl, isLast, dupeBtn, rmBtn));
  }

  return row;
}

function onArrayItemKeyInput(e, item, parentArr, inputEl, row) {
  if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter') {
    e.preventDefault();
    const idx = parentArr.items.indexOf(item);
    const newItem = makeArrayItem();
    parentArr.items.splice(idx + 1, 0, newItem);
    _rerender();
    focusArrayItem(newItem.id);
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    showTypeMenu(e, () => convertToObject(item), () => convertToArray(item));
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const idx = parentArr.items.indexOf(item);
    if (idx > 0) {
      focusArrayItem(parentArr.items[idx - 1].id);
    } else {
      const ancestorRow = row.closest('.array-item-row')?.parentElement?.closest('.entry-row,.array-item-row');
      if (ancestorRow) ancestorRow.querySelector('.key-input,.val-input')?.focus();
    }
  }

  if (e.key === 'Backspace' && inputEl.value === '' && parentArr.items.length > 1) {
    e.preventDefault();
    const idx = parentArr.items.indexOf(item);
    parentArr.items.splice(idx, 1);
    _rerender();
    const prev = parentArr.items[Math.max(0, idx - 1)];
    if (prev) focusArrayItem(prev.id);
  }

  if (isShortcut(e, 'd')) {
    e.preventDefault();
    duplicateItem(item, parentArr);
  }
}

// ── entry ─────────────────────────────────────────────────────────────────────

function renderEntry(entry, parentNode, idx) {
  const row = document.createElement('div');
  row.className = 'entry-row';
  row.dataset.entryId = entry.id;

  const handle = makeDragHandle();
  attachDrag(handle, row, entry, parentNode);
  row.appendChild(handle);

  const keyEl = document.createElement('input');
  keyEl.type = 'text';
  keyEl.className = 'key-input';
  keyEl.value = entry.key;
  keyEl.placeholder = 'key';
  keyEl.setAttribute('spellcheck', 'false');
  autoSize(keyEl);

  keyEl.addEventListener('input', () => {
    entry.key = keyEl.value;
    autoSize(keyEl);
    _updatePreview();
  });
  keyEl.addEventListener('keydown', (e) => onKeyInput(e, entry, parentNode, 'key', keyEl, row));
  keyEl.addEventListener('blur', () => {
    if (entry.key === '' && parentNode.entries.length > 1) {
      removeEntryAndFocusPrev(entry, parentNode);
    }
  });

  const colon = document.createElement('span');
  colon.className = 'colon';
  colon.textContent = ': ';

  row.appendChild(keyEl);
  row.appendChild(colon);

  if (entry.value.type === 'string') {
    const valEl = document.createElement('input');
    valEl.type = 'text';
    valEl.className = 'val-input';
    valEl.value = entry.value.text;
    valEl.placeholder = 'value';
    valEl.setAttribute('spellcheck', 'false');
    autoSize(valEl);

    valEl.addEventListener('input', () => {
      entry.value.text = valEl.value;
      autoSize(valEl);
      _updatePreview();
    });
    valEl.addEventListener('keydown', (e) => onKeyInput(e, entry, parentNode, 'value', valEl, row));

    row.appendChild(valEl);

    if (idx < parentNode.entries.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'comma';
      comma.textContent = ',';
      row.appendChild(comma);
    }

    row.appendChild(makeDuplicateBtn(() => duplicateEntry(entry, parentNode)));
    row.appendChild(makeRemoveBtn(() => removeEntry(entry, parentNode)));
  } else {
    const subEl = entry.value.type === 'object' ? renderNode(entry.value.node) : renderArray(entry.value.arr);
    const isLast = idx === parentNode.entries.length - 1;
    row.appendChild(makeNestedWrapper(subEl, isLast,
      makeDuplicateBtn(() => duplicateEntry(entry, parentNode)),
      makeRemoveBtn(() => removeEntry(entry, parentNode))));
  }

  return row;
}

function onKeyInput(e, entry, parentNode, field, inputEl, row) {
  if (field === 'key') {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const valInput = row.querySelector('.val-input');
      if (valInput) valInput.focus();
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      addEntryAfter(entry, parentNode);
    }

    if (e.key === 'Backspace' && inputEl.value === '') {
      e.preventDefault();
      if (parentNode.entries.length > 1) removeEntryAndFocusPrev(entry, parentNode);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = parentNode.entries.indexOf(entry);
      if (idx < parentNode.entries.length - 1) focusEntryKey(parentNode.entries[idx + 1].id);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = parentNode.entries.indexOf(entry);
      if (idx > 0) focusEntryKey(parentNode.entries[idx - 1].id);
      else focusParentKeyFromRow(row);
    }
  }

  if (field === 'value') {
    if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter') {
      e.preventDefault();
      addEntryAfter(entry, parentNode);
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      showTypeMenu(e, () => convertToObject(entry), () => convertToArray(entry));
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusParentKeyFromRow(row);
    }
  }

  if (isShortcut(e, 'd')) {
    e.preventDefault();
    duplicateEntry(entry, parentNode);
  }
}
