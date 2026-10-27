/*
 * TASTBAAR moodboard — the card context menu.
 *
 * A white panel with shadow and uppercase items, the hovered item inverted.
 * On a card (or the selection): label colour and text, lock, duplicate,
 * delete, bring forward, send back and a few type-specific actions. On a
 * connector: line style, arrows, label. On empty paper: add a card, paste.
 */

import {
  getCurrentBoard, getState, setSelection, deleteCards, updateCard, bringForward, sendBack,
  deleteConnectors, updateConnector, findCard
} from "../state/store.js";
import { push } from "../state/history.js";
import { screenToBoard } from "../canvas/viewport.js";
import { duplicateCards, pasteSelection } from "./clipboard.js";
import { toast, promptDialog } from "./dialogs.js";
import { openBoard } from "./boards.js";
import { addCardOfType, normaliseUrl } from "./toolbar.js";
import { fitToContent } from "./shortcuts.js";

const COLORS = [
  ["ink", "#000000"],
  ["red", "#ff0000"],
  ["green", "#00ff00"],
  ["blue", "#0000ff"],
  ["yellow", "#ffff00"],
  ["cyan", "#00ffff"],
  ["magenta", "#ff00ff"]
];

let openMenu = null;

export function initContextMenu(dom) {
  dom.paper.addEventListener("contextmenu", (e) => {
    const cardEl = e.target.closest(".card");
    if (!cardEl) return;
    e.preventDefault();
    e.stopPropagation();
    // right-click inside the selection acts on all of it; elsewhere on that card alone
    const id = cardEl.dataset.id;
    const sel = getState().selection.cards;
    const ids = sel.has(id) ? [...sel] : [id];
    if (!sel.has(id)) setSelection(ids, []);
    openCardMenu(e.clientX, e.clientY, id, ids);
  });

  dom.paper.addEventListener("moodboard:contextmenu", (e) => {
    const { x, y, connectorId } = e.detail;
    if (connectorId) openConnectorMenu(x, y, connectorId);
    else openPaperMenu(x, y);
  });

  dom.paper.addEventListener("moodboard:connector-label", (e) => editConnectorLabel(e.detail.id));
}

function createMenu(x, y) {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "menu panel";
  menu.setAttribute("role", "menu");
  menu.style.position = "fixed";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.zIndex = "4600";
  const add = (label, fn) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu__item";
    btn.setAttribute("role", "menuitem");
    btn.textContent = label;
    btn.addEventListener("click", () => { closeMenu(); fn(); });
    menu.appendChild(btn);
    return btn;
  };
  return { menu, add };
}

function showMenu(menu) {
  document.body.appendChild(menu);
  // keep the menu on screen
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
  openMenu = menu;
  menu.querySelector("button")?.focus();
  const close = (ev) => {
    if (menu.contains(ev.target)) return;
    closeMenu();
  };
  const onKey = (ev) => { if (ev.key === "Escape") closeMenu(); };
  menu.__cleanup = () => {
    document.removeEventListener("pointerdown", close, true);
    document.removeEventListener("keydown", onKey, true);
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey, true);
  }, 0);
}

function closeMenu() {
  if (!openMenu) return;
  openMenu.__cleanup?.();
  openMenu.remove();
  openMenu = null;
}

