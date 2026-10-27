/*
 * TASTBAAR moodboard — the board list.
 *
 * Styled like the site's quicklinks panel: a white 220px panel, fixed
 * bottom-right at --edge, uppercase links, the current board inverted. Below
 * it: NEW BOARD, plus RENAME / DUPLICATE / DELETE in a context menu.
 *
 * The panel sits underneath the cards, so cards slide over it, and it
 * collapses to a single "BOARDS" tab.
 */

import {
  getDoc, getCurrentBoard, setCurrentBoard, addBoard, removeBoard, touch
} from "../state/store.js";
import { createBoard, createCard, generateId } from "../state/schema.js";
import { push } from "../state/history.js";
import { confirmDialog, promptDialog, toast } from "./dialogs.js";

let dom = null;
let handlers = {};

export function initBoards(domRefs, callbacks = {}) {
  dom = domRefs;
  handlers = callbacks;

  dom.btnNewBoard.addEventListener("click", () => newBoard());
  dom.btnBoardsMenu.addEventListener("click", (e) => openBoardMenu(e));

  // the BOARDS heading folds the list away into a single tab
  dom.btnBoardsToggle.addEventListener("click", () => {
    const collapsed = dom.boards.classList.toggle("is-collapsed");
    dom.btnBoardsToggle.setAttribute("aria-expanded", String(!collapsed));
  });
}

export function refreshBoards() {
  const doc = getDoc();
  const current = getCurrentBoard();
  dom.boardsList.replaceChildren();

  // a board whose parent is gone is listed as a root, so nothing gets lost
  const ids = new Set(doc.boards.map(b => b.id));
  const walk = (board, depth, seen) => {
    if (seen.has(board.id)) return;
    seen.add(board.id);
    dom.boardsList.appendChild(boardLink(board, current, depth));
    for (const child of doc.boards.filter(b => b.parentId === board.id)) walk(child, depth + 1, seen);
  };
  const seen = new Set();
  for (const root of doc.boards.filter(b => !b.parentId || !ids.has(b.parentId))) walk(root, 0, seen);
}

/** The starter note an empty board shows (like the site's info card). */
export function starterNote() {
  const note = createCard("note", 30, 80); // under the toolbar
  note.label = "Hi.";
  note.data = {
    html:
      "<p>Empty board. Double-click anywhere to start.</p>" +
      "<p>Ideas are nice. Tangible is better.</p>"
  };
  return note;
}

function boardLink(board, current, depth) {
  const a = document.createElement("a");
  a.href = "#";
  a.textContent = board.name;
  a.style.marginLeft = `${depth * 12}px`;
  if (current && board.id === current.id) {
    a.setAttribute("aria-current", "page");
  }
  a.addEventListener("click", (e) => {
    e.preventDefault();
    openBoard(board.id);
  });
  a.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openBoardContextMenu(e, board.id);
  });
  return a;
}

export function openBoard(id) {
  setCurrentBoard(id);
  handlers.onOpenBoard?.(id);
}

async function newBoard() {
  const name = await promptDialog("New board", "Name of the new board", "Untitled");
  if (name === null) return;
  push("new board");
  const board = createBoard(name.trim() || "Untitled", null);
  board.cards.push(starterNote());
  addBoard(board);
  setCurrentBoard(board.id);
  toast(`Board "${board.name}" created`);
}

function openBoardMenu(e) {
  const menu = document.createElement("div");
  menu.className = "menu panel";
  menu.setAttribute("role", "menu");
  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.left = `${rect.left - 100}px`;
  menu.style.top = `${rect.top - 120}px`;
  menu.style.zIndex = "4600";

  const current = getCurrentBoard();
  const items = [
    ["Rename", () => renameBoard(current?.id)],
    ["Duplicate", () => duplicateBoard(current?.id)],
    ["Delete", () => deleteBoard(current?.id)]
  ];
  for (const [label, fn] of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu__item";
    btn.setAttribute("role", "menuitem");
    btn.textContent = label;
    if (label === "Delete") btn.classList.add("is-danger");
    btn.addEventListener("click", () => { menu.remove(); fn(); });
    menu.appendChild(btn);
  }
  document.body.appendChild(menu);
  const close = (ev) => {
    if (menu.contains(ev.target)) return;
    menu.remove();
    document.removeEventListener("pointerdown", close);
  };
  setTimeout(() => document.addEventListener("pointerdown", close), 0);
}

