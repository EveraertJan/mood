/*
 * TASTBAAR moodboard — PNG export.
 *
 * The board is drawn straight onto a canvas from state (no DOM screenshot),
 * so the export matches the screen: the paper, the windows with their
 * shadows, the tabs, the wrapped Courier text and the inverting title.
 */

import { getDoc, getCurrentBoard } from "../state/store.js";
import { paintCard, paintConnectors } from "./paint.js";
import { TOKENS, drawGrid, drawFooter, complement, pageAccent } from "./draw.js";
import { dialog, toast } from "../ui/dialogs.js";
import { getViewport } from "../canvas/viewport.js";

const MAX_SIDE = 16000;
const PAD = 80; // the site's --pad

/** Wait for the vendored fonts so the canvas measures text correctly. */
export async function waitForFonts() {
  if (!document.fonts) return;
  try {
    await document.fonts.ready;
    await document.fonts.load('400 14px "Courier Prime"');
    await document.fonts.load('700 14px "Courier Prime"');
    await document.fonts.load('italic 400 14px "Courier Prime"');
  } catch {
    /* fonts unavailable: fall back to the system mono */
  }
}

/** Load every image used by a board. */
export async function loadImages(doc, boards) {
  const images = new Map();
  const ids = new Set();
  for (const board of boards) {
    for (const card of board.cards) {
      if (card.type === "image" && card.data.assetId) ids.add(card.data.assetId);
    }
  }
  await Promise.all([...ids].map(id => new Promise(resolve => {
    const asset = doc.assets[id];
    if (!asset) return resolve();
    const img = new Image();
    img.onload = () => { images.set(id, img); resolve(); };
    img.onerror = () => resolve();
    img.src = asset.dataUrl;
  })));
  return images;
}

/** The bounding box of every card on a board. */
export function boardBounds(board) {
  const cards = board.cards.filter(c => !c.parentColumnId);
  if (!cards.length) return { x: 0, y: 0, w: 400, h: 300 };
  const minX = Math.min(...cards.map(c => c.x));
  const minY = Math.min(...cards.map(c => c.y));
  const maxX = Math.max(...cards.map(c => c.x + c.w));
  const maxY = Math.max(...cards.map(c => c.y + c.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Render a board to a canvas.
 *
 * @param {object} board
 * @param {object} options { mode: "board"|"view", scale, paper }
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderBoard(board, options = {}) {
  const { mode = "board", scale = 2, paper = false } = options;
  const doc = getDoc();

  await waitForFonts();
  const images = await loadImages(doc, [board]);

  let bounds;
  if (mode === "view") {
    const v = getViewport();
    const w = window.innerWidth / v.zoom;
    const h = window.innerHeight / v.zoom;
    bounds = { x: -v.x / v.zoom, y: -v.y / v.zoom, w, h };
  } else {
    // the cards, and the title where it stands on screen, plus the site's --pad
    let b = boardBounds(board);
    if (board.showTitle && board.name) b = union(b, titleRect(board));
    bounds = { x: b.x - PAD, y: b.y - PAD, w: b.w + PAD * 2, h: b.h + PAD * 2 };
  }

  let factor = scale;
  while (factor > 1 && (bounds.w * factor > MAX_SIDE || bounds.h * factor > MAX_SIDE)) {
    factor -= 0.5;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.w * factor));
  canvas.height = Math.max(1, Math.round(bounds.h * factor));
  const ctx = canvas.getContext("2d");
  ctx.scale(factor, factor);
  ctx.translate(-bounds.x, -bounds.y);

  if (paper) {
    ctx.fillStyle = TOKENS.paper;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    if (board.grid) drawGrid(ctx, bounds.x, bounds.y, bounds.w, bounds.h);
  }

  const env = { doc, images, board };
  paintConnectors(ctx, board);

  const cards = [...board.cards].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const card of cards) {
    if (card.parentColumnId) continue;
    paintCard(ctx, card, env);
  }

  if (board.showTitle) {
    paintTitle(ctx, board, bounds, paper);
  }
  drawFooter(ctx, bounds.x, bounds.y, bounds.w, bounds.h);

  return canvas;
}

/**
 * Where the board title stands, in board coordinates. On screen it is fixed
 * to the middle of the window, outside the zoom, so its place on the board
 * follows the view: the export keeps it exactly where the cards see it now.
 * Each board uses its own view (the open board's live one, others as saved).
 */
export function titleLayout(board) {
  const live = getCurrentBoard()?.id === board.id;
  const v = live ? getViewport() : { x: 0, y: 0, zoom: 1, ...board.viewport };
  const zoom = v.zoom || 1;
  // the on-screen title now stands up along the edge; exports keep the big centred one
  const screenSize = Math.max(64, Math.min(300, window.innerWidth * 0.155));
  return {
    size: screenSize / zoom,
    cx: (window.innerWidth / 2 - v.x) / zoom,
    cy: (window.innerHeight / 2 - v.y) / zoom
  };
}

/** The title's box on the board (line-height 1, like the CSS). */
function titleRect(board) {
  const { size, cx, cy } = titleLayout(board);
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `800 ${size}px ${TOKENS.display}`;
  const w = trackedWidth(ctx, board.name, -0.075 * size);
  return { x: cx - w / 2, y: cy - size / 2, w, h: size };
}

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Draw the big inverting board title over everything, where it stands on screen. */
export function paintTitle(ctx, board, bounds, paper) {
  const { size, cx, cy } = titleLayout(board);
  const text = board.name || "";
  if (!text) return;
  ctx.save();
  ctx.font = `800 ${size}px ${TOKENS.display}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const chosen = pageAccent(); // the same accent the screen shows
  if (paper) {
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = complement(chosen);
  } else {
    ctx.fillStyle = chosen;
  }
  const tracking = -0.075 * size;
  const width = trackedWidth(ctx, text, tracking);
  // CSS centres a line box of height = size; the baseline sits inside it by the font's own metrics
  const m = ctx.measureText(text);
  const asc = m.fontBoundingBoxAscent ?? size * 0.77;
  const desc = m.fontBoundingBoxDescent ?? size * 0.23;
  const y = cy - size / 2 + (size - (asc + desc)) / 2 + asc;
  let x = cx - width / 2;
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${tracking}px`; // keeps the kerning, like the screen
    ctx.fillText(text, x, y);
  } else {
    for (const ch of text) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + tracking;
    }
  }
  ctx.restore();
}

