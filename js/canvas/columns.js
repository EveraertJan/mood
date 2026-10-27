/*
 * TASTBAAR moodboard — dragging cards into and out of columns.
 *
 * A column's children are ordinary cards with parentColumnId set; their z
 * gives the order of the list. Drop a card on a column to slot it in where
 * the pointer is; drag it out and it continues from where it was on screen.
 */

import { getCurrentBoard } from "../state/store.js";
import { screenToBoard, getViewport } from "./viewport.js";
import { getCardElement } from "./render.js";

/** The column under the pointer, if the dragged cards could go in it. */
export function columnUnder(clientX, clientY, ids) {
  const board = getCurrentBoard();
  const moving = board.cards.filter(c => ids.has(c.id));
  if (moving.some(c => c.type === "column")) return null;
  const p = screenToBoard(clientX, clientY);
  const columns = board.cards
    .filter(c => c.type === "column" && !ids.has(c.id) && !c.data?.collapsed)
    .sort((a, b) => (b.z || 0) - (a.z || 0));
  return columns.find(c => {
    const el = getCardElement(c.id);
    const h = el ? el.offsetHeight : c.h;
    return p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + h;
  }) || null;
}

/** Show which column a drop would land in (null clears it). */
export function highlightColumn(column) {
  for (const el of document.querySelectorAll(".card--column.is-drop-target")) {
    if (el.dataset.id !== column?.id) el.classList.remove("is-drop-target");
  }
  if (column) getCardElement(column.id)?.classList.add("is-drop-target");
}

/** Put the dropped cards into the column under the pointer, in list order. */
export function dropIntoColumn(cardIds, clientX, clientY) {
  const board = getCurrentBoard();
  const ids = new Set(cardIds);
  const column = columnUnder(clientX, clientY, ids);
  if (!column) return;

  const kids = board.cards
    .filter(c => c.parentColumnId === column.id && !ids.has(c.id))
    .sort((a, b) => (a.z || 0) - (b.z || 0));
  let index = kids.findIndex(k => {
    const r = getCardElement(k.id)?.getBoundingClientRect();
    return r && clientY < r.top + r.height / 2;
  });
  if (index === -1) index = kids.length;
  const moving = cardIds.map(id => board.cards.find(c => c.id === id)).filter(Boolean);
  for (const card of moving) card.parentColumnId = column.id;
  [...kids.slice(0, index), ...moving, ...kids.slice(index)].forEach((c, i) => { c.z = i + 1; });
}

/** Cards dragged out of a column start from where they are on screen. */
export function liftOutOfColumns(ids) {
  const board = getCurrentBoard();
  for (const id of ids) {
    const card = board.cards.find(c => c.id === id);
    if (!card?.parentColumnId) continue;
    const rect = getCardElement(id)?.getBoundingClientRect();
    if (rect) {
      const p = screenToBoard(rect.left, rect.top);
      const zoom = getViewport().zoom;
      card.x = p.x;
      card.y = p.y;
      card.w = rect.width / zoom;
      card.h = Math.max(card.h, rect.height / zoom);
    }
    card.parentColumnId = null;
    card.z = board.cards.reduce((m, c) => Math.max(m, c.z || 0), 0) + 1;
  }
}
