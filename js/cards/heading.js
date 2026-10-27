/*
 * TASTBAAR moodboard — HEADING card.
 *
 * A large --display 800 text with -0.075em tracking. No card background or
 * shadow, just type on paper.
 */

import { updateBar, buildBar, makeEditable, patchData, dataOf } from "./common.js";

export const heading = {
  type: "heading",

  create(card) {
    const el = document.createElement("div");
    el.className = "card card--heading";
    el.dataset.type = "heading";
    el.appendChild(buildBar(card));

    const text = document.createElement("div");
    text.className = "heading__text";
    text.textContent = card.data.text || "";

    el.appendChild(text);
    el.__text = text;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    if (el.__text && document.activeElement !== el.__text && el.__text.textContent !== (card.data.text || "")) {
      el.__text.textContent = card.data.text || "";
    }
  },

  mount(el, card) {
    const text = el.__text;
    if (!text || text.__mounted) return;
    text.__mounted = true;
    makeEditable(text, (html) => {
      patchData(card.id, { text: html.replace(/<[^>]*>/g, "") });
    }, { plain: true, placeholder: "Heading" });
  }
};