/** Width of tracked text as CSS lays it out: kerned, letter-spacing after every letter. */
function trackedWidth(ctx, text, tracking) {
  return Math.max(0, ctx.measureText(text).width + tracking * [...text].length);
}

/** Download a canvas as a PNG. */
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/** Show the PNG options window and export. */
export async function exportPNG(board = getCurrentBoard()) {
  if (!board) return;
  const options = await askPNGOptions();
  if (!options) return;
  try {
    const canvas = await renderBoard(board, options);
    const name = `${String(board.name || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.png`;
    downloadCanvas(canvas, name);
    toast("PNG exported");
  } catch (e) {
    console.error(e);
    toast(`Export failed: ${e.message}`);
  }
}

function askPNGOptions() {
  const body = document.createElement("div");
  body.innerHTML = `
    <p><label for="png-mode">Area</label></p>
    <select id="png-mode" class="dialog__input">
      <option value="board">Whole board</option>
      <option value="view">Current view</option>
    </select>
    <p><label for="png-scale">Scale</label></p>
    <select id="png-scale" class="dialog__input">
      <option value="1">1x</option>
      <option value="2" selected>2x</option>
      <option value="3">3x</option>
    </select>
    <p><label><input type="checkbox" id="png-paper"> White paper</label></p>
    <p class="muted">Without paper the PNG is transparent and the title is drawn in its plain colour. With paper you get the dot grid (if it is on) and the inverting title.</p>
  `;
  return dialog({
    title: "Export PNG",
    body,
    width: "360px",
    actions: [
      { label: "Cancel", value: null },
      {
        label: "Export",
        primary: true,
        value: (card) => ({
          mode: card.querySelector("#png-mode").value,
          scale: Number(card.querySelector("#png-scale").value),
          paper: card.querySelector("#png-paper").checked
        })
      }
    ]
  });
}
