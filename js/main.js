/*
 * TASTBAAR moodboard — application entry point.
 *
 * Wires the state store, the canvas, the cards, the UI and the file formats
 * together, and restores the last session from IndexedDB on load.
 *
 * Every change to the store re-renders the board, refreshes the toolbar and
 * the board list, and schedules an autosave.
 */

import {
  getState, getDoc, getCurrentBoard, setDoc, subscribe, addCard, setSelection, touch
} from "./state/store.js";
import { createEmptyDoc, createCard, generateId, migrate } from "./state/schema.js";
import { push } from "./state/history.js";
import { autosave, load as loadPersisted } from "./state/persist.js";
import { initRender, render, setAfterRender } from "./canvas/render.js";
import { initInteract } from "./canvas/interact.js";
import { initConnectors } from "./canvas/connectors.js";
import { initEdit } from "./canvas/edit.js";
import { screenToBoard, zoomAt } from "./canvas/viewport.js";
import { initToolbar, refresh as refreshToolbar, normaliseUrl, openAbout } from "./ui/toolbar.js";
import { initMenus } from "./ui/menus.js";
import { initRemoveBar, update as updateRemoveBar } from "./ui/removebar.js";
import { initBoards, refreshBoards, openBoard, starterNote } from "./ui/boards.js";
import { initShortcuts, fitToContent, showShortcuts } from "./ui/shortcuts.js";
import { initDialogs, toast } from "./ui/dialogs.js";
import { initContextMenu } from "./ui/contextmenu.js";
import { parseClipboard, pastePayload, hasInternalClipboard, pasteSelection } from "./ui/clipboard.js";
import { exportPNG } from "./io/png.js";
import { exportPDF } from "./io/pdf.js";
import { exportCurrentBoard, exportAllBoards, importFile } from "./io/json.js";

const dom = {};

function cacheDom() {
  const ids = {
    paper: "paper",
    boardLayer: "board-layer",
    connectorsLayer: "connectors-layer",
    marqueeLayer: "marquee-layer",
    guideLayer: "guide-layer",
    title: "board-title",
    toolbar: "toolbar",
    btnAbout: "btn-about",
    status: "status",
    btnUndo: "btn-undo",
    btnRedo: "btn-redo",
    btnGrid: "btn-grid",
    btnBreathe: "btn-breathe",
    btnTitleToggle: "btn-title-toggle",
    btnImport: "btn-import",
    breadcrumbs: "breadcrumbs",
    boards: "boards",
    boardsList: "boards-list",
    btnBoardsToggle: "btn-boards-toggle",
    btnNewBoard: "btn-new-board",
    btnBoardsMenu: "btn-boards-menu",
    btnZoomIn: "btn-zoom-in",
    btnZoomOut: "btn-zoom-out",
    btnZoomFit: "btn-zoom-fit",
    zoomValue: "zoom-value",
    backdrop: "backdrop",
    toastContainer: "toast-container",
    fileImport: "file-import"
  };
  for (const [key, id] of Object.entries(ids)) {
    dom[key] = document.getElementById(id);
  }
}

async function boot() {
  window.TB_LOAD?.(88, "STARTING", true);
  cacheDom();

  initDialogs(dom);
  initRender(dom);
  initInteract(dom);
  initConnectors(dom);
  initEdit(dom, {
    onOpenBoard: (id) => openBoard(id),
    onReplaceImage: (id) => pickImage(id),
    normaliseUrl
  });

  initToolbar(dom, {
    onAddImage: () => pickImage(),
    onImport: () => dom.fileImport.click(),
    onExportPNG: () => exportPNG(),
    onExportPDF: () => exportPDF(),
    onExportAllPDF: () => exportPDF(getCurrentBoard(), true),
    onExportJSON: () => exportCurrentBoard(),
    onExportAllJSON: () => exportAllBoards(),
    onOpenBoard: (id) => openBoard(id),
    onShortcuts: () => showShortcuts()
  });

  initBoards(dom, {
    onOpenBoard: () => callBoardForward()
  });

  initShortcuts({
    onToggleGrid: () => dom.btnGrid.click()
  });

  initContextMenu(dom);
  initMenus();
  initRemoveBar();
  setAfterRender(updateRemoveBar);

  wireZoom();
  wireFileInput();
  wireDragAndDrop();
  wirePaste();
  wireCardEvents();

  const persisted = await loadPersisted();
  const firstVisit = !persisted?.doc?.boards?.length;
  if (firstVisit) {
    setDoc(freshDoc());
  } else {
    setDoc(migrate(persisted.doc), persisted.currentBoardId);
  }

  // only now: the empty document the store starts with is never saved over a real one
  subscribe(() => {
    render();
    refreshToolbar();
    refreshBoards();
    scheduleSave();
  });
  touch();
  await finishLoading();
  if (firstVisit) openAbout();
}

