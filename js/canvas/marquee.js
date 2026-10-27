/*
 * TASTBAAR moodboard — the selection marquee.
 *
 * A 1px dashed ink rectangle with no fill, drawn in board coordinates inside
 * the transformed layer. interact.js tracks the drag; this draws it and
 * selects what it touches (shift adds to the selection).
 */

import { getCurrentBoard, getState, setSelection } from "../state/store.js";
import { getViewport } from "./viewport.js";
import { drawGuides } from "./snap.js";

/** Draw the marquee rectangle {x, y, w, h} into its layer. */
export function drawMarquee(layer, rect) {
  if (!layer) return;
  let el = layer.firstElementChild;
  if (!el) {
    el = document.createElement("div");
    el.className = "marquee";
    layer.appendChild(el);
  }
  // keep the dashed line 1px at any zoom
  el.style.borderWidth = `${1 / getViewport().zoom}px`;
  el.style.left = `${rect.x}px`;
  el.style.top = `${rect.y}px`;
  el.style.width = `${rect.w}px`;
  el.style.height = `${rect.h}px`;
}

export function clearMarquee(layers) {
  layers.marqueeLayer?.replaceChildren();
  drawGuides(layers.guideLayer, []);
}

/** Select the top-level cards the rectangle touches. */
export function selectInMarquee(rect, add) {
  const ids = getCurrentBoard().cards
    .filter(c => !c.parentColumnId)
    .filter(c => c.x < rect.x + rect.w && c.x + c.w > rect.x &&
                 c.y < rect.y + rect.h && c.y + c.h > rect.y)
    .map(c => c.id);
  const sel = getState().selection;
  setSelection(add ? [...new Set([...sel.cards, ...ids])] : ids, add ? [...sel.connectors] : []);
}
