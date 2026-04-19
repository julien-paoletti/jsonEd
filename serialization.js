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
