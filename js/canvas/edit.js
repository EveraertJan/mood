/*
 * TASTBAAR moodboard — double-click to change.
 *
 * One click selects a card (and a drag moves it). A double-click changes
 * whatever is under the pointer:
 *
 *  - card text (note, heading, caption, link title and description, swatch
 *    name): edit it, with the caret where you clicked;
 *  - the label tab (or the empty bar where it would be): rename it inline,
 *    with the seven label colours to pick from underneath;
 *  - the meta tab: edit it (on a link: the URL);
 *  - a swatch's colour block or hex: the colour picker;
 *  - an image: pick a new image file;
 *  - a board card: open that board; a column's empty body: fold it;
 *  - empty paper: a new note (interact.js); a connector: its label.
 *
 * Text is only editable while it is being edited, so a single click never
 * drops a caret by accident. One editing session is one undo step.
 */

import { getDoc, findCard, updateCard, touch } from "../state/store.js";
import { beginDrag, endDrag, cancelDrag, push } from "../state/history.js";
import { getCardElement } from "./render.js";
import { patchData, dataOf, selectContents } from "../cards/common.js";
import { promptDialog, toast } from "../ui/dialogs.js";

const EDITABLE = "[data-editable]";
const COLORS = ["ink", "red", "green", "blue", "yellow", "cyan", "magenta"];

let handlers = {};

export function initEdit(dom, callbacks = {}) {
  handlers = callbacks;
  dom.paper.addEventListener("dblclick", (e) => {
    const cardEl = e.target.closest(".board-layer .card");
    if (!cardEl) return;
    e.preventDefault();
    const card = findCard(cardEl.dataset.id);
    if (!card) return;
    changeAt(card, cardEl, e.target, e.clientX, e.clientY);
  });
}

function changeAt(card, cardEl, target, x, y) {
  // a card inside a column answers for itself, not for the column
  const own = (sel) => {
    const hit = target.closest(sel);
    return hit && hit.closest(".card") === cardEl ? hit : null;
  };

  if (card.type === "board" && !own(".card__bar")) {
    if (card.data.boardId) handlers.onOpenBoard?.(card.data.boardId);
    return;
  }
  if (card.locked) {
    toast("Locked: right-click to unlock");
    return;
  }
  if (own(".card__meta")) return editMeta(card, cardEl);
  if (own(".card__bar")) return editLabel(card, cardEl);
  if (own(".swatch__chip, .swatch__hex")) return pickColor(card);
  if (own(".card__img")) return handlers.onReplaceImage?.(card.id);
  const text = own(EDITABLE);
  if (text) return editText(text, x, y);
  if (card.type === "column" && own(".card__body")) {
    push("collapse");
    patchData(card.id, { collapsed: !card.data.collapsed });
    return;
  }
  // anywhere else on a text card: edit its first text
  const first = [...cardEl.querySelectorAll(EDITABLE)].find(n => n.closest(".card") === cardEl);
  if (first) editText(first, x, y);
}

/** Start editing a card's text; with no point, the caret goes to the end. */
export function editCard(id, { selectAll = false } = {}) {
  const el = getCardElement(id);
  const first = el && [...el.querySelectorAll(EDITABLE)].find(n => n.closest(".card") === el);
  if (!first) return;
  editText(first, null, null);
  if (selectAll) selectContents(first);
}

function editText(node, x, y) {
  if (node.isContentEditable) return;
  const before = node.innerHTML;
  beginDrag(); // the whole session becomes one undo step
  node.setAttribute("contenteditable", node.dataset.editable);
  node.focus();
  placeCaret(node, x, y);
  node.addEventListener("blur", () => {
    node.setAttribute("contenteditable", "false");
    if (node.innerHTML !== before) endDrag(); else cancelDrag();
    touch();
  }, { once: true });
}

