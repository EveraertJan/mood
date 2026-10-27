/*
 * TASTBAAR moodboard — the card clipboard.
 *
 * Copy, cut and paste cards within and between boards. An internal clipboard
 * holds the cards; the system clipboard additionally receives them as JSON so
 * they can travel between tabs or into other tools.
 */

import {
  getState, getCurrentBoard, getDoc, deleteCards, setSelection
} from "../state/store.js";
import { push } from "../state/history.js";
import { generateId } from "../state/schema.js";
import { toast } from "./dialogs.js";

const CLIP_TYPE = "tastbaar-moodboard/clipboard";

let internal = null; // { type, cards, connectors, assets }
let pasteCount = 0;

export function copySelection() {
  const state = getState();
  const board = getCurrentBoard();
  if (!board) return false;
  const ids = new Set(state.selection.cards);
  if (!ids.size) return false;
  // a column travels with its children
  for (const c of board.cards) if (c.parentColumnId && ids.has(c.parentColumnId)) ids.add(c.id);

  const cards = board.cards.filter(c => ids.has(c.id));
  const assets = {};
  const doc = getDoc();
  for (const c of cards) {
    const id = c.type === "image" && c.data?.assetId;
    if (id && doc.assets[id]) assets[id] = doc.assets[id];
  }
  internal = JSON.parse(JSON.stringify({
    type: CLIP_TYPE,
    cards,
    connectors: board.connectors.filter(cn => ids.has(cn.from) && ids.has(cn.to)),
    assets
  }));
  pasteCount = 0;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(JSON.stringify(internal)).catch(() => {});
  }
  toast(`${state.selection.cards.size} card${state.selection.cards.size > 1 ? "s" : ""} copied`);
  return true;
}

export function cutSelection() {
  const ids = [...getState().selection.cards];
  if (!ids.length) return;
  copySelection();
  push("cut");
  deleteCards(ids);
}

/** Is this text a copy of moodboard cards? Returns the payload or null. */
export function parseClipboard(text) {
  if (!text || text[0] !== "{") return null;
  try {
    const parsed = JSON.parse(text);
    return parsed?.type === CLIP_TYPE && Array.isArray(parsed.cards) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasInternalClipboard() {
  return !!internal;
}

/** Paste the last copied cards (from the menu; the paste event uses pastePayload). */
export async function pasteSelection() {
  let payload = internal;
  if (navigator.clipboard?.readText) {
    try {
      payload = parseClipboard(await navigator.clipboard.readText()) || payload;
    } catch {
      /* clipboard not readable — use the internal copy */
    }
  }
  if (payload) pastePayload(payload);
}

/** Put copied cards on the current board, with new ids, a little offset. */
export function pastePayload(payload) {
  const board = getCurrentBoard();
  if (!board || !payload?.cards?.length) return;
  push("paste");
  if (payload !== internal) { internal = payload; pasteCount = 0; }
  const offset = 24 * ++pasteCount;

  const doc = getDoc();
  for (const [id, asset] of Object.entries(payload.assets || {})) {
    if (!doc.assets[id]) doc.assets[id] = asset;
  }

  const idMap = new Map(payload.cards.map(c => [c.id, generateId()]));
  let z = board.cards.reduce((m, c) => Math.max(m, c.z || 0), 0);
  const created = [];
  for (const card of payload.cards) {
    const copy = JSON.parse(JSON.stringify(card));
    copy.id = idMap.get(card.id);
    copy.parentColumnId = card.parentColumnId ? idMap.get(card.parentColumnId) ?? null : null;
    if (!copy.parentColumnId) {
      copy.x = card.x + offset;
      copy.y = card.y + offset;
      copy.z = ++z;
    }
    board.cards.push(copy);
    created.push(copy);
  }
  for (const conn of payload.connectors || []) {
    const from = idMap.get(conn.from);
    const to = idMap.get(conn.to);
    if (from && to) board.connectors.push({ ...conn, id: generateId(), from, to });
  }
  const top = created.filter(c => !c.parentColumnId);
  setSelection(top.map(c => c.id), []);
  toast(`Pasted ${top.length} card${top.length > 1 ? "s" : ""}`);
}

/** Duplicate the given cards in place. */
export function duplicateCards(ids) {
  const board = getCurrentBoard();
  if (!board || !ids.length) return;
  const set = new Set(ids);
  for (const c of board.cards) if (c.parentColumnId && set.has(c.parentColumnId)) set.add(c.id);
  const cards = board.cards.filter(c => set.has(c.id));
  const saved = internal;
  const count = pasteCount;
  pastePayload({
    type: CLIP_TYPE,
    cards,
    connectors: board.connectors.filter(cn => set.has(cn.from) && set.has(cn.to))
  });
  internal = saved; // duplicating does not change what is on the clipboard
  pasteCount = count;
}
