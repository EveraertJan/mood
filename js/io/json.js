/*
 * TASTBAAR moodboard — JSON import and export.
 *
 * The JSON file is the source of truth. Export the current board or all
 * boards; import runs validate + migrate first and asks what to do when ids
 * clash.
 */

import {
  getDoc, getCurrentBoard, setDoc, setCurrentBoard
} from "../state/store.js";
import { validate, migrate, SCHEMA_VERSION, APP_ID, generateId } from "../state/schema.js";
import { push } from "../state/history.js";
import { dialog, toast } from "../ui/dialogs.js";

/** Collect the assets actually used by the given boards. */
export function collectAssets(boards) {
  const used = new Set();
  for (const board of boards) {
    for (const card of board.cards) {
      if (card.type === "image" && card.data?.assetId) {
        used.add(card.data.assetId);
      }
    }
  }
  return used;
}

/** Build a serialisable document for the given boards. */
export function buildDocument(boards) {
  const doc = getDoc();
  const assets = {};
  for (const id of collectAssets(boards)) {
    if (doc.assets[id]) assets[id] = doc.assets[id];
  }
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    boards: JSON.parse(JSON.stringify(boards)),
    assets
  };
}

/** Download a document as a .json file. */
export function downloadDocument(doc, filename) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Export the current board (and its nested boards) as JSON. */
export function exportCurrentBoard() {
  const doc = getDoc();
  const board = getCurrentBoard();
  if (!board) return;
  const boards = collectFamily(doc, board.id);
  const out = buildDocument(boards);
  out.boards[0].parentId = null; // its parent is not in the file
  downloadDocument(out, `${slug(board.name)}-${stamp()}.json`);
  toast(`Exported ${boards.length} board${boards.length > 1 ? "s" : ""}`);
}

/** Export every board as JSON. */
export function exportAllBoards() {
  const doc = getDoc();
  const out = buildDocument(doc.boards);
  downloadDocument(out, `tastbaar-moodboard-${stamp()}.json`);
  toast(`Exported ${doc.boards.length} boards`);
}

export function slug(name) {
  return String(name || "board")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "board";
}

/** The board and every board nested under it. */
export function collectFamily(doc, boardId) {
  const out = [];
  const walk = (id) => {
    const board = doc.boards.find(b => b.id === id);
    if (!board) return;
    out.push(board);
    for (const child of doc.boards.filter(b => b.parentId === id)) walk(child.id);
  };
  walk(boardId);
  return out;
}

/**
 * Import a parsed JSON document.
 *
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function importDocument(raw) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    await dialog({
      title: "Import failed",
      body: `<p>This file is not valid JSON.</p><p class="muted">${escapeHTML(e.message)}</p>`
    });
    return { ok: false, error: "invalid json" };
  }

  const errors = validate(parsed);
  if (errors.length) {
    const list = errors.map(e => `<li>${escapeHTML(e)}</li>`).join("");
    await dialog({
      title: "Import failed",
      body: `<p>This file does not match the moodboard format. Nothing was imported.</p><ul class="errors">${list}</ul>`
    });
    return { ok: false, error: errors.join("; ") };
  }

  const migrated = migrate(parsed);
  const doc = getDoc();
  const clash = migrated.boards.some(b => doc.boards.some(x => x.id === b.id));

  let incoming = migrated;
  let replace = false;
  if (clash) {
    const choice = await dialog({
      title: "Import",
      body: "<p>Some boards in this file are already here. Replace them, or import the file as a copy?</p>",
      actions: [
        { label: "Cancel", value: null },
        { label: "Import as copy", value: "copy" },
        { label: "Replace", value: "replace", primary: true }
      ]
    });
    if (choice === null) return { ok: false, error: "cancelled" };
    if (choice === "copy") incoming = remapIds(migrated);
    else replace = true;
  }

  push("import");
  const ids = new Set(incoming.boards.map(b => b.id));
  const next = {
    ...doc,
    // replaced boards keep their place in the list
    boards: replace
      ? [...doc.boards.map(b => incoming.boards.find(n => n.id === b.id) || b),
         ...incoming.boards.filter(n => !doc.boards.some(b => b.id === n.id))]
      : [...doc.boards.filter(b => !ids.has(b.id)), ...incoming.boards],
    assets: { ...doc.assets, ...incoming.assets }
  };
  setDoc(next, incoming.boards[0]?.id);
  const n = incoming.boards.length;
  toast(`Imported ${n} board${n === 1 ? "" : "s"}${incoming !== migrated ? " as a copy" : ""}`);
  return { ok: true };
}

/** Give every board, card and connector a fresh id and remap all references. */
export function remapIds(doc) {
  const boardMap = new Map();
  const cardMap = new Map();
  for (const board of doc.boards) {
    boardMap.set(board.id, generateId());
    for (const card of board.cards) cardMap.set(card.id, generateId());
  }
  const boards = doc.boards.map(board => ({
    ...board,
    id: boardMap.get(board.id),
    parentId: board.parentId ? boardMap.get(board.parentId) ?? null : null,
    cards: board.cards.map(card => ({
      ...card,
      id: cardMap.get(card.id),
      parentColumnId: card.parentColumnId ? cardMap.get(card.parentColumnId) ?? null : null,
      data: card.data?.boardId
        ? { ...card.data, boardId: boardMap.get(card.data.boardId) ?? card.data.boardId }
        : card.data
    })),
    connectors: board.connectors.map(cn => ({
      ...cn,
      id: generateId(),
      from: cardMap.get(cn.from) ?? cn.from,
      to: cardMap.get(cn.to) ?? cn.to
    }))
  }));
  return { ...doc, boards };
}

/** Read a File and import it. */
export async function importFile(file) {
  if (!file) return;
  const text = await file.text();
  return importDocument(text);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