function placeCaret(node, x, y) {
  const sel = window.getSelection();
  let range = null;
  if (x !== null) {
    range = document.caretRangeFromPoint?.(x, y) ?? (() => {
      const pos = document.caretPositionFromPoint?.(x, y);
      if (!pos) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      return r;
    })();
    if (range && !node.contains(range.startContainer)) range = null;
  }
  if (!range) {
    // the end of the last text block
    range = document.createRange();
    const last = node.lastElementChild && /^(P|LI|DIV)$/.test(node.lastElementChild.tagName) ? node.lastElementChild : node;
    range.selectNodeContents(last);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ------------------------------------------------------------ label tab */

/** Rename the label inline; the label colours sit right under it. */
export function editLabel(card, cardEl) {
  const label = cardEl.querySelector(":scope > .card__bar > .card__label");
  if (!label || label.isContentEditable) return;
  const original = card.label || "";
  label.classList.add("is-editing");
  label.setAttribute("contenteditable", "plaintext-only");
  label.focus();
  selectContents(label);

  const strip = colorStrip(card, label);

  const finish = (commit) => {
    label.removeEventListener("keydown", onKey);
    label.removeEventListener("blur", onBlur);
    label.setAttribute("contenteditable", "false");
    label.classList.remove("is-editing");
    strip.remove();
    const value = label.textContent.trim();
    if (commit && value !== original) {
      push("label");
      updateCard(card.id, { label: value });
      // a board card's label is the name of the board it opens
      if (card.type === "board" && value) {
        const board = getDoc().boards.find(b => b.id === card.data.boardId);
        if (board) { board.name = value; touch(); }
      }
    } else {
      label.textContent = original;
    }
  };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); label.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  const onBlur = () => finish(true);
  label.addEventListener("keydown", onKey);
  label.addEventListener("blur", onBlur);
}

function colorStrip(card, label) {
  const strip = document.createElement("div");
  strip.className = "colorstrip panel";
  strip.setAttribute("role", "toolbar");
  strip.setAttribute("aria-label", "Label colour");
  for (const name of COLORS) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = `colorstrip__swatch colorstrip__swatch--${name}` + ((card.color || "ink") === name ? " is-current" : "");
    sw.title = name;
    sw.setAttribute("aria-label", `Label colour ${name}`);
    sw.addEventListener("mousedown", (e) => e.preventDefault()); // keep typing in the label
    sw.addEventListener("pointerdown", (e) => e.stopPropagation());
    sw.addEventListener("click", () => {
      push("colour");
      updateCard(card.id, { color: name });
      for (const s of strip.children) s.classList.toggle("is-current", s === sw);
    });
    strip.appendChild(sw);
  }
  const r = label.getBoundingClientRect();
  strip.style.left = `${r.left}px`;
  strip.style.top = `${r.bottom + 6}px`;
  document.body.appendChild(strip);
  return strip;
}

/* ------------------------------------------------------------- meta tab */

async function editMeta(card, cardEl) {
  if (card.type === "link") {
    const url = await promptDialog("Link", "URL", card.data.url || "https://");
    if (url === null) return;
    push("link");
    patchData(card.id, { url: handlers.normaliseUrl ? handlers.normaliseUrl(url) : url });
    return;
  }
  if (card.type === "todo" || card.type === "board") return; // counted / fixed
  if (card.type === "column" && card.data.collapsed) {
    push("collapse");
    patchData(card.id, { collapsed: false });
    return;
  }
  const meta = cardEl.querySelector(":scope > .card__bar > .card__meta");
  if (!meta) return;
  const original = card.meta || "";
  meta.classList.add("is-editing");
  meta.setAttribute("contenteditable", "plaintext-only");
  meta.focus();
  selectContents(meta);
  const finish = (commit) => {
    meta.removeEventListener("keydown", onKey);
    meta.removeEventListener("blur", onBlur);
    meta.setAttribute("contenteditable", "false");
    meta.classList.remove("is-editing");
    const value = meta.textContent.trim();
    if (commit && value !== original) {
      push("meta");
      updateCard(card.id, { meta: value });
    } else {
      meta.textContent = original;
    }
  };
  const onKey = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); meta.blur(); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  };
  const onBlur = () => finish(true);
  meta.addEventListener("keydown", onKey);
  meta.addEventListener("blur", onBlur);
}

/* --------------------------------------------------------------- swatch */

/** The browser's colour picker; the swatch follows live, one undo step. */
export function pickColor(card) {
  const input = document.createElement("input");
  input.type = "color";
  input.value = /^#[0-9a-f]{6}$/i.test(card.data.hex) ? card.data.hex : "#000000";
  input.className = "visually-hidden";
  document.body.appendChild(input);
  const start = card.data.hex;
  beginDrag();
  input.addEventListener("input", () => patchData(card.id, { hex: input.value.toUpperCase() }));
  const done = () => {
    if (dataOf(card.id).hex !== start) endDrag(); else cancelDrag();
    input.remove();
    touch();
  };
  input.addEventListener("change", done, { once: true });
  input.addEventListener("blur", () => setTimeout(() => input.isConnected && done(), 0), { once: true });
  input.click();
}
