/*
 * TASTBAAR moodboard — BOARD card.
 *
 * A window whose body shows a miniature of the nested board (redrawn when that
 * board changes), with the meta tab "OPEN". Double-click opens the board
 * (canvas/edit.js).
 */

import { buildBar, updateBar } from "./common.js";
import { getDoc } from "../state/store.js";

export const board = {
  type: "board",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--board";
    el.dataset.type = "board";
    el.appendChild(buildBar(card));

    const body = document.createElement("div");
    body.className = "card__body";

    const mini = document.createElement("div");
    mini.className = "board__mini";

    body.appendChild(mini);
    el.appendChild(body);

    el.__mini = mini;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const meta = el.querySelector(".card__meta");
    if (meta && meta.textContent !== "Open") meta.textContent = "Open";
    drawMini(el.__mini, card.data.boardId);
  }
};

/** Draw a simplified map of a nested board into the miniature element. */
export function drawMini(mini, boardId) {
  if (!mini) return;
  const doc = getDoc();
  const target = doc.boards.find(b => b.id === boardId);
  if (!target) {
    mini.replaceChildren();
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.style.position = "static";
    empty.style.padding = "20px";
    empty.textContent = "EMPTY";
    mini.appendChild(empty);
    return;
  }
  const cards = target.cards.filter(c => !c.parentColumnId);
  const frag = document.createDocumentFragment();
  if (!cards.length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.style.position = "static";
    empty.style.padding = "20px";
    empty.textContent = "EMPTY";
    frag.appendChild(empty);
  } else {
    const minX = Math.min(...cards.map(c => c.x));
    const minY = Math.min(...cards.map(c => c.y));
    const maxX = Math.max(...cards.map(c => c.x + c.w));
    const maxY = Math.max(...cards.map(c => c.y + c.h));
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    for (const c of cards) {
      const s = document.createElement("span");
      s.style.left = `${((c.x - minX) / w) * 100}%`;
      s.style.top = `${((c.y - minY) / h) * 100}%`;
      s.style.width = `${Math.max(4, (c.w / w) * 100)}%`;
      s.style.height = `${Math.max(4, (c.h / h) * 100)}%`;
      s.style.background = c.type === "heading" ? "transparent" : "var(--paper)";
      frag.appendChild(s);
    }
  }
  mini.replaceChildren(frag);
}
