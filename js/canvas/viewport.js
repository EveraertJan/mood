/*
 * TASTBAAR moodboard — viewport transforms.
 *
 * Exposes screenToBoard / boardToScreen. All interaction code goes through them.
 *
 * Every board keeps its own view. The live view is held here per board id and
 * mirrored into board.viewport, so it is autosaved and exported; undo does not
 * move the view because the map below outlives a document swap.
 */

import { getCurrentBoard } from "../state/store.js";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const views = new Map(); // boardId -> { x, y, zoom }

export function getViewport() {
  const board = getCurrentBoard();
  if (!board) return { x: 0, y: 0, zoom: 1 };
  let v = views.get(board.id);
  if (!v) {
    const saved = board.viewport || {};
    v = {
      x: Number.isFinite(saved.x) ? saved.x : 0,
      y: Number.isFinite(saved.y) ? saved.y : 0,
      zoom: Number.isFinite(saved.zoom) ? clampZoom(saved.zoom) : 1
    };
    views.set(board.id, v);
  }
  board.viewport = { ...v };
  return v;
}

export function setViewport(patch) {
  const v = getViewport();
  Object.assign(v, patch);
  v.zoom = clampZoom(v.zoom);
  const board = getCurrentBoard();
  if (board) board.viewport = { ...v };
}

function clampZoom(z) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

export function screenToBoard(x, y) {
  const v = getViewport();
  return {
    x: (x - v.x) / v.zoom,
    y: (y - v.y) / v.zoom
  };
}

export function boardToScreen(x, y) {
  const v = getViewport();
  return {
    x: x * v.zoom + v.x,
    y: y * v.zoom + v.y
  };
}

/** Zoom by a factor, keeping the board point under (x, y) where it is. */
export function zoomBy(x, y, factor) {
  const v = getViewport();
  const zoom = clampZoom(v.zoom * factor);
  const scale = zoom / v.zoom;
  setViewport({
    x: x - (x - v.x) * scale,
    y: y - (y - v.y) * scale,
    zoom
  });
}

/** One zoom step in (delta > 0) or out, centred on (x, y). */
export function zoomAt(x, y, delta) {
  zoomBy(x, y, delta > 0 ? 1.2 : 1 / 1.2);
}

export function zoomToFit(bounds, padding = 80) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const zoom = clampZoom(Math.min(vw / (bounds.w + padding * 2), vh / (bounds.h + padding * 2), 1));
  setViewport({
    zoom,
    x: (vw - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: (vh - bounds.h * zoom) / 2 - bounds.y * zoom
  });
}

export function resetZoom() {
  const v = getViewport();
  zoomBy(window.innerWidth / 2, window.innerHeight / 2, 1 / v.zoom);
}

export function applyTransform(el) {
  const v = getViewport();
  el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  el.style.transformOrigin = "0 0";
}
