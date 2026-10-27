/*
 * TASTBAAR moodboard — canvas renderer.
 *
 * Cards are absolutely positioned DOM elements inside one transformed layer.
 * Only cards that changed are re-rendered (keyed by id). The board title layer
 * stays outside the transform, fixed to the viewport.
 */

import { getType, MIN_SIZE } from "../cards/index.js";
import { setLocked } from "../cards/common.js";
import { getCurrentBoard, getDoc, getState } from "../state/store.js";
import { applyTransform, getViewport } from "./viewport.js";

const CORNERS = ["nw", "ne", "sw", "se"];
export const VERSION = "1.0";

const elements = new Map(); // cardId -> element
let layers = null;
let afterRender = null;

/** Something that follows the cards (the REMOVE button) runs after every render. */
export function setAfterRender(fn) { afterRender = fn; }
let options = { breathe: false, showTitle: true };

export function initRender(dom) {
  layers = dom;
  layers.paper.addEventListener("moodboard:refresh", () => render());
}

export function setRenderOptions(opts) {
  options = { ...options, ...opts };
}

export function getCardElement(id) {
  return elements.get(id) || null;
}

export function allCardElements() {
  return elements;
}

/** Colour helpers: the six accents plus ink. */
export const COLOR_CLASS = {
  ink: "",
  red: "card--red",
  green: "card--green",
  blue: "card--blue",
  yellow: "card--yellow",
  cyan: "card--cyan",
  magenta: "card--magenta"
};

/** A stable pseudo-random number per id, for breathing timings. */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function render() {
  if (!layers) return;
  const board = getCurrentBoard();
  if (!board) return;

  const doc = getDoc();
  const state = getState();
  const single = state.selection.cards.size === 1;

  // grid
  layers.paper.classList.toggle("has-grid", !!board.grid);

  // title
  const title = layers.title;
  title.textContent = board.name || "";
  title.hidden = !board.showTitle || !options.showTitle;
  // the name stands up along the right edge and runs a little longer than the screen:
  // the more letters, the smaller the type (4 letters = 100svh / 4.4)
  const divisor = Math.max(4.4, [...(board.name || "")].length * 0.45);
  title.style.setProperty("--title-size", `min(calc(100svh / ${divisor.toFixed(2)}), 34vw)`);
  // the tab names the board: "<board> — Mood"
  const tabTitle = `${board.name || "Untitled"} \u2014 Mood`;
  if (document.title !== tabTitle) document.title = tabTitle;

  // viewport transform on both layers
  applyTransform(layers.boardLayer);
  applyTransform(layers.connectorsLayer);
  const zoom = `${Math.round(getViewport().zoom * 100)}%`;
  if (layers.zoomValue) layers.zoomValue.textContent = zoom;
  if (layers.status) layers.status.textContent = `v${VERSION} · ${zoom}`;

  const seen = new Set();
  const children = board.cards.filter(c => c.parentColumnId);

  // top-level cards
  for (const card of board.cards) {
    if (card.parentColumnId) continue;
    seen.add(card.id);
    const el = ensureElement(card);
    position(el, card);
    el.style.zIndex = String(card.z || 0);
    el.classList.toggle("is-selected", state.selection.cards.has(card.id));
    el.classList.toggle("is-resizable", single && state.selection.cards.has(card.id) && !card.locked);
    el.classList.toggle("is-locked", !!card.locked);
    el.classList.toggle("is-breathing", options.breathe);
    if (options.breathe) {
      const h = hash(card.id);
      el.style.setProperty("--breathe", `${(6.5 + (h % 40) / 10).toFixed(1)}s`);
      el.style.setProperty("--breathe-delay", `${-((h % 80) / 10).toFixed(1)}s`);
    }
    getType(card.type).update(el, card);
    lock(el, card);
  }

  // column children — laid out in the column's list
  for (const column of board.cards.filter(c => c.type === "column")) {
    const colEl = elements.get(column.id);
    if (!colEl) continue;
    const list = colEl.__list;
    if (!list) continue;
    const kids = children.filter(c => c.parentColumnId === column.id);
    colEl.__count = String(kids.length);
    getType("column").setCount(colEl, kids.length);
    kids.sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const kid of kids) {
      seen.add(kid.id);
      const el = ensureElement(kid);
      el.classList.toggle("is-selected", state.selection.cards.has(kid.id));
      el.classList.toggle("is-locked", !!kid.locked);
      el.classList.toggle("is-breathing", options.breathe);
      el.style.position = "relative";
      el.style.left = "auto";
      el.style.top = "auto";
      el.style.width = "100%";
      el.style.height = "auto";
      el.style.minHeight = "60px";
      el.style.transform = "";
      el.classList.remove("is-resizable");
      setColorClass(el, kid);
      el.style.zIndex = String(kid.z || 0);
      getType(kid.type).update(el, kid);
      lock(el, kid);
      list.appendChild(el); // appending in z order keeps the list in order
    }
    // remove children that left the column
    for (const child of [...list.children]) {
      if (!kids.find(k => k.id === child.dataset.id)) {
        child.remove();
        elements.delete(child.dataset.id);
      }
    }
  }

  // remove cards that no longer exist
  for (const [id, el] of [...elements]) {
    if (!seen.has(id)) {
      el.remove();
      elements.delete(id);
    }
  }

  fitHeights(board);
  renderConnectors(board, state.selection.connectors);
  afterRender?.();
}

