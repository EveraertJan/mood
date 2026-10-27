/*
 * TASTBAAR moodboard — keyboard shortcuts.
 *
 * Undo/redo, delete, duplicate, select all, arrow nudge (1px, 10px with
 * shift), N note, T to-do, H heading, G grid, zoom, Esc. Shortcuts are off
 * while typing in a card.
 */

import {
  getState, getCurrentBoard, setSelection, clearSelection, deleteCards, deleteConnectors, touch
} from "../state/store.js";
import { push } from "../state/history.js";
import { setViewport, zoomAt, zoomToFit, resetZoom } from "../canvas/viewport.js";
import { addCardOfType, doUndo, doRedo } from "./toolbar.js";
import { dialog, toast } from "./dialogs.js";
import { copySelection, cutSelection, duplicateCards } from "./clipboard.js";

let handlers = {};

export function initShortcuts(callbacks = {}) {
  handlers = callbacks;
  window.addEventListener("keydown", onKeyDown);
}

function isTyping(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function onKeyDown(e) {
  const mod = e.metaKey || e.ctrlKey;

  if (isTyping(e.target)) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  if (!document.getElementById("backdrop")?.hidden) return; // a dialog is open

  // Shortcuts overlay
  if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
    e.preventDefault();
    showShortcuts();
    return;
  }

  if (mod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (e.shiftKey) doRedo(); else doUndo();
    return;
  }
  if (mod && e.key.toLowerCase() === "y") {
    e.preventDefault();
    doRedo();
    return;
  }
  if (mod && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicateSelection();
    return;
  }
  if (mod && e.key.toLowerCase() === "a") {
    e.preventDefault();
    selectAll();
    return;
  }
  // Cmd+C / X act on selected cards when no text is selected; paste arrives
  // as a paste event (main.js), which also carries images and URLs.
  const textSelected = !window.getSelection()?.isCollapsed;
  if (mod && e.key.toLowerCase() === "c" && !textSelected) {
    if (getState().selection.cards.size) e.preventDefault();
    copySelection();
    return;
  }
  if (mod && e.key.toLowerCase() === "x" && !textSelected) {
    if (getState().selection.cards.size) e.preventDefault();
    cutSelection();
    return;
  }

  if (mod || e.altKey) return; // leave the browser's own shortcuts alone

  switch (e.key) {
    case "Delete":
    case "Backspace":
      e.preventDefault();
      deleteSelection();
      break;
    case "Escape":
      clearSelection();
      break;
    case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
      e.preventDefault();
      nudge(e);
      break;
    case "+": case "=":
      e.preventDefault();
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1);
      touch();
      break;
    case "-": case "_":
      e.preventDefault();
      zoomAt(window.innerWidth / 2, window.innerHeight / 2, -1);
      touch();
      break;
    case "0":
      e.preventDefault();
      fitToContent();
      break;
    case "1":
      e.preventDefault();
      resetZoom();
      touch();
      break;
    default:
      break;
  }

  const key = e.key.toLowerCase();
  if (key === "n") { e.preventDefault(); addCardOfType("note"); }
  else if (key === "t") { e.preventDefault(); addCardOfType("todo"); }
  else if (key === "h") { e.preventDefault(); addCardOfType("heading"); }
  else if (key === "g") { e.preventDefault(); handlers.onToggleGrid?.(); }
}

function selectedIds() {
  return [...getState().selection.cards];
}

function deleteSelection() {
  const ids = selectedIds();
  const connectors = [...getState().selection.connectors];
  if (!ids.length && !connectors.length) return;
  push("delete");
  if (connectors.length) deleteConnectors(connectors);
  if (ids.length) {
    deleteCards(ids);
    toast(`${ids.length} card${ids.length > 1 ? "s" : ""} deleted`);
  }
}

function duplicateSelection() {
  duplicateCards(selectedIds());
}

function selectAll() {
  const board = getCurrentBoard();
  if (!board) return;
  setSelection(board.cards.filter(c => !c.parentColumnId).map(c => c.id), []);
}

function nudge(e) {
  const ids = selectedIds();
  if (!ids.length) return;
  const step = e.shiftKey ? 10 : 1;
  const dx = (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0);
  const dy = (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0);
  push("nudge");
  for (const id of ids) {
    const board = getCurrentBoard();
    const card = board.cards.find(c => c.id === id);
    if (card && !card.locked) {
      card.x += dx;
      card.y += dy;
    }
  }
  touch();
}

export function fitToContent() {
  const board = getCurrentBoard();
  if (!board) return;
  const cards = board.cards.filter(c => !c.parentColumnId);
  if (!cards.length) {
    setViewport({ x: 0, y: 0, zoom: 1 });
    touch();
    return;
  }
  const minX = Math.min(...cards.map(c => c.x));
  const minY = Math.min(...cards.map(c => c.y));
  const maxX = Math.max(...cards.map(c => c.x + c.w));
  const maxY = Math.max(...cards.map(c => c.y + c.h));
  zoomToFit({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, 80);
  touch();
}

const SHORTCUTS = [
  ["Undo", "Cmd / Ctrl + Z"],
  ["Redo", "Cmd / Ctrl + Shift + Z"],
  ["Delete", "Delete or Backspace"],
  ["Duplicate", "Cmd / Ctrl + D"],
  ["Copy / cut / paste", "Cmd / Ctrl + C / X / V"],
  ["Select all", "Cmd / Ctrl + A"],
  ["Deselect", "Esc"],
  ["Nudge", "Arrow keys (1px, Shift = 10px)"],
  ["Note", "N"],
  ["To-do", "T"],
  ["Heading", "H"],
  ["Toggle grid", "G"],
  ["Zoom in / out", "+ / -"],
  ["Zoom to fit", "0"],
  ["Zoom to 100%", "1"],
  ["Pan", "Space + drag, or scroll"],
  ["Zoom with the mouse", "Cmd / Ctrl + scroll, or pinch"],
  ["Snap off", "Hold Alt while dragging"],
  ["This list", "?"]
];

export function showShortcuts() {
  const body = document.createElement("div");
  const list = document.createElement("dl");
  list.className = "shortcuts";
  for (const [name, keys] of SHORTCUTS) {
    const dt = document.createElement("dt");
    dt.textContent = name;
    const dd = document.createElement("dd");
    dd.textContent = keys;
    list.append(dt, dd);
  }
  body.appendChild(list);
  dialog({ title: "Shortcuts", body, width: "420px" });
}