function openCardMenu(x, y, cardId, ids) {
  const card = findCard(cardId);
  if (!card) return;
  const { menu, add } = createMenu(x, y);

  // colour swatches
  const colors = document.createElement("div");
  colors.className = "menu__colors";
  for (const [name, hex] of COLORS) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "menu__swatch" + (card.color === name ? " is-current" : "");
    sw.style.background = hex;
    sw.title = name;
    sw.setAttribute("aria-label", `Label colour ${name}`);
    sw.addEventListener("click", () => {
      closeMenu();
      push("colour");
      for (const id of ids) updateCard(id, { color: name });
    });
    colors.appendChild(sw);
  }
  menu.appendChild(colors);
  menu.appendChild(divider());

  add("Label…", async () => {
    const value = await promptDialog("Label", "The text in the label tab (empty hides it)", card.label || "");
    if (value === null) return;
    push("label");
    for (const id of ids) updateCard(id, { label: value.trim() });
  });

  if (card.type === "link") {
    add("Edit link…", async () => {
      const url = await promptDialog("Link", "URL", card.data.url || "https://");
      if (url === null) return;
      push("link");
      updateCard(card.id, { data: { ...findCard(card.id).data, url: normaliseUrl(url) } });
    });
    if (card.data.url) add("Open link", () => window.open(card.data.url, "_blank", "noopener"));
  }

  if (card.type === "swatch") {
    add("Colour…", async () => {
      const hex = await promptDialog("Swatch", "Hex colour, like #1D2A44", card.data.hex || "#000000");
      if (hex === null) return;
      const value = normaliseHex(hex);
      if (!value) { toast("That is not a hex colour"); return; }
      push("swatch");
      updateCard(card.id, { data: { ...findCard(card.id).data, hex: value } });
    });
  }

  if (card.type === "image") {
    add(card.data.fit === "contain" ? "Fit: cover" : "Fit: contain", () => {
      push("fit");
      updateCard(card.id, { data: { ...findCard(card.id).data, fit: card.data.fit === "contain" ? "cover" : "contain" } });
    });
  }

  if (card.type === "column") {
    add(card.data.collapsed ? "Expand" : "Collapse", () => {
      push("collapse");
      updateCard(card.id, { data: { ...findCard(card.id).data, collapsed: !card.data.collapsed } });
    });
  }

  if (card.type === "board" && card.data.boardId) {
    add("Open board", () => openBoard(card.data.boardId));
  }

  menu.appendChild(divider());

  add(card.locked ? "Unlock" : "Lock", () => {
    push("lock");
    const next = !card.locked;
    for (const id of ids) updateCard(id, { locked: next });
  });

  add("Duplicate", () => duplicateCards(ids));

  add("Bring forward", () => {
    push("z-order");
    bringForward(ids);
  });

  add("Send back", () => {
    push("z-order");
    sendBack(ids);
  });

  menu.appendChild(divider());

  add("Delete", () => {
    push("delete");
    deleteCards(ids);
    toast(`${ids.length} card${ids.length > 1 ? "s" : ""} deleted`);
  }).classList.add("is-danger");

  showMenu(menu);
}

function openConnectorMenu(x, y, id) {
  const conn = getCurrentBoard()?.connectors.find(c => c.id === id);
  if (!conn) return;
  const { menu, add } = createMenu(x, y);
  const set = (patch) => { push("connector"); updateConnector(id, patch); };
  add(conn.style === "dashed" ? "Solid line" : "Dashed line", () => set({ style: conn.style === "dashed" ? "solid" : "dashed" }));
  if (conn.arrow !== "none") add("No arrow", () => set({ arrow: "none" }));
  if (conn.arrow !== "end") add("Arrow at the end", () => set({ arrow: "end" }));
  if (conn.arrow !== "both") add("Arrows at both ends", () => set({ arrow: "both" }));
  add("Reverse", () => set({ from: conn.to, to: conn.from }));
  add("Label…", () => editConnectorLabel(id));
  menu.appendChild(divider());
  add("Delete", () => { push("delete connector"); deleteConnectors([id]); }).classList.add("is-danger");
  showMenu(menu);
}

function openPaperMenu(x, y) {
  const { menu, add } = createMenu(x, y);
  const at = screenToBoard(x, y);
  add("Note here", () => addCardOfType("note", at));
  add("To-do here", () => addCardOfType("todo", at));
  add("Heading here", () => addCardOfType("heading", at));
  add("Paste", () => pasteSelection());
  menu.appendChild(divider());
  add("Select all", () => setSelection(getCurrentBoard().cards.filter(c => !c.parentColumnId).map(c => c.id), []));
  add("Zoom to fit", () => fitToContent());
  showMenu(menu);
}

async function editConnectorLabel(id) {
  const conn = getCurrentBoard()?.connectors.find(c => c.id === id);
  if (!conn) return;
  const label = await promptDialog("Connector", "Label (empty for none)", conn.label || "");
  if (label === null) return;
  push("connector label");
  updateConnector(id, { label: label.trim() });
}

function normaliseHex(value) {
  const v = String(value).trim().replace(/^#?/, "#");
  if (/^#[0-9a-f]{3}$/i.test(v)) return ("#" + [...v.slice(1)].map(c => c + c).join("")).toUpperCase();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  return null;
}

function divider() {
  const d = document.createElement("div");
  d.className = "menu__divider";
  return d;
}