function openBoardContextMenu(e, boardId) {
  const menu = document.createElement("div");
  menu.className = "menu panel";
  menu.setAttribute("role", "menu");
  menu.style.position = "fixed";
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.style.zIndex = "4600";
  const items = [
    ["Open", () => openBoard(boardId)],
    ["Rename", () => renameBoard(boardId)],
    ["Duplicate", () => duplicateBoard(boardId)],
    ["Delete", () => deleteBoard(boardId)]
  ];
  for (const [label, fn] of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu__item";
    btn.setAttribute("role", "menuitem");
    btn.textContent = label;
    if (label === "Delete") btn.classList.add("is-danger");
    btn.addEventListener("click", () => { menu.remove(); fn(); });
    menu.appendChild(btn);
  }
  document.body.appendChild(menu);
  const close = (ev) => {
    if (menu.contains(ev.target)) return;
    menu.remove();
    document.removeEventListener("pointerdown", close);
  };
  setTimeout(() => document.addEventListener("pointerdown", close), 0);
}

async function renameBoard(id) {
  if (!id) return;
  const doc = getDoc();
  const board = doc.boards.find(b => b.id === id);
  if (!board) return;
  const name = await promptDialog("Rename board", "New name", board.name);
  if (name === null) return;
  push("rename board");
  board.name = name.trim() || board.name;
  // board cards that open this board carry its name
  for (const b of doc.boards) {
    for (const c of b.cards) if (c.type === "board" && c.data?.boardId === id) c.label = board.name;
  }
  touch();
}

async function duplicateBoard(id) {
  if (!id) return;
  const doc = getDoc();
  const board = doc.boards.find(b => b.id === id);
  if (!board) return;
  push("duplicate board");
  const copy = JSON.parse(JSON.stringify(board));
  const ids = new Map(copy.cards.map(c => [c.id, generateId()]));
  copy.id = generateId();
  copy.name = `${board.name} copy`;
  copy.cards = copy.cards.map(c => ({
    ...c,
    id: ids.get(c.id),
    parentColumnId: c.parentColumnId ? ids.get(c.parentColumnId) ?? null : null
  }));
  copy.connectors = copy.connectors
    .filter(cn => ids.has(cn.from) && ids.has(cn.to))
    .map(cn => ({ ...cn, id: generateId(), from: ids.get(cn.from), to: ids.get(cn.to) }));
  addBoard(copy);
  setCurrentBoard(copy.id);
  toast("Board duplicated");
}

async function deleteBoard(id) {
  if (!id) return;
  const doc = getDoc();
  if (doc.boards.length <= 1) {
    toast("The last board cannot be deleted");
    return;
  }
  const board = doc.boards.find(b => b.id === id);
  if (!board) return;
  const ok = await confirmDialog(
    "Delete board",
    `Delete "${board.name}", the boards inside it and everything on them?`,
    "Delete"
  );
  if (!ok) return;
  push("delete board");
  // remove nested boards too
  const ids = [id];
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of doc.boards) {
      if (b.parentId && ids.includes(b.parentId) && !ids.includes(b.id)) {
        ids.push(b.id);
        grew = true;
      }
    }
  }
  // board cards elsewhere that opened a deleted board go too
  for (const b of doc.boards) {
    b.cards = b.cards.filter(c => !(c.type === "board" && ids.includes(c.data?.boardId)));
  }
  for (const bid of ids) removeBoard(bid, true);
  toast("Board deleted");
}