/** Start-up loader (inline in index.html): READY once the fonts are in and the board has been drawn. */
async function finishLoading() {
  try { await document.fonts.ready; } catch (e) { /* the fallback font is fine */ }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.TB_LOAD?.(100, "READY", true);
}

/** A brand new document with one board and the Tastbaar voice note. */
function freshDoc() {
  const doc = createEmptyDoc();
  const board = doc.boards[0];
  board.name = "Mood";
  board.cards.push(starterNote());
  return doc;
}

function scheduleSave() {
  autosave(() => ({ doc: getDoc(), currentBoardId: getState().currentBoardId }), 800);
}

/** A board opened from the list or a board card: nudge its cards forward. */
function callBoardForward() {
  for (const el of dom.boardLayer.querySelectorAll(":scope > .card")) {
    el.classList.remove("is-called");
    void el.offsetWidth; // restart the nudge
    el.classList.add("is-called");
    el.addEventListener("animationend", () => el.classList.remove("is-called"), { once: true });
  }
}

/* ------------------------------------------------------------------ zoom */

function wireZoom() {
  const centre = () => [window.innerWidth / 2, window.innerHeight / 2];
  dom.btnZoomIn.addEventListener("click", () => { zoomAt(...centre(), 1); touch(); });
  dom.btnZoomOut.addEventListener("click", () => { zoomAt(...centre(), -1); touch(); });
  dom.btnZoomFit.addEventListener("click", () => fitToContent());
}

/* ----------------------------------------------------------------- files */

function wireFileInput() {
  dom.fileImport.addEventListener("change", async () => {
    const file = dom.fileImport.files?.[0];
    dom.fileImport.value = "";
    if (file) await importFile(file);
  });
}

function wireDragAndDrop() {
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    document.body.classList.add("is-dropping");
  });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) document.body.classList.remove("is-dropping");
  });
  window.addEventListener("drop", async (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove("is-dropping");
    const files = [...(e.dataTransfer?.files || [])];
    const json = files.find(f => f.type === "application/json" || f.name.endsWith(".json"));
    if (json) {
      await importFile(json);
      return;
    }
    let offset = 0;
    for (const file of files.filter(f => f.type.startsWith("image/"))) {
      await addImageFromFile(file, e.clientX + offset, e.clientY + offset);
      offset += 24;
    }
  });
}

function wirePaste() {
  window.addEventListener("paste", async (e) => {
    if (e.target?.closest?.("[contenteditable='true'], [contenteditable='plaintext-only'], input, textarea")) return;
    if (!dom.backdrop.hidden) return;
    const data = e.clipboardData;
    if (!data) return;

    const text = data.getData("text/plain");
    const cards = parseClipboard(text);
    if (cards) {
      e.preventDefault();
      pastePayload(cards);
      return;
    }

    const image = [...data.items].find(item => item.type.startsWith("image/"))?.getAsFile();
    if (image) {
      e.preventDefault();
      await addImageFromFile(image);
      return;
    }

    if (/^(https?:\/\/|www\.)\S+$/i.test(text.trim())) {
      e.preventDefault();
      addLinkCard(text.trim());
      return;
    }

    if (hasInternalClipboard()) {
      e.preventDefault();
      pasteSelection();
    }
  });
}