/**
 * Write the drawn height of cards that grow with their content back into the
 * state, so connectors, selection, snapping and the exports use the real size.
 * (Read in one pass after all writes, so the layout is computed only once.)
 */
function fitHeights(board) {
  const zoomless = [];
  for (const card of board.cards) {
    if (card.type === "image" && !card.parentColumnId) continue;
    const el = elements.get(card.id);
    if (el) zoomless.push([card, el]);
  }
  for (const [card, el] of zoomless) {
    const h = el.offsetHeight; // layout px are board px: the zoom is a transform
    if (h && Math.abs(h - card.h) >= 1) card.h = h;
  }
}

function lock(el, card) {
  const locked = !!card.locked;
  if (el.__locked !== locked) {
    el.__locked = locked;
    setLocked(el, locked);
  }
}

function ensureElement(card) {
  let el = elements.get(card.id);
  if (!el) {
    const type = getType(card.type);
    el = type.create(card);
    el.dataset.id = card.id;
    el.dataset.type = card.type;
    elements.set(card.id, el);
    addHandles(el, card);
    layers.boardLayer.appendChild(el);
    type.mount?.(el, card);
  }
  return el;
}

function position(el, card) {
  const min = MIN_SIZE[card.type] || { w: 120, h: 60 };
  el.style.position = "absolute";
  el.style.left = `${card.x}px`;
  el.style.top = `${card.y}px`;
  el.style.width = `${Math.max(min.w, card.w)}px`;
  // an image keeps the size it was given; every other card grows to fit its content
  if (card.type === "image") {
    el.style.height = `${Math.max(min.h, card.h)}px`;
    el.style.minHeight = "";
  } else {
    el.style.height = "auto";
    el.style.minHeight = card.type === "heading" ? "" : `${Math.max(min.h, card.h)}px`;
  }
  el.style.transform = card.rotation ? `rotate(${card.rotation}deg)` : "";
  setColorClass(el, card);
}

function setColorClass(el, card) {
  const cls = COLOR_CLASS[card.color] || "";
  for (const name of Object.values(COLOR_CLASS)) {
    if (name) el.classList.toggle(name, name === cls);
  }
}

/** Resize corners (shown on a single selected card) and the connector handle. */
function addHandles(el, card) {
  const resize = document.createElement("div");
  resize.className = "card__resize";
  for (const c of CORNERS) {
    const corner = document.createElement("span");
    corner.className = `card__corner card__corner--${c}`;
    corner.dataset.corner = c;
    resize.appendChild(corner);
  }
  const handle = document.createElement("span");
  handle.className = "card__handle";
  handle.dataset.connectorHandle = card.id;
  handle.title = "Drag to connect";
  el.append(resize, handle);
}

/** Draw the connectors of a board into the SVG layer. */
export function renderConnectors(board, selected = new Set()) {
  const svg = layers.connectorsLayer;
  if (!svg) return;
  const boardCards = new Map(board.cards.map(c => [c.id, c]));
  const parts = [];
  for (const conn of board.connectors) {
    const from = boardCards.get(conn.from);
    const to = boardCards.get(conn.to);
    // cards inside a column have no free position to connect to
    if (!from || !to || from.parentColumnId || to.parentColumnId) continue;
    const p1 = anchor(from, to);
    const p2 = anchor(to, from);
    const sel = selected.has(conn.id) ? " is-selected" : "";
    const cls = `connector${conn.style === "dashed" ? " is-dashed" : ""}${sel}`;
    const d = `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`;
    parts.push(`<g data-connector-id="${conn.id}">`);
    parts.push(`<path class="connector__hit" d="${d}"/>`);
    parts.push(`<path class="${cls}" d="${d}"/>`);
    if (conn.arrow === "end" || conn.arrow === "both") parts.push(arrow(p2, p1, sel));
    if (conn.arrow === "both") parts.push(arrow(p1, p2, sel));
    if (conn.label) {
      const text = String(conn.label).toUpperCase();
      const w = text.length * 8.4 + 12; // Courier Prime 14px is 8.4px a character
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      parts.push(
        `<rect class="connector__tab" x="${mx - w / 2}" y="${my - 11}" width="${w}" height="22"/>` +
        `<text class="connector__text" x="${mx}" y="${my + 4}" text-anchor="middle">${escapeXML(text)}</text>`
      );
    }
    parts.push("</g>");
  }
  svg.innerHTML = parts.join("");

  function arrow(tip, from, sel) {
    const dx = tip.x - from.x;
    const dy = tip.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const size = 10;
    const a = { x: tip.x - ux * size - uy * size * 0.6, y: tip.y - uy * size + ux * size * 0.6 };
    const b = { x: tip.x - ux * size + uy * size * 0.6, y: tip.y - uy * size - ux * size * 0.6 };
    return `<path class="connector${sel}" d="M${a.x} ${a.y} L${tip.x} ${tip.y} L${b.x} ${b.y}"/>`;
  }
}

/** Anchor point on the edge of a card, pointing towards the other card. */
export function anchor(card, other) {
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const ox = other.x + other.w / 2;
  const oy = other.y + other.h / 2;
  const dx = ox - cx;
  const dy = oy - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? card.x + card.w : card.x, y: cy };
  }
  return { x: cx, y: dy > 0 ? card.y + card.h : card.y };
}

function escapeXML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
