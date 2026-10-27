/*
 * TASTBAAR moodboard — shared card helpers.
 *
 * Small utilities used by every card type: building the label/meta tab bar,
 * making text editable, sanitising pasted HTML down to the supported subset.
 */

import { CARD_TYPES } from "../state/schema.js";
import { findCard, updateCard } from "../state/store.js";

/**
 * Merge a patch into a card's data. Always reads the live card: after an undo
 * or an import the card object a handler was created with is out of date.
 */
export function patchData(id, patch) {
  const live = findCard(id);
  if (!live) return;
  updateCard(id, { data: { ...live.data, ...patch } });
}

/** The live data of a card ({} when it is gone). */
export function dataOf(id) {
  return findCard(id)?.data || {};
}

/** Build the tab bar (black label tab left, white meta tab right). */
export function buildBar(card) {
  const bar = document.createElement("header");
  bar.className = "card__bar";
  const label = document.createElement("span");
  label.className = "card__label";
  label.textContent = card.label || "";
  const meta = document.createElement("span");
  meta.className = "card__meta";
  meta.textContent = card.meta || "";
  bar.append(label, meta);
  return bar;
}

/** Replace the tab bar of an existing card in place. */
export function updateBar(el, card) {
  const bar = el.querySelector(".card__bar");
  if (!bar) return;
  const label = bar.querySelector(".card__label");
  const meta = bar.querySelector(".card__meta");
  // never under the fingers of someone renaming it
  if (label && !label.isContentEditable) label.textContent = card.label || "";
  if (meta && !meta.isContentEditable) meta.textContent = card.meta || "";
}

/**
 * Make an element editable in place; calls onChange(html) on every input.
 *
 * The supported subset is bold, italic, underline, bullet and numbered lists,
 * links and the rule divider. Pasted HTML is cleaned down to that subset.
 */
export function makeEditable(el, onChange, { plain = false, placeholder = "" } = {}) {
  // editable only while being edited: a double-click turns it on (canvas/edit.js)
  el.setAttribute("contenteditable", "false");
  el.dataset.editable = plain ? "plaintext-only" : "true";
  if (placeholder) el.dataset.placeholder = placeholder;
  el.setAttribute("spellcheck", "false");
  el.addEventListener("input", () => onChange(el.innerHTML));
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = (e.clipboardData || window.clipboardData).getData("text/html");
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    if (plain || !html) {
      document.execCommand("insertText", false, text);
      return;
    }
    document.execCommand("insertHTML", false, sanitizeHTML(html));
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") el.blur();
    if (plain && e.key === "Enter") { e.preventDefault(); el.blur(); }
    e.stopPropagation(); // card shortcuts are off while typing
  });
  return el;
}

/** Sanitise arbitrary HTML down to the supported rich-text subset. */
export function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const allowed = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "A", "DIV", "SPAN"]);
  const out = doc.body;
  walk(out);
  return out.innerHTML;

  function walk(node) {
    for (const child of [...node.children]) {
      if (!allowed.has(child.tagName)) {
        const text = doc.createTextNode(child.textContent || "");
        child.replaceWith(text);
        continue;
      }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") || "";
        if (!/^(https?:|mailto:|#)/i.test(href)) {
          child.removeAttribute("href");
        }
        child.setAttribute("rel", "noopener noreferrer");
        child.setAttribute("target", "_blank");
      }
      [...child.attributes].forEach(attr => {
        const keep = child.tagName === "A" && ["href", "rel", "target"].includes(attr.name);
        if (!keep) child.removeAttribute(attr.name);
      });
      walk(child);
    }
  }
}

/** Format a URL into the display domain, uppercased. */
export function domainOf(url) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    return u.hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return String(url).toUpperCase();
  }
}

/**
 * Select everything inside an element that was just made editable.
 * (execCommand("selectAll") selects the whole page when the focus has not
 * placed a caret yet, which happens inside user-select: none.)
 */
export function selectContents(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Turn the controls of a locked card off (and back on when it is unlocked). */
export function setLocked(el, locked) {
  for (const node of el.querySelectorAll("input, button")) {
    if (node.closest(".card") === el) node.disabled = locked;
  }
}

/** Is the event target inside a text-editing surface? */
export function isEditing(target) {
  if (!target) return false;
  const el = target.closest?.("[contenteditable], input, textarea, select");
  return !!el;
}

export function isValidType(type) {
  return CARD_TYPES.includes(type);
}