function addLinkCard(url) {
  push("add link");
  const centre = screenToBoard(window.innerWidth / 2, window.innerHeight / 2);
  const card = createCard("link", Math.round((centre.x - 150) / 8) * 8, Math.round((centre.y - 90) / 8) * 8);
  card.data.url = normaliseUrl(url);
  addCard(card);
  setSelection([card.id], []);
}

/** Events the cards send up: open a nested board, a copied swatch. */
function wireCardEvents() {
  dom.paper.addEventListener("board:open", (e) => openBoard(e.detail));
  dom.paper.addEventListener("swatch:copy", (e) => toast(`Copied ${e.detail}`));
}

/* ---------------------------------------------------------------- images */

const MAX_IMAGE_SIDE = 2400;

/** Pick image files: new cards, or with replaceId a new picture for that card. */
function pickImage(replaceId = null) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = !replaceId;
  input.addEventListener("change", async () => {
    if (replaceId) {
      const file = input.files?.[0];
      if (file) await replaceImage(replaceId, file);
      return;
    }
    let offset = 0;
    for (const file of input.files || []) {
      await addImageFromFile(file, null, null, offset);
      offset += 24;
    }
  });
  input.click();
}

async function replaceImage(cardId, file) {
  try {
    const asset = await scaleImage(await readFile(file), file.type);
    if (!asset.w) throw new Error("not an image");
    const card = getCurrentBoard()?.cards.find(c => c.id === cardId);
    if (!card) return;
    push("replace image");
    getDoc().assets[asset.id] = { mime: asset.mime, dataUrl: asset.dataUrl, w: asset.w, h: asset.h };
    card.data = { ...card.data, assetId: asset.id };
    card.h = Math.round(card.w * asset.h / asset.w);
    touch();
  } catch (e) {
    console.error(e);
    toast("Could not read that image");
  }
}

/** Store an image in doc.assets and put an image card on the board. */
export async function addImageFromFile(file, clientX = null, clientY = null, offset = 0) {
  try {
    const dataUrl = await readFile(file);
    const asset = await scaleImage(dataUrl, file.type);
    if (!asset.w) throw new Error("not an image");

    const w = 360;
    const h = Math.round(w * asset.h / asset.w);
    let p;
    if (clientX !== null) {
      p = screenToBoard(clientX, clientY);
      p = { x: p.x - w / 2, y: p.y - h / 2 };
    } else {
      const c = screenToBoard(window.innerWidth / 2, window.innerHeight / 2);
      p = { x: c.x - w / 2 + offset, y: c.y - h / 2 + offset };
    }

    push("add image");
    getDoc().assets[asset.id] = { mime: asset.mime, dataUrl: asset.dataUrl, w: asset.w, h: asset.h };
    const card = createCard("image", Math.round(p.x / 8) * 8, Math.round(p.y / 8) * 8);
    card.data.assetId = asset.id;
    card.w = w;
    card.h = h;
    card.label = "";
    addCard(card);
    setSelection([card.id], []);
  } catch (e) {
    console.error(e);
    toast("Could not read that image");
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Scale an image down to 2400px on the long side, keeping JPEGs as JPEG. */
function scaleImage(dataUrl, mime) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const longSide = Math.max(w, h);
      if (longSide <= MAX_IMAGE_SIDE) {
        resolve({ id: generateId(), mime: mime || "image/png", dataUrl, w, h });
        return;
      }
      const ratio = MAX_IMAGE_SIDE / longSide;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const outMime = mime === "image/jpeg" || mime === "image/webp" ? "image/jpeg" : "image/png";
      resolve({
        id: generateId(),
        mime: outMime,
        dataUrl: canvas.toDataURL(outMime, 0.9),
        w: canvas.width,
        h: canvas.height
      });
    };
    img.onerror = () => resolve({ id: generateId(), mime, dataUrl, w: 0, h: 0 });
    img.src = dataUrl;
  });
}

boot().catch((e) => { console.error(e); window.TB_FAIL?.(e.message); });
