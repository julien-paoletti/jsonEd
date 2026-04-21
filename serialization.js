import { newId, makeEntry, makeNode, makeArrayItem, makeArray } from './model.js';

export function valueToJS(value) {
  if (value.type === 'string') {
    const raw = value.text;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (raw !== '' && !isNaN(Number(raw))) return Number(raw);
    return raw;
  }
  if (value.type === 'object') return nodeToJS(value.node);
  if (value.type === 'array')  return arrToJS(value.arr);
  return null;
}

export function nodeToJS(node) {
  const obj = {};
  for (const entry of node.entries) {
    if (!entry.key) continue;
    obj[entry.key] = valueToJS(entry.value);
  }
  return obj;
}

export function arrToJS(arr) {
  return arr.items.map(item => valueToJS(item.value));
}

export function jsToValue(v) {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return { type: 'object', node: jsToNode(v) };
  }
  if (Array.isArray(v)) {
    return { type: 'array', arr: jsToArr(v) };
  }
  return { type: 'string', text: v === null ? 'null' : String(v) };
}

export function jsToNode(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return makeNode();
  const entries = Object.entries(obj).map(([k, v]) => ({ id: newId(), key: k, value: jsToValue(v) }));
  if (entries.length === 0) entries.push(makeEntry());
  return { type: 'object', entries };
}

export function jsToArr(arr) {
  if (!Array.isArray(arr)) return makeArray();
  const items = arr.map(v => ({ id: newId(), value: jsToValue(v) }));
  if (items.length === 0) items.push(makeArrayItem());
  return { type: 'array', items };
}

const PARSE_FAILED = Symbol();

function tryParse(text) {
  try { return JSON.parse(text); } catch { return PARSE_FAILED; }
}

function loosen(text) {
  return text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_, inner) => '"' + inner.replace(/(?<!\\)"/g, '\\"').replace(/\\'/g, "'") + '"')
    .replace(/,(\s*[}\]])/g, '$1');
}

// Returns parsed value on success, or PARSE_FAILED sentinel on failure.
export const PARSE_FAILED_SENTINEL = PARSE_FAILED;

export function parseFlexible(text) {
  const strict = tryParse(text);
  if (strict !== PARSE_FAILED) return strict;
  const loose = tryParse(loosen(text));
  return loose !== PARSE_FAILED ? loose : PARSE_FAILED;
}
