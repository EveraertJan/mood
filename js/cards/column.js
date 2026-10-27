/*
 * TASTBAAR moodboard — COLUMN card.
 *
 * A group, not a window: a faint dotted outline (no paper, no shadow) with a
 * label tab. Cards dropped on it snap into a
 * vertical list with 10px gaps and can be reordered. Collapsing it shows only
 * the label tab plus a count.
 *
 * Children are stored on the board as normal cards with parentColumnId set to
 * the column's id; the renderer moves them into the column's list element.
 */

import { buildBar, updateBar } from "./common.js";

export const column = {
  type: "column",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--column";
    el.dataset.type = "column";
    el.appendChild(buildBar(card));

    const body = document.createElement("div");
    body.className = "card__body";

    const list = document.createElement("div");
    list.className = "column__list";

    body.appendChild(list);
    el.appendChild(body);

    el.__list = list;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const meta = el.querySelector(".card__meta");
    const count = el.__count ?? "";
    if (meta && !meta.isContentEditable) {
      const text = card.data.collapsed ? count : (card.meta || "");
      if (meta.textContent !== text) meta.textContent = text;
    }
    el.classList.toggle("is-collapsed", !!card.data.collapsed);
    const list = el.__list;
    if (list) list.hidden = !!card.data.collapsed;
  },

  /** Called by the renderer to publish the number of children. */
  setCount(el, count) {
    el.__count = String(count);
    const meta = el.querySelector(".card__meta");
    if (meta && el.classList.contains("is-collapsed")) {
      meta.textContent = String(count);
    }
  }
};
