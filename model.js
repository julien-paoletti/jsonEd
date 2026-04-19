let idCounter = 0;
export function newId() { return ++idCounter; }

export function makeEntry(key = '', valueText = '') {
  return { id: newId(), key, value: { type: 'string', text: valueText } };
}

export function makeNode(entries) {
  return { type: 'object', entries: entries || [makeEntry()] };
}

export function makeArrayItem(valueText = '') {
  return { id: newId(), value: { type: 'string', text: valueText } };
}

export function makeArray(items) {
  return { type: 'array', items: items || [makeArrayItem()] };
}

export function getChildren(container) {
  return container.type === 'object' ? container.entries : container.items;
}

export function getNestedContainer(value) {
  if (value.type === 'object') return value.node;
  if (value.type === 'array')  return value.arr;
  return null;
}
