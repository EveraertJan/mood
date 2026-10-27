/*
 * TASTBAAR moodboard — NOTE card.
 *
 * A label tab plus a rich-text body. Edited through contenteditable with a
 * floating format bar (white, shadow, uppercase B / I / U / LIST / LINK).
 */

import { buildBar, updateBar, makeEditable, sanitizeHTML, patchData, dataOf } from "./common.js";
import { attachFormatBar } from "./formatbar.js";

export const note = {
  type: "note",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--note";
    el.dataset.type = "note";
    el.appendChild(buildBar(card));

    const body = document.createElement("div");
    body.className = "card__body card__body--edit";
    body.innerHTML = card.data.html || "<p><br></p>";
    el.appendChild(body);

    el.__noteBody = body;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const body = el.__noteBody;
    if (!body) return;
    if (document.activeElement !== body && body.innerHTML !== (card.data.html || "")) {
      body.innerHTML = card.data.html || "<p><br></p>";
    }
    markEmpty(body);
  },

  /** Wire up editing once the card is in the DOM. */
  mount(el, card) {
    const body = el.__noteBody;
    if (!body || body.__mounted) return;
    body.__mounted = true;
    attachFormatBar(body);
    makeEditable(body, (html) => {
      markEmpty(body);
      patchData(card.id, { html: sanitizeHTML(html) });
    }, { placeholder: "Write something" });
  }
};

/** An empty note shows its placeholder (an empty <p> is not :empty). */
function markEmpty(body) {
  body.classList.toggle("is-empty", !body.textContent.trim() && !body.querySelector("li, .rule"));
}
