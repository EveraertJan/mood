/*
 * TASTBAAR moodboard — pointer interaction on the canvas.
 *
 * Handles: click to select, shift-click to extend, marquee select, card drag
 * (5px threshold, like scripts/windows.js), resize handles, snapping (hold alt
 * to turn it off), dropping cards into columns, selecting connectors, panning,
 * zooming and the double-click shortcut that adds a note on empty paper.
 *
 * A click selects a card, a drag moves it; double-click changes what is under
 * the pointer (edit.js). Buttons, checkboxes, inputs and links inside a card
 * work as normal, and so does text that is being edited.
 */

import {
  getCurrentBoard, getState, setSelection, toggleSelection, clearSelection, addCard, touch
} from "../state/store.js";
import { screenToBoard, getViewport, setViewport, zoomBy } from "./viewport.js";
import { render, getCardElement } from "./render.js";
import { snapMove, snapResize, drawGuides } from "./snap.js";
import { push, beginDrag, endDrag, cancelDrag } from "../state/history.js";
import { MIN_SIZE } from "../cards/index.js";
import { createCard } from "../state/schema.js";
import { editCard } from "./edit.js";
import { columnUnder, highlightColumn, dropIntoColumn, liftOutOfColumns } from "./columns.js";
import { startLongPress, cancelLongPress } from "./longpress.js";
import { drawMarquee, clearMarquee, selectInMarquee } from "./marquee.js";

const DRAG_THRESHOLD = 5;
const INTERACTIVE = "a, button, input, select, textarea, label, .swatch__hex, .card__handle";

let paper = null;
let layers = null;
let spaceDown = false;

let mode = null; // 'drag' | 'resize' | 'marquee' | 'pan'
let start = null;
let dragging = null; // { cardId, ids, origins, editable }
let resizing = null;
let marquee = null;
let lastClick = { t: 0, x: 0, y: 0 };

export function initInteract(dom) {
  paper = dom.paper;
  layers = dom;

  paper.addEventListener("pointerdown", onPointerDown);
  // some browsers still start a text selection (or move the focus) from the mousedown that follows
  paper.addEventListener("mousedown", (e) => {
    if (mode === "drag" || mode === "resize" || mode === "pan" || (!mode && e.detail > 1 && !e.target.closest(".card"))) e.preventDefault();
  });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  paper.addEventListener("wheel", onWheel, { passive: false });
  paper.addEventListener("contextmenu", onContextMenu);
  paper.addEventListener("dblclick", onDoubleClick);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isTyping(e.target)) {
      e.preventDefault(); // no page scroll, no button press
      spaceDown = true;
      if (mode !== "pan") paper.style.cursor = "grab";
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceDown = false;
      if (mode !== "pan") paper.style.cursor = "";
    }
  });
  window.addEventListener("blur", () => { spaceDown = false; });
}

function isTyping(el) {
  return !!el?.closest?.("[contenteditable='true'], [contenteditable='plaintext-only'], input, textarea, select");
}

function onPointerDown(e) {
  if (e.button === 2) return; // context menu handled separately
  if (e.target.closest(".boards")) return; // the board list lives in the paper's layer
  if (e.pointerType === "touch") startLongPress(e, () => {
    if (mode === "drag" && dragging?.ids) return false; // already moving
    mode = null;
    dragging = null;
    marquee = null;
    clearMarquee(layers);
    return true;
  });

  if (e.button === 1 || spaceDown) {
    e.preventDefault();
    const v = getViewport();
    mode = "pan";
    start = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
    layers.paper.style.cursor = "grabbing";
    return;
  }
  if (e.button !== 0) return;

  const conn = e.target.closest("[data-connector-id]");
  if (conn) {
    const id = conn.dataset.connectorId;
    const sel = getState().selection;
    if (e.shiftKey) {
      setSelection([...sel.cards], sel.connectors.has(id)
        ? [...sel.connectors].filter(c => c !== id)
        : [...sel.connectors, id]);
    } else {
      setSelection([], [id]);
    }
    return;
  }

  const corner = e.target.closest(".card__corner");
  if (corner) {
    e.preventDefault();
    const cardEl = corner.closest(".card");
    const card = getCurrentBoard().cards.find(c => c.id === cardEl.dataset.id);
    if (!card || card.locked) return;
    beginDrag();
    mode = "resize";
    resizing = {
      card,
      corner: corner.dataset.corner,
      origin: { x: card.x, y: card.y, w: card.w, h: card.h },
      start: screenToBoard(e.clientX, e.clientY),
      changed: false
    };
    return;
  }

  const cardEl = e.target.closest(".card");
  if (cardEl) {
    if (e.target.closest(INTERACTIVE)) return; // native behaviour
    // text being edited: select text as normal
    if (e.target.closest("[contenteditable='true'], [contenteditable='plaintext-only']")) return;
    e.preventDefault(); // no text selection while it may become a drag
    document.activeElement?.blur?.();
    mode = "drag";
    start = { x: e.clientX, y: e.clientY };
    dragging = { cardId: cardEl.dataset.id, ids: null, origins: null };
    return;
  }

  // a double click on empty paper adds a note there
  if (isDoubleClick(e)) {
    e.preventDefault(); // keeps the focus in the new note
    mode = null;
    addNoteAt(e.clientX, e.clientY);
    return;
  }

  mode = "marquee";
  start = { x: e.clientX, y: e.clientY, shift: e.shiftKey };
  marquee = null;
}

