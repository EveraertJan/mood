/*
 * TASTBAAR moodboard — document schema, validation and migration.
 *
 * The JSON file is the source of truth. Everything visible on a board must
 * survive export → import with nothing lost.
 */

export const SCHEMA_VERSION = 1;
export const APP_ID = "tastbaar-moodboard";

export const CARD_TYPES = ["note", "image", "link", "todo", "swatch", "heading", "column", "board"];
export const COLORS = ["ink", "red", "green", "blue", "yellow", "cyan", "magenta"];
export const CONNECTOR_STYLES = ["solid", "dashed"];
export const ARROW_STYLES = ["none", "end", "both"];

export const DEFAULT_CARD = {
  id: "",
  type: "note",
  x: 0, y: 0, w: 360, h: 200,
  z: 0,
  rotation: 0,
  label: "",
  meta: "",
  color: "ink",
  locked: false,
  parentColumnId: null,
  data: {}
};

export const DEFAULT_BOARD = {
  id: "",
  name: "Untitled",
  parentId: null,
  titleColor: "red",
  showTitle: true,
  grid: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  cards: [],
  connectors: []
};

export const DEFAULT_DOC = {
  app: APP_ID,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  boards: [DEFAULT_BOARD],
  assets: {}
};

export function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
}

export function getDefaultTitleColor() {
  const colors = ["red", "green", "blue", "yellow", "cyan", "magenta"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function createEmptyDoc() {
  const board = createBoard(DEFAULT_BOARD.name);
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    boards: [board],
    assets: {}
  };
}

export function createBoard(name = "Untitled", parentId = null) {
  return {
    id: generateId(),
    name,
    parentId,
    titleColor: getDefaultTitleColor(),
    showTitle: true,
    grid: false,
    viewport: { x: 0, y: 0, zoom: 1 },
    cards: [],
    connectors: []
  };
}

export function createCard(type, x = 0, y = 0) {
  const card = { ...DEFAULT_CARD, id: generateId(), type, x, y };
  // Set defaults per type
  if (type === "heading") {
    card.w = 400;
    card.h = 80;
    card.label = "";
    card.data = { text: "Heading" };
  } else if (type === "image") {
    card.w = 360;
    card.h = 280;
    card.data = { assetId: null, caption: "", fit: "cover" };
  } else if (type === "link") {
    card.w = 300;
    card.h = 180;
    card.label = "Link";
    card.data = { url: "", title: "", description: "" };
  } else if (type === "todo") {
    card.w = 300;
    card.h = 200;
    card.label = "To-do";
    card.data = { items: [{ id: generateId(), text: "", done: false }] };
  } else if (type === "swatch") {
    card.w = 200;
    card.h = 200;
    card.label = "Swatch";
    card.data = { hex: "#000000", name: "" };
  } else if (type === "column") {
    card.w = 260;
    card.h = 320;
    card.label = "Column";
    card.data = { collapsed: false };
  } else if (type === "board") {
    card.w = 300;
    card.h = 240;
    card.label = "Board";
    card.meta = "OPEN";
    card.data = { boardId: null };
  } else {
    // note
    card.label = "Note";
    card.data = { html: "<p><br></p>" };
  }
  return card;
}

export function createConnector(from, to) {
  return {
    id: generateId(),
    from,
    to,
    style: "solid",
    arrow: "end",
    label: ""
  };
}

export function validate(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    errors.push("The file is not a moodboard document.");
    return errors;
  }
  if (doc.app !== APP_ID) errors.push(`"app" should be "${APP_ID}".`);
  if (typeof doc.schemaVersion !== "number") errors.push(`"schemaVersion" is missing.`);
  else if (doc.schemaVersion > SCHEMA_VERSION) errors.push(`Schema version ${doc.schemaVersion} is newer than this tool understands (${SCHEMA_VERSION}).`);
  if (typeof doc.assets !== "object" || doc.assets === null || Array.isArray(doc.assets)) errors.push(`"assets" is missing.`);
  if (!Array.isArray(doc.boards)) {
    errors.push(`"boards" is missing.`);
    return errors;
  }
  if (!doc.boards.length) errors.push("The file holds no boards.");

  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const assets = doc.assets && typeof doc.assets === "object" ? doc.assets : {};
  const boardIds = new Set(doc.boards.map(b => b?.id));

  doc.boards.forEach((board, bi) => {
    const where = `Board ${bi + 1}${board && typeof board.name === "string" ? ` ("${board.name}")` : ""}`;
    if (!board || typeof board !== "object") { errors.push(`${where} is not an object.`); return; }
    if (!board.id) errors.push(`${where} has no id.`);
    if (typeof board.name !== "string") errors.push(`${where} has no name.`);
    if (board.parentId && !boardIds.has(board.parentId)) errors.push(`${where} points to a parent board that is not in the file.`);
    if (!Array.isArray(board.cards)) { errors.push(`${where} has no "cards" list.`); return; }
    if (!Array.isArray(board.connectors)) errors.push(`${where} has no "connectors" list.`);

    const cardIds = new Set();
    board.cards.forEach((card, ci) => {
      const at = `${where}, card ${ci + 1}`;
      if (!card || typeof card !== "object") { errors.push(`${at} is not an object.`); return; }
      if (!card.id) errors.push(`${at} has no id.`);
      else if (cardIds.has(card.id)) errors.push(`${at} repeats the id ${card.id}.`);
      cardIds.add(card.id);
      if (!CARD_TYPES.includes(card.type)) errors.push(`${at} has an unknown type "${card.type}".`);
      for (const k of ["x", "y", "w", "h"]) if (!isNum(card[k])) errors.push(`${at} has no number for "${k}".`);
      if (card.color && !COLORS.includes(card.color)) errors.push(`${at} has an unknown colour "${card.color}".`);
      if (card.data !== undefined && (typeof card.data !== "object" || card.data === null)) errors.push(`${at} has invalid "data".`);
      if (card.type === "image" && card.data?.assetId && !assets[card.data.assetId]) {
        errors.push(`${at} uses an image that is not in "assets".`);
      }
    });
    (Array.isArray(board.connectors) ? board.connectors : []).forEach((cn, ni) => {
      const at = `${where}, connector ${ni + 1}`;
      if (!cn || !cn.id) { errors.push(`${at} has no id.`); return; }
      if (!cardIds.has(cn.from) || !cardIds.has(cn.to)) errors.push(`${at} connects a card that is not on the board.`);
    });
  });

  for (const [id, asset] of Object.entries(assets)) {
    if (!asset || typeof asset.dataUrl !== "string" || !asset.dataUrl.startsWith("data:")) {
      errors.push(`Asset ${id} has no image data.`);
    }
  }
  return errors;
}

export function migrate(doc) {
  if (!doc) return createEmptyDoc();
  // For now just ensure structure
  if (!doc.app) doc.app = APP_ID;
  if (typeof doc.schemaVersion !== "number") doc.schemaVersion = 1;
  if (!Array.isArray(doc.boards)) doc.boards = [];
  if (typeof doc.assets !== "object" || doc.assets === null) doc.assets = {};
  if (doc.schemaVersion < SCHEMA_VERSION) {
    doc.schemaVersion = SCHEMA_VERSION;
  }
  return doc;
}
