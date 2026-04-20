import { makeNode } from './model.js';
import { nodeToJS, jsToNode, parseFlexible, PARSE_FAILED_SENTINEL } from './serialization.js';
import { setRerender, focusEntryKey, setAllCollapsed, isShortcut } from './actions.js';
import { renderNode, setUpdatePreview, setRerender as setRenderRerender } from './render.js';
import { initSelectBar, refreshSelect, setRootNodeGetter, setUpdatePreview as setSelectUpdatePreview, setRerender as setSelectRerender } from './select.js';
import { pushSnapshot, undo, redo, setDependencies as setHistoryDependencies } from './history.js';

const SVG_COPY  = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
const SVG_CHECK = '<polyline points="20 6 9 17 4 12"/>';

let rootNode = makeNode();
let currentFilename = 'untitled.json';

// ── core functions ────────────────────────────────────────────────────────────

function updatePreview() {
  const json = JSON.stringify(nodeToJS(rootNode), null, 2);
  document.getElementById('preview-content').textContent = json;
}

function rerender() {
  pushSnapshot(rootNode);
  const panel = document.getElementById('root-node');
  panel.innerHTML = '';
  panel.appendChild(renderNode(rootNode));
  updatePreview();
  requestAnimationFrame(refreshSelect);
}

// inject dependencies
setHistoryDependencies(() => rootNode, node => { rootNode = node; }, rerender);
setRerender(rerender);
setRenderRerender(rerender);
setUpdatePreview(updatePreview);
setSelectUpdatePreview(updatePreview);
setSelectRerender(rerender);
setRootNodeGetter(() => rootNode);

// ── toolbar ───────────────────────────────────────────────────────────────────

document.getElementById('btn-collapse-all').addEventListener('click', () => {
  setAllCollapsed(rootNode, true);
  rerender();
});

document.getElementById('btn-expand-all').addEventListener('click', () => {
  setAllCollapsed(rootNode, false);
  rerender();
});

document.getElementById('btn-save').addEventListener('click', saveFile);

document.getElementById('btn-copy').addEventListener('click', (e) => {
  const json = document.getElementById('preview-content').textContent;
  navigator.clipboard.writeText(json).then(() => {
    const btn = e.currentTarget;
    btn.classList.add('copied');
    btn.querySelector('svg').innerHTML = SVG_CHECK;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.querySelector('svg').innerHTML = SVG_COPY;
    }, 1500);
  });
});

document.getElementById('btn-paste').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  navigator.clipboard.readText().then((text) => {
    const parsed = parseFlexible(text);
    if (parsed !== PARSE_FAILED_SENTINEL) {
      rootNode = jsToNode(parsed);
      rerender();
      focusEntryKey(rootNode.entries[0].id);
    } else {
      btn.classList.add('error');
      setTimeout(() => btn.classList.remove('error'), 1500);
    }
  });
});

document.getElementById('btn-open').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('btn-new').addEventListener('click', newDocument);

document.addEventListener('keydown', (e) => {
  if (isShortcut(e, 's')) { e.preventDefault(); saveFile(); return; }
  if (isShortcut(e, 'z') && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (isShortcut(e, 'y') || (isShortcut(e, 'z') && e.shiftKey)) { e.preventDefault(); redo(); }
});

function saveFile() {
  const json = JSON.stringify(nodeToJS(rootNode), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  currentFilename = file.name;
  document.getElementById('filename-display').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const parsed = parseFlexible(ev.target.result);
    if (parsed !== PARSE_FAILED_SENTINEL) {
      rootNode = jsToNode(parsed);
      rerender();
    } else {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

function newDocument() {
  currentFilename = 'untitled.json';
  document.getElementById('filename-display').textContent = currentFilename;
  rootNode = makeNode();
  rerender();
  focusEntryKey(rootNode.entries[0].id);
}

// ── init ──────────────────────────────────────────────────────────────────────

initSelectBar();
rerender();
focusEntryKey(rootNode.entries[0].id);
