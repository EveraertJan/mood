/*
 * TASTBAAR moodboard — toolbar.
 *
 * The top bar: breadcrumb trail, undo/redo and the View and File menus (see
 * menus.js). New cards come from the + button bottom-right. Buttons are uppercase; the active or pressed
 * state is inverted, like the site's aria-current quicklink.
 */

import {
  getCurrentBoard, getDoc, setSelection, addCard, addBoard, touch
} from "../state/store.js";
import { createCard, createBoard } from "../state/schema.js";
import { undo, redo, canUndo, canRedo, push } from "../state/history.js";
import { render, setRenderOptions, getCardElement } from "../canvas/render.js";
import { screenToBoard } from "../canvas/viewport.js";
import { DEFAULT_SIZE } from "../cards/index.js";
import { editCard } from "../canvas/edit.js";
import { selectContents } from "../cards/common.js";
import { dialog, toast, promptDialog } from "./dialogs.js";

let dom = null;
let handlers = {};
let breatheOn = false;

export function initToolbar(domRefs, callbacks = {}) {
  dom = domRefs;
  handlers = callbacks;

  document.querySelectorAll("#menu-add [data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.type === "image") handlers.onAddImage?.();
      else addCardOfType(btn.dataset.type);
    });
  });

  dom.btnUndo.addEventListener("click", () => doUndo());
  dom.btnRedo.addEventListener("click", () => doRedo());

  dom.btnGrid.addEventListener("click", () => toggleGrid());
  dom.btnBreathe.addEventListener("click", () => toggleBreathe());
  dom.btnTitleToggle.addEventListener("click", () => toggleTitle());

  dom.btnImport.addEventListener("click", () => handlers.onImport?.());
  const exporters = {
    png: () => handlers.onExportPNG?.(),
    pdf: () => handlers.onExportPDF?.(),
    json: () => handlers.onExportJSON?.(),
    "all-pdf": () => handlers.onExportAllPDF?.(),
    "all-json": () => handlers.onExportAllJSON?.()
  };
  document.querySelectorAll("[data-export]").forEach(btn => {
    btn.addEventListener("click", () => exporters[btn.dataset.export]?.());
  });

  dom.btnAbout.addEventListener("click", () => openAbout());
}

/** Create a new card of the given type in the middle of the current view. */
export async function addCardOfType(type, at = null) {
  const board = getCurrentBoard();
  if (!board) return;
  const size = DEFAULT_SIZE[type] || DEFAULT_SIZE.note;
  const centre = screenToBoard(window.innerWidth / 2, window.innerHeight / 2);
  const point = at || { x: centre.x - size.w / 2, y: centre.y - size.h / 2 };

  let url = "";
  if (type === "link") {
    url = await promptDialog("Link", "Paste a URL", "https://");
    if (url === null) return;
    url = normaliseUrl(url);
  }

  push(`add ${type}`);
  const card = createCard(type, Math.round(point.x / 8) * 8, Math.round(point.y / 8) * 8);
  if (type === "link") card.data.url = url;
  if (type === "board") {
    // a board card always opens a board of its own, nested under this one
    const child = createBoard("New board", board.id);
    addBoard(child);
    card.label = child.name;
    card.data.boardId = child.id;
  }
  addCard(card);
  setSelection([card.id], []);
  // start writing right away
  if (type === "todo") getCardElement(card.id)?.querySelector("input[type='text']")?.focus();
  else editCard(card.id, { selectAll: type === "heading" || type === "board" });
  return card;
}

