import { cloneNode } from './actions.js';

const MAX = 100;
const undoStack = [];
const redoStack = [];
let _isReplaying = false;

let _getRootNode, _setRootNode, _rerender;
export function setDependencies(getRootNode, setRootNode, rerender) {
  _getRootNode = getRootNode;
  _setRootNode = setRootNode;
  _rerender = rerender;
}

export function pushSnapshot(rootNode) {
  if (_isReplaying) return;
  undoStack.push(cloneNode(rootNode));
  if (undoStack.length > MAX) undoStack.shift();
  redoStack.length = 0;
}

export function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(cloneNode(_getRootNode()));
  _setRootNode(undoStack.pop());
  _isReplaying = true;
  _rerender();
  _isReplaying = false;
}

export function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(cloneNode(_getRootNode()));
  _setRootNode(redoStack.pop());
  _isReplaying = true;
  _rerender();
  _isReplaying = false;
}
