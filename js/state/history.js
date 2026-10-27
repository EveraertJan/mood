/*
 * TASTBAAR moodboard — undo/redo history.
 *
 * Undo/redo over actions. A continuous drag counts as one step. Limit 200 steps.
 *
 * Usage: call push(label) BEFORE mutating the document. The snapshot it takes
 * is the state that undo will restore.
 */

import { getDoc, setDoc } from "./store.js";

const MAX_STEPS = 200;

const history = {
  past: [],
  future: [],
  dragSnapshot: null
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function snapshot(label = "") {
  return { label, doc: clone(getDoc()) };
}

/** Record the current document as an undo step. Call before mutating. */
export function push(label = "action") {
  history.past.push(snapshot(label));
  if (history.past.length > MAX_STEPS) {
    history.past.shift();
  }
  history.future.length = 0;
}

/** Start a continuous action (a drag): one snapshot for the whole gesture. */
export function beginDrag() {
  if (!history.dragSnapshot) {
    history.dragSnapshot = snapshot("drag");
  }
}

/** End a continuous action and record it as a single step. */
export function endDrag() {
  if (history.dragSnapshot) {
    history.past.push(history.dragSnapshot);
    if (history.past.length > MAX_STEPS) {
      history.past.shift();
    }
    history.future.length = 0;
    history.dragSnapshot = null;
  }
}

/** Drop a continuous action that changed nothing (a click on a resize corner). */
export function cancelDrag() {
  history.dragSnapshot = null;
}

export function undo() {
  if (history.past.length === 0) return false;
  history.future.push(snapshot("redo"));
  const prev = history.past.pop();
  setDoc(clone(prev.doc));
  return true;
}

export function redo() {
  if (history.future.length === 0) return false;
  history.past.push(snapshot("undo"));
  const next = history.future.pop();
  setDoc(clone(next.doc));
  return true;
}

export function canUndo() {
  return history.past.length > 0;
}

export function canRedo() {
  return history.future.length > 0;
}

export function clearHistory() {
  history.past.length = 0;
  history.future.length = 0;
  history.dragSnapshot = null;
}
