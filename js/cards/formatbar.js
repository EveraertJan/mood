/*
 * TASTBAAR moodboard — the floating format bar.
 *
 * A small white bar with a shadow that floats above the text you are
 * editing. Uppercase B / I / U / LIST / LINK / RULE. It uses the browser's
 * own editing commands, so undo keeps working.
 */

import { sanitizeHTML } from "./common.js";

const COMMANDS = [
  { id: "bold", label: "B", title: "Bold", run: () => document.execCommand("bold") },
  { id: "italic", label: "I", title: "Italic", run: () => document.execCommand("italic") },
  { id: "underline", label: "U", title: "Underline", run: () => document.execCommand("underline") },
  { id: "ul", label: "List", title: "Bullet list", run: () => document.execCommand("insertUnorderedList") },
  { id: "ol", label: "1.", title: "Numbered list", run: () => document.execCommand("insertOrderedList") },
  { id: "rule", label: "Rule", title: "Rule", run: insertRule },
  { id: "link", label: "Link", title: "Link", run: insertLink }
];

let bar = null;
let target = null;

function ensureBar() {
  if (bar) return bar;
  bar = document.createElement("div");
  bar.className = "formatbar panel";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Format");
  for (const cmd of COMMANDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "formatbar__btn";
    btn.textContent = cmd.label;
    btn.title = cmd.title;
    btn.setAttribute("aria-label", cmd.title);
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      target?.focus();
      cmd.run();
      target?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    bar.appendChild(btn);
  }
  document.body.appendChild(bar);
  return bar;
}

function insertRule() {
  const html = '<p class="rule"><br></p><p><br></p>';
  document.execCommand("insertHTML", false, html);
}

function insertLink() {
  const url = window.prompt("Link URL", "https://");
  if (!url) return;
  const safe = /^(https?:|mailto:|#)/i.test(url) ? url : `https://${url}`;
  document.execCommand("createLink", false, safe);
}

/** Show the format bar above the given editable element. */
export function showFormatBar(el) {
  target = el;
  const b = ensureBar();
  b.style.display = "flex";
  const rect = el.getBoundingClientRect();
  const width = b.offsetWidth || 240;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(8, Math.min(window.innerWidth - width - 8, left));
  let top = rect.top - b.offsetHeight - 8;
  if (top < 8) top = rect.bottom + 8;
  b.style.left = `${left}px`;
  b.style.top = `${top}px`;
}

/** Hide the format bar. */
export function hideFormatBar() {
  if (bar) bar.style.display = "none";
  target = null;
}

/** Attach the format bar to an editable element. */
export function attachFormatBar(el) {
  if (!el || el.__formatbar) return;
  el.__formatbar = true;
  el.addEventListener("focus", () => showFormatBar(el));
  el.addEventListener("blur", (e) => {
    // keep the bar up while a format button is being pressed
    if (e.relatedTarget && bar?.contains(e.relatedTarget)) return;
    hideFormatBar();
  });
}

export { sanitizeHTML };