export function normaliseUrl(url) {
  const trimmed = String(url).trim();
  if (!trimmed || trimmed === "https://") return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function doUndo() {
  if (!undo()) toast("Nothing to undo");
}

export function doRedo() {
  if (!redo()) toast("Nothing to redo");
}

function toggleGrid() {
  const board = getCurrentBoard();
  if (!board) return;
  push("grid");
  board.grid = !board.grid;
  touch();
}

function toggleBreathe() {
  breatheOn = !breatheOn;
  setRenderOptions({ breathe: breatheOn });
  refresh();
  render();
}

function toggleTitle() {
  const board = getCurrentBoard();
  if (!board) return;
  push("title");
  board.showTitle = !board.showTitle;
  touch();
}

/** Refresh the toolbar's own state (pressed states, breadcrumb, undo/redo). */
export function refresh() {
  const board = getCurrentBoard();
  if (!board) return;
  dom.btnGrid.setAttribute("aria-pressed", String(!!board.grid));
  dom.btnTitleToggle.setAttribute("aria-pressed", String(board.showTitle !== false));
  dom.btnBreathe.setAttribute("aria-pressed", String(breatheOn));
  dom.btnUndo.disabled = !canUndo();
  dom.btnRedo.disabled = !canRedo();
  renderBreadcrumbs();
}

/** Parent boards as muted links, then the open board as a black label you click to rename. */
function renderBreadcrumbs() {
  const doc = getDoc();
  const board = getCurrentBoard();
  if (!board) return;
  if (dom.breadcrumbs.querySelector(".is-editing")) return; // don't interrupt a rename
  const chain = [];
  let cursor = board;
  while (cursor && !chain.includes(cursor)) {
    chain.unshift(cursor);
    cursor = doc.boards.find(b => b.id === cursor.parentId);
  }
  dom.breadcrumbs.replaceChildren();
  chain.forEach((b, i) => {
    if (i === chain.length - 1) {
      dom.breadcrumbs.appendChild(nameLabel(b));
      return;
    }
    const link = document.createElement("a");
    link.href = "#";
    link.className = "toolbar__crumb";
    link.textContent = b.name;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      handlers.onOpenBoard?.(b.id);
    });
    const sep = document.createElement("span");
    sep.className = "toolbar__crumb-sep";
    sep.textContent = "/";
    dom.breadcrumbs.append(link, sep);
  });
}

function nameLabel(board) {
  const name = document.createElement("span");
  name.className = "toolbar__name";
  name.textContent = board.name;
  name.title = "Click to rename";
  name.tabIndex = 0;
  name.setAttribute("role", "button");
  const start = () => {
    if (name.classList.contains("is-editing")) return;
    name.classList.add("is-editing");
    name.contentEditable = "plaintext-only";
    name.focus();
    selectContents(name);
  };
  const finish = (commit) => {
    if (!name.classList.contains("is-editing")) return;
    name.classList.remove("is-editing");
    name.contentEditable = "false";
    const value = name.textContent.trim();
    if (commit && value && value !== board.name) {
      push("rename board");
      board.name = value;
      for (const b of getDoc().boards) {
        for (const c of b.cards) if (c.type === "board" && c.data?.boardId === board.id) c.label = value;
      }
      touch();
    } else {
      name.textContent = board.name;
    }
  };
  name.addEventListener("click", start);
  name.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (!name.classList.contains("is-editing")) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); }
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  name.addEventListener("blur", () => finish(true));
  return name;
}

/**
 * The welcome / about screen: TOOL and BY TASTBAAR bar, the name as a big
 * inverting title, one line on what it is for, then the steps.
 */
export async function openAbout() {
  const body = document.createElement("div");
  body.className = "about";
  body.innerHTML =
    '<div class="about__title" aria-hidden="true">MOOD</div>' +
    "<p class=\"lg\">Collect what a project should feel like, on one board you can touch.</p>" +
    "<ol>" +
    "<li><b>Gather.</b> Press + for a new card, or double-click the paper for a note. Drop, paste or pick images. Paste a URL for a link.</li>" +
    "<li><b>Arrange.</b> Drag cards around, drop them into a column, pull the square on a card's edge to connect it to another.</li>" +
    "<li><b>Go deeper.</b> BOARD puts a board inside this one. Double-click it to step in.</li>" +
    "<li><b>Share.</b> EXPORT as PNG or PDF to show it, or as JSON to keep it. Everything also saves itself in this browser.</li>" +
    "</ol>" +
    "<p class=\"muted\">Right-click a card for colours and more. Press ? for every shortcut.</p>" +
    "<p><i>Ideas are nice. Tangible is better.</i></p>";
  const choice = await dialog({
    title: "Tool",
    meta: "by Tastbaar",
    body,
    width: "560px",
    actions: [
      { label: "Shortcuts", value: "shortcuts" },
      { label: "Start", value: null, primary: true }
    ]
  });
  if (choice === "shortcuts") handlers.onShortcuts?.();
}
