/*
 * TASTBAAR moodboard — central state store.
 *
 * Single state object, pure action functions, subscribe(listener).
 */

import { createEmptyDoc, generateId } from "./schema.js";

const listeners = new Set();
let state = {
  doc: createEmptyDoc(),
  currentBoardId: null,
  selection: { cards: new Set(), connectors: new Set() },
  clipboard: null,
  history: null
};

function notify() {
  for (const fn of listeners) {
    try { fn(getState()); } catch (e) { console.error(e); }
  }
}

export function getState() {
  return state;
}

export function getDoc() {
  return state.doc;
}

export function getCurrentBoard() {
  const board = state.doc.boards.find(b => b.id === state.currentBoardId);
  return board || state.doc.boards[0] || null;
}

export function setDoc(doc, currentBoardId = state.currentBoardId) {
  state.doc = doc;
  state.currentBoardId = doc.boards.some(b => b.id === currentBoardId)
    ? currentBoardId
    : doc.boards[0]?.id ?? null;
  state.selection = { cards: new Set(), connectors: new Set() };
  notify();
}

export function setCurrentBoard(id) {
  if (state.doc.boards.find(b => b.id === id)) {
    state.currentBoardId = id;
    state.selection = { cards: new Set(), connectors: new Set() };
    notify();
  }
}

/** Tell listeners about a change made in place (drag, nudge, toggles). */
export function touch() {
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addCard(card) {
  const board = getCurrentBoard();
  if (!board) return;
  if (!card.id) card.id = generateId();
  // Assign z
  const maxZ = board.cards.reduce((m, c) => Math.max(m, c.z || 0), 0);
  card.z = maxZ + 1;
  board.cards.push(card);
  notify();
}

export function updateCard(id, patch) {
  const board = getCurrentBoard();
  if (!board) return;
  const card = board.cards.find(c => c.id === id);
  if (!card) return;
  // a locked card only accepts changes to its lock and colour
  if (card.locked && Object.keys(patch).some(k => k !== "locked" && k !== "color")) return;
  Object.assign(card, patch);
  notify();
}

export function moveCards(ids, dx, dy) {
  const board = getCurrentBoard();
  if (!board) return;
  for (const id of ids) {
    const card = board.cards.find(c => c.id === id);
    if (card && !card.locked) {
      card.x += dx;
      card.y += dy;
    }
  }
  notify();
}

export function deleteCards(ids) {
  const board = getCurrentBoard();
  if (!board) return;
  const set = new Set(ids);
  // a column takes its children with it
  for (const c of board.cards) {
    if (c.parentColumnId && set.has(c.parentColumnId)) set.add(c.id);
  }
  board.cards = board.cards.filter(c => !set.has(c.id));
  // Remove connectors
  board.connectors = board.connectors.filter(c => !set.has(c.from) && !set.has(c.to));
  // Clear selection
  for (const id of set) state.selection.cards.delete(id);
  notify();
}

export function deleteConnectors(ids) {
  const board = getCurrentBoard();
  if (!board) return;
  const set = new Set(ids);
  board.connectors = board.connectors.filter(c => !set.has(c.id));
  for (const id of ids) state.selection.connectors.delete(id);
  notify();
}

export function updateConnector(id, patch) {
  const board = getCurrentBoard();
  const conn = board?.connectors.find(c => c.id === id);
  if (!conn) return;
  Object.assign(conn, patch);
  notify();
}

/** The live card with this id on the current board (handlers must not keep stale copies). */
export function findCard(id) {
  return getCurrentBoard()?.cards.find(c => c.id === id) || null;
}

export function bringForward(ids) {
  const board = getCurrentBoard();
  if (!board) return;
  const maxZ = board.cards.reduce((m, c) => Math.max(m, c.z || 0), 0);
  for (const id of ids) {
    const card = board.cards.find(c => c.id === id);
    if (card) card.z = maxZ + 1;
  }
  notify();
}

export function sendBack(ids) {
  const board = getCurrentBoard();
  if (!board) return;
  const minZ = board.cards.reduce((m, c) => Math.min(m, c.z || 0), 0);
  for (const id of ids) {
    const card = board.cards.find(c => c.id === id);
    if (card) card.z = minZ - 1;
  }
  notify();
}

export function setSelection(cardIds = [], connectorIds = []) {
  state.selection.cards = new Set(cardIds);
  state.selection.connectors = new Set(connectorIds);
  notify();
}

export function toggleSelection(cardId) {
  if (state.selection.cards.has(cardId)) {
    state.selection.cards.delete(cardId);
  } else {
    state.selection.cards.add(cardId);
  }
  notify();
}

export function clearSelection() {
  state.selection.cards.clear();
  state.selection.connectors.clear();
  notify();
}

export function addConnector(connector) {
  const board = getCurrentBoard();
  if (!board) return;
  if (!connector.id) connector.id = generateId();
  board.connectors.push(connector);
  notify();
}

export function updateBoard(patch) {
  const board = getCurrentBoard();
  if (!board) return;
  Object.assign(board, patch);
  notify();
}

export function addBoard(board) {
  if (!board.id) board.id = generateId();
  state.doc.boards.push(board);
  notify();
}

export function removeBoard(id, force = false) {
  if (!force && state.doc.boards.length <= 1) return;
  state.doc.boards = state.doc.boards.filter(b => b.id !== id);
  if (state.currentBoardId === id) {
    state.currentBoardId = state.doc.boards[0]?.id ?? null;
  }
  notify();
}