/**
 * Double-click on empty paper adds a note there.
 *
 * The click timing is tracked by hand: the native dblclick event is not
 * delivered reliably in every browser (and not at all in some headless ones).
 */
function isDoubleClick(e) {
  const now = performance.now();
  const near = Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 5;
  if (now - lastClick.t < 400 && near) {
    lastClick.t = 0;
    return true;
  }
  lastClick = { t: now, x: e.clientX, y: e.clientY };
  return false;
}

/** Double-click a connector to give it a label. */
function onDoubleClick(e) {
  const conn = e.target.closest("[data-connector-id]");
  if (!conn) return;
  paper.dispatchEvent(new CustomEvent("moodboard:connector-label", {
    bubbles: true,
    detail: { id: conn.dataset.connectorId }
  }));
}

function addNoteAt(clientX, clientY) {
  const p = screenToBoard(clientX, clientY);
  push("add note");
  const card = createCard("note", Math.round(p.x / 8) * 8, Math.round(p.y / 8) * 8);
  card.h = 160;
  addCard(card);
  setSelection([card.id], []);
  editCard(card.id);
}

function onPointerMove(e) {
  cancelLongPress(e, DRAG_THRESHOLD);
  if (!mode) return;

  if (mode === "pan") {
    setViewport({ x: start.vx + (e.clientX - start.x), y: start.vy + (e.clientY - start.y) });
    render();
    return;
  }

  if (mode === "drag") {
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragging.ids) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      startDrag(e);
    }
    moveCards(e);
    return;
  }

  if (mode === "resize") {
    resizeCard(e);
    return;
  }

  if (mode === "marquee") {
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!marquee && Math.hypot(dx, dy) < 3) return;
    const a = screenToBoard(start.x, start.y);
    const b = screenToBoard(e.clientX, e.clientY);
    marquee = {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
    };
    drawMarquee(layers.marqueeLayer, marquee);
  }
}

function startDrag(e) {
  beginDrag();
  const state = getState();
  const board = getCurrentBoard();
  let ids = [...state.selection.cards];
  if (!ids.includes(dragging.cardId)) {
    ids = e.shiftKey ? [...ids, dragging.cardId] : [dragging.cardId];
  }
  // locked cards stay where they are
  ids = ids.filter(id => !board.cards.find(c => c.id === id)?.locked);

  liftOutOfColumns(ids);

  setSelection(ids, []);
  dragging.ids = ids;
  dragging.origins = ids.map(id => {
    const c = board.cards.find(x => x.id === id);
    return { id, x: c.x, y: c.y };
  });
  render();
  for (const id of ids) getCardElement(id)?.classList.add("is-dragging");
}

function onPointerUp(e) {
  cancelLongPress(e, DRAG_THRESHOLD);
  if (mode === "drag" && dragging) {
    if (dragging.ids) {
      finishDrag(e);
      endDrag();
      touch();
    } else if (e.type === "pointerup") {
      // a click, not a drag
      if (e.shiftKey) {
        toggleSelection(dragging.cardId);
      } else {
        setSelection([dragging.cardId], []);
      }
    }
    for (const el of document.querySelectorAll(".card.is-dragging")) {
      el.classList.remove("is-dragging");
    }
  } else if (mode === "resize" && resizing) {
    if (resizing.changed) {
      endDrag();
      touch();
    } else {
      cancelDrag();
    }
    drawGuides(layers.guideLayer, []);
  } else if (mode === "marquee") {
    if (marquee) {
      selectInMarquee(marquee, start.shift);
    } else if (!start.shift) {
      clearSelection();
    }
    clearMarquee(layers);
  } else if (mode === "pan") {
    layers.paper.style.cursor = spaceDown ? "grab" : "";
    touch(); // saves the view
  }

  mode = null;
  dragging = null;
  resizing = null;
  marquee = null;
}

