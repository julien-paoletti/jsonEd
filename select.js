import { nodeToJS } from './serialization.js';
import { setAllCollapsed, isShortcut } from './actions.js';
import { getChildren, getNestedContainer } from './model.js';

// injected by app.js
let _rootNode;
let _updatePreview;
let _rerender;
export function setRootNodeGetter(fn)  { _rootNode = fn; }
export function setUpdatePreview(fn)   { _updatePreview = fn; }
export function setRerender(fn)        { _rerender = fn; }

let _selectRerenderInProgress = false;

const selectBar   = document.getElementById('select-bar');
const selectInput = document.getElementById('select-input');
const selectCount = document.getElementById('select-count');

export function initSelectBar() {
  document.addEventListener('keydown', (e) => {
    if (isShortcut(e, 'f')) {
      e.preventDefault();
      selectBar.classList.add('open');
      selectInput.focus();
      selectInput.select();
    }
    if (e.key === 'Escape' && selectBar.classList.contains('open')) {
      closeSelect();
    }
  });

  document.getElementById('btn-select-close').addEventListener('click', closeSelect);
  selectInput.addEventListener('input', runSelect);
  selectInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSelect();
  });
}

export function refreshSelect() {
  if (_selectRerenderInProgress) return;
  if (selectBar.classList.contains('open') && selectInput.value.trim()) runSelect();
}

function closeSelect() {
  selectBar.classList.remove('open');
  selectInput.value = '';
  clearSelectHighlights();
  selectCount.textContent = '';
  setAllCollapsed(_rootNode(), false);
  _rerender();
}

function clearSelectHighlights() {
  document.querySelectorAll('.entry-row.select-match').forEach(el => el.classList.remove('select-match'));
}

function runSelect() {
  const expr = selectInput.value.trim();
  selectInput.classList.remove('error');

  if (!expr) {
    selectCount.textContent = '';
    _updatePreview();
    return;
  }

  try {
    const rootNode = _rootNode();
    const js = nodeToJS(rootNode);
    const results = jqEval(expr, [js]);

    const ids = collectMatchedEntryIds(expr, rootNode);

    setAllCollapsed(rootNode, true);
    expandAncestors(rootNode, ids);
    _selectRerenderInProgress = true;
    _rerender();
    _selectRerenderInProgress = false;

    ids.forEach(id => {
      const row = document.querySelector(`[data-entry-id="${id}"]`);
      if (row) row.classList.add('select-match');
    });

    selectCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;

    const out = results.length === 1 ? results[0] : results;
    document.getElementById('preview-content').textContent = JSON.stringify(out, null, 2);
  } catch {
    selectInput.classList.add('error');
    selectCount.textContent = 'error';
  }
}

// ── jq engine ─────────────────────────────────────────────────────────────────

function jqEval(expr, inputs) {
  expr = expr.trim();

  const pipeIdx = findTopLevel(expr, '|');
  if (pipeIdx !== -1) {
    const left  = expr.slice(0, pipeIdx).trim();
    const right = expr.slice(pipeIdx + 1).trim();
    return jqEval(right, jqEval(left, inputs));
  }

  if (expr.startsWith('select(') && expr.endsWith(')')) {
    const condStr = expr.slice(7, -1).trim();
    return inputs.filter(v => evalCondition(condStr, v));
  }

  if (expr === '.') return inputs;

  if (expr === '.[]') {
    return inputs.flatMap(v => {
      if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v);
      if (Array.isArray(v)) return v;
      return [];
    });
  }

  if (expr.startsWith('.')) {
    let path = expr.slice(1);
    let iterate = false;
    if (path.endsWith('[]')) { iterate = true; path = path.slice(0, -2); }
    const keys = path ? path.split('.') : [];
    let results = inputs;
    for (const key of keys) {
      results = results.flatMap(v => {
        if (v && typeof v === 'object' && !Array.isArray(v) && key in v) return [v[key]];
        return [];
      });
    }
    if (iterate) {
      results = results.flatMap(v => {
        if (v && typeof v === 'object' && !Array.isArray(v)) return Object.values(v);
        if (Array.isArray(v)) return v;
        return [];
      });
    }
    return results;
  }

  return inputs;
}

