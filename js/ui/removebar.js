/*
 * TASTBAAR moodboard — the REMOVE button above a selected card.
 *
 * Touch screens have no Delete key and a long-press menu is easy to miss, so
 * a selected card (or the selection, if there are several) gets a black
 * REMOVE button centred right above it. It follows the card while it is
 * dragged, panned or zoomed, steps aside while text is being edited, and
 * stays under the toolbar when the card is at the top of the screen.
 *
 * render() calls update() through setAfterRender() in main.js.
 */

import { getState, deleteCards } from "../state/store.js";
import { push } from "../state/history.js";
import { getCardElement } from "../canvas/render.js";
import { toast } from "./dialogs.js";

const GAP = 8;        // between the button and the card
const EDITING = "[contenteditable='true'], [contenteditable='plaintext-only'], input, textarea";

let btn = null;

export function initRemoveBar() {
  btn = document.createElement("button");
  btn.type = "button";
  btn.className = "remove-btn";
  btn.textContent = "Remove";
  btn.hidden = true;
  btn.setAttribute("aria-label", "Remove the selected card");
  // the paper must not see this press as a click on empty paper (it would deselect first)
  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  btn.addEventListener("click", () => {
    const ids = [...getState().selection.cards];
    if (!ids.length) return;
    push("delete");
    deleteCards(ids);
    toast(`${ids.length} card${ids.length > 1 ? "s" : ""} deleted`);
  });
  document.body.appendChild(btn);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => setTimeout(update, 0));
  window.addEventListener("resize", update);
}

export function update() {
  if (!btn) return;
  const ids = [...getState().selection.cards];
  const editing = document.activeElement?.closest?.(EDITING);
  const dialogOpen = !document.getElementById("backdrop")?.hidden;

  let box = null;
  if (ids.length && !editing && !dialogOpen) {
    for (const id of ids) {
      const el = getCardElement(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      box = box
        ? { l: Math.min(box.l, r.left), t: Math.min(box.t, r.top), r: Math.max(box.r, r.right), b: Math.max(box.b, r.bottom) }
        : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
  }
  if (!box) { btn.hidden = true; return; }

  btn.hidden = false;
  const toolbarBottom = document.getElementById("toolbar")?.getBoundingClientRect().bottom ?? 44;
  const h = btn.offsetHeight || 30;
  const w = btn.offsetWidth || 80;
  const x = Math.min(Math.max((box.l + box.r) / 2, w / 2 + 8), window.innerWidth - w / 2 - 8);
  const y = Math.max(box.t - GAP - h, toolbarBottom + 6);
  btn.style.left = `${Math.round(x)}px`;
  btn.style.top = `${Math.round(y)}px`;
}