function moveCards(e) {
  const board = getCurrentBoard();
  if (!dragging.origins.length) return;
  const zoom = getViewport().zoom;
  const ids = new Set(dragging.ids);
  const others = board.cards.filter(c => !ids.has(c.id) && !c.parentColumnId);
  const lead = dragging.origins[0];
  const leadCard = board.cards.find(c => c.id === lead.id);
  const target = {
    x: lead.x + (e.clientX - start.x) / zoom,
    y: lead.y + (e.clientY - start.y) / zoom,
    w: leadCard.w,
    h: leadCard.h
  };

  const snapped = e.altKey ? { x: target.x, y: target.y, guides: [] } : snapMove(target, others, zoom);
  const dx = snapped.x - lead.x;
  const dy = snapped.y - lead.y;

  for (const origin of dragging.origins) {
    const card = board.cards.find(c => c.id === origin.id);
    if (!card) continue;
    card.x = origin.x + dx;
    card.y = origin.y + dy;
  }
  drawGuides(layers.guideLayer, snapped.guides);
  highlightColumn(columnUnder(e.clientX, e.clientY, ids));
  render();
}

function finishDrag(e) {
  highlightColumn(null);
  drawGuides(layers.guideLayer, []);
  dropIntoColumn(dragging.ids, e.clientX, e.clientY);
}

function resizeCard(e) {
  const { card, corner, origin, start: startBoard } = resizing;
  const zoom = getViewport().zoom;
  const p = screenToBoard(e.clientX, e.clientY);
  const dx = p.x - startBoard.x;
  const dy = p.y - startBoard.y;
  const min = MIN_SIZE[card.type] || { w: 120, h: 60 };

  let w = origin.w;
  let h = origin.h;
  if (corner.includes("e")) w = origin.w + dx;
  if (corner.includes("s")) h = origin.h + dy;
  if (corner.includes("w")) w = origin.w - dx;
  if (corner.includes("n")) h = origin.h - dy;

  let guides = [];
  if (!e.altKey) {
    const x = corner.includes("w") ? origin.x + origin.w - w : origin.x;
    const y = corner.includes("n") ? origin.y + origin.h - h : origin.y;
    const others = getCurrentBoard().cards.filter(c => c.id !== card.id && !c.parentColumnId);
    const snapped = snapResize({ x, y, w, h }, corner, others, zoom);
    w = snapped.w;
    h = snapped.h;
    guides = snapped.guides;
  }

  if (e.shiftKey && card.type === "image" && origin.w && origin.h) {
    const ratio = origin.w / origin.h;
    if (Math.abs(w - origin.w) / origin.w > Math.abs(h - origin.h) / origin.h) h = w / ratio;
    else w = h * ratio;
    guides = [];
  }

  w = Math.max(min.w, Math.round(w));
  h = Math.max(min.h, Math.round(h));
  card.w = w;
  card.h = h;
  card.x = corner.includes("w") ? origin.x + origin.w - w : origin.x;
  card.y = corner.includes("n") ? origin.y + origin.h - h : origin.y;
  resizing.changed = true;
  drawGuides(layers.guideLayer, guides);
  render();
}

function onWheel(e) {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // pinch on a trackpad arrives as ctrl + wheel with small deltas
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomBy(e.clientX, e.clientY, Math.exp(-delta * 0.01));
  } else {
    const v = getViewport();
    setViewport({
      x: v.x - (e.shiftKey ? e.deltaY : e.deltaX),
      y: v.y - (e.shiftKey ? 0 : e.deltaY)
    });
  }
  touch();
}

function onContextMenu(e) {
  if (e.target.closest(".card, .boards")) return; // the card menu (contextmenu.js), the board list
  e.preventDefault();
  const conn = e.target.closest("[data-connector-id]");
  if (conn) {
    setSelection([], [conn.dataset.connectorId]);
  }
  paper.dispatchEvent(new CustomEvent("moodboard:contextmenu", {
    bubbles: true,
    detail: { x: e.clientX, y: e.clientY, connectorId: conn?.dataset.connectorId ?? null }
  }));
}