function evalCondition(cond, val) {
  const m = cond.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (!m) return false;
  const [, lhsExpr, op, rhsRaw] = m;
  const lhs = jqEval(lhsExpr.trim(), [val])[0];
  const rhs = parseLiteral(rhsRaw.trim());
  if (op === '==') return lhs == rhs;
  if (op === '!=') return lhs != rhs;
  if (op === '<')  return lhs <  rhs;
  if (op === '>')  return lhs >  rhs;
  if (op === '<=') return lhs <= rhs;
  if (op === '>=') return lhs >= rhs;
  return false;
}

function parseLiteral(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true')  return true;
  if (s === 'false') return false;
  if (s === 'null')  return null;
  const n = Number(s);
  return isNaN(n) ? s : n;
}

function findTopLevel(str, char) {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (depth === 0 && str.slice(i, i + char.length) === char) return i;
  }
  return -1;
}

function collectMatchedEntryIds(expr, rootNode) {
  expr = expr.trim();
  if (!expr || expr === '.') return new Set();
  const ids = new Set();
  collectFromNode(rootNode, expr, ids);
  return ids;
}

function collectFromNode(node, expr, ids) {
  const pipeIdx = findTopLevel(expr, '|');
  if (pipeIdx !== -1) {
    const left  = expr.slice(0, pipeIdx).trim();
    const right = expr.slice(pipeIdx + 1).trim();
    const midNodes = collectNodesForExpr(node, left);
    for (const { node: n, entryId } of midNodes) {
      if (right.startsWith('select(') && right.endsWith(')')) {
        const condStr = right.slice(7, -1).trim();
        if (evalCondition(condStr, nodeToJS(n))) ids.add(entryId);
      } else {
        collectFromNode(n, right, ids);
      }
    }
    return;
  }

  if (!expr.startsWith('.')) return;
  let path = expr.slice(1);
  let iterate = false;
  if (path.endsWith('[]')) { iterate = true; path = path.slice(0, -2); }
  const keys = path ? path.split('.') : [];

  if (keys.length === 0 && iterate) {
    for (const entry of node.entries) ids.add(entry.id);
    return;
  }

  let currentNodes = [node];
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = [];
    for (const n of currentNodes) {
      const e = n.entries.find(en => en.key === key);
      if (e && e.value.type === 'object') next.push(e.value.node);
    }
    currentNodes = next;
  }

  const lastKey = keys[keys.length - 1];
  for (const n of currentNodes) {
    for (const entry of n.entries) {
      if (entry.key === lastKey) {
        if (iterate && entry.value.type === 'object') {
          for (const subEntry of entry.value.node.entries) ids.add(subEntry.id);
        } else {
          ids.add(entry.id);
        }
      }
    }
  }
}

// Returns true if container has a descendant whose id is in matchedIds.
// As a side-effect, sets collapsed=false on every ancestor of a match.
function expandAncestors(container, matchedIds) {
  let hasMatch = false;
  for (const child of getChildren(container)) {
    if (matchedIds.has(child.id)) {
      hasMatch = true;
    } else {
      const nested = getNestedContainer(child.value);
      if (nested && expandAncestors(nested, matchedIds)) {
        nested.collapsed = false;
        hasMatch = true;
      }
    }
  }
  return hasMatch;
}

function collectNodesForExpr(node, expr) {
  if (!expr.startsWith('.')) return [];
  let path = expr.slice(1);
  let iterate = false;
  if (path.endsWith('[]')) { iterate = true; path = path.slice(0, -2); }
  const keys = path ? path.split('.') : [];

  let current = [{ node, entryId: null }];
  for (const key of keys) {
    const next = [];
    for (const { node: n } of current) {
      const e = n.entries.find(en => en.key === key);
      if (e && e.value.type === 'object') next.push({ node: e.value.node, entryId: e.id });
    }
    current = next;
  }

  if (iterate) {
    return current.flatMap(({ node: n }) =>
      n.entries.filter(e => e.value.type === 'object').map(e => ({ node: e.value.node, entryId: e.id }))
    );
  }
  return current;
}
