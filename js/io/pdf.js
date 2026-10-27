/*
 * TASTBAAR moodboard — PDF export.
 *
 * Reuses the PNG renderer and places the result with jsPDF. Courier Prime is
 * registered with jsPDF (addFileToVFS + addFont) so the header tabs and the
 * footer are real PDF text. Each board gets pages in its own orientation.
 */

import { getDoc, getCurrentBoard } from "../state/store.js";
import { renderBoard } from "./png.js";
import { dialog, toast } from "../ui/dialogs.js";

const PAGE_SIZES = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
  letter: { w: 215.9, h: 279.4 }
};

const MARGIN = 18; // mm
const FONT = "CourierPrime";
const FONT_FILES = {
  normal: "assets/fonts/ttf/CourierPrime-Regular.ttf",
  bold: "assets/fonts/ttf/CourierPrime-Bold.ttf",
  italic: "assets/fonts/ttf/CourierPrime-Italic.ttf",
  bolditalic: "assets/fonts/ttf/CourierPrime-BoldItalic.ttf"
};

let fontData = null; // { style: base64 } — fetched once, added to every PDF

async function loadFontData() {
  if (fontData) return fontData;
  const out = {};
  for (const [style, path] of Object.entries(FONT_FILES)) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      out[style] = btoa(binary);
    } catch {
      /* that style falls back to Courier */
    }
  }
  fontData = out;
  return out;
}

/** Load Courier Prime into this jsPDF document. Returns the font name to use. */
export async function registerFonts(pdf) {
  const data = await loadFontData();
  if (!data.normal) return "courier";
  for (const [style, base64] of Object.entries(data)) {
    pdf.addFileToVFS(`${FONT}-${style}.ttf`, base64);
    pdf.addFont(`${FONT}-${style}.ttf`, FONT, style);
  }
  return FONT;
}

/** jsPDF (360 KB) is only fetched the first time a PDF is exported. */
let jsPDFLoading = null;
async function getJsPDF() {
  if (!window.jspdf?.jsPDF) {
    jsPDFLoading ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("../../vendor/jspdf.umd.min.js", import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => { jsPDFLoading = null; reject(new Error("jsPDF could not be loaded")); };
      document.head.appendChild(script);
    });
    await jsPDFLoading;
  }
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error("jsPDF is not loaded");
  return jsPDF;
}

function orientationFor(canvas, options) {
  if (options.orientation !== "auto") return options.orientation;
  return canvas.width > canvas.height ? "landscape" : "portrait";
}

/**
 * Export one board (or every board, in board-list order) to a PDF.
 */
export async function exportPDF(board = getCurrentBoard(), all = false) {
  const options = await askPDFOptions(all);
  if (!options) return;

  try {
    const JsPDF = await getJsPDF();
    const boards = all ? listOrder(getDoc()) : [board];
    if (!boards.length) return;

    let pdf = null;
    for (const b of boards) {
      const canvas = await renderBoard(b, { mode: "board", scale: 2, paper: true });
      const orientation = orientationFor(canvas, options);
      if (!pdf) {
        pdf = new JsPDF({ unit: "mm", format: options.size, orientation });
        options.font = await registerFonts(pdf);
      } else {
        pdf.addPage(options.size, orientation);
      }
      placeBoard(pdf, canvas, b, { ...options, orientation });
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const name = all
      ? `tastbaar-moodboard-${stamp}.pdf`
      : `${String(board.name || "board").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${stamp}.pdf`;
    pdf.save(name);
    toast("PDF exported");
  } catch (e) {
    console.error(e);
    toast(`Export failed: ${e.message}`);
  }
}

/** Boards in the order the board list shows them (each parent before its children). */
function listOrder(doc) {
  const ids = new Set(doc.boards.map(b => b.id));
  const out = [];
  const walk = (b) => {
    if (out.includes(b)) return;
    out.push(b);
    doc.boards.filter(c => c.parentId === b.id).forEach(walk);
  };
  doc.boards.filter(b => !b.parentId || !ids.has(b.parentId)).forEach(walk);
  return out;
}

/** Place a rendered board onto the PDF pages. */
export function placeBoard(doc, canvas, board, options) {
  const size = PAGE_SIZES[options.size] || PAGE_SIZES.a4;
  const landscape = options.orientation === "landscape";
  const pageW = landscape ? size.h : size.w;
  const pageH = landscape ? size.w : size.h;

  const headerH = options.header ? 12 : 0;
  const footerH = 10;
  const availW = pageW - MARGIN * 2;
  const availH = pageH - MARGIN * 2 - headerH - footerH;

  const boardW = canvas.width;
  const boardH = canvas.height;

  if (options.mode === "fit") {
    const ratio = Math.min(availW / boardW, availH / boardH);
    const w = boardW * ratio;
    const h = boardH * ratio;
    const x = (pageW - w) / 2;
    const y = MARGIN + headerH + (availH - h) / 2;
    doc.addImage(canvas.toDataURL("image/png"), "PNG", x, y, w, h, undefined, "FAST");
    drawHeader(doc, board, pageW, options);
    drawFooter(doc, pageW, pageH, options);
    return;
  }

  // tile across pages with a small overlap
  const overlap = 10; // px
  const ratio = availW / boardW;
  const pageHpx = Math.floor(availH / ratio);

  let y0 = 0;
  let pageIndex = 0;
  while (y0 < boardH) {
    const sliceH = Math.min(pageHpx + overlap, boardH - y0);
    const slice = crop(canvas, 0, y0, boardW, sliceH);
    const w = boardW * ratio;
    const h = sliceH * ratio;
    const x = MARGIN;
    const y = MARGIN + headerH;
    doc.addImage(slice.toDataURL("image/png"), "PNG", x, y, w, h, undefined, "FAST");
    if (pageIndex === 0) drawHeader(doc, board, pageW, options);
    drawFooter(doc, pageW, pageH, options);
    y0 += pageHpx;
    pageIndex++;
    if (y0 < boardH) doc.addPage(options.size, options.orientation);
  }
}

function crop(canvas, x, y, w, h) {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  const ctx = out.getContext("2d");
  ctx.drawImage(canvas, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}

/** The header: the board name in a black label top-left, the date as a black counter top-right. */
function drawHeader(doc, board, pageW, options) {
  if (!options.header) return;
  const name = String(board.name || "Untitled").toUpperCase();
  const date = new Date().toISOString().slice(0, 10);
  doc.setFont(options.font || "courier", "normal");
  doc.setFontSize(9);
  doc.setFillColor(0, 0, 0);
  doc.setTextColor(255, 255, 255);

  const nameW = doc.getTextWidth(name) + 4;
  doc.rect(MARGIN, MARGIN - 4, nameW, 6, "F");
  doc.text(name, MARGIN + 2, MARGIN + 0.4);

  const dateW = doc.getTextWidth(date) + 4;
  doc.rect(pageW - MARGIN - dateW, MARGIN - 4, dateW, 6, "F");
  doc.text(date, pageW - MARGIN - dateW + 2, MARGIN + 0.4);
}

/** Footer, bottom-right: tastbaar.studio in #aaa mono, 11px. */
function drawFooter(doc, pageW, pageH, options) {
  doc.setFont(options.font || "courier", "normal");
  doc.setFontSize(8.25); // 11px
  doc.setTextColor(170, 170, 170);
  doc.text("tastbaar.studio", pageW - MARGIN, pageH - MARGIN + 6, { align: "right" });
}

function askPDFOptions(all) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p><label for="pdf-size">Paper</label></p>
    <select id="pdf-size" class="dialog__input">
      <option value="a4" selected>A4</option>
      <option value="a3">A3</option>
      <option value="letter">Letter</option>
    </select>
    <p><label for="pdf-orientation">Orientation</label></p>
    <select id="pdf-orientation" class="dialog__input">
      <option value="auto" selected>Auto</option>
      <option value="portrait">Portrait</option>
      <option value="landscape">Landscape</option>
    </select>
    <p><label for="pdf-mode">Layout</label></p>
    <select id="pdf-mode" class="dialog__input">
      <option value="fit" selected>Fit on one page</option>
      <option value="tile">Tile across pages</option>
    </select>
    <p><label><input type="checkbox" id="pdf-header" checked> Header labels</label></p>
  `;
  return dialog({
    title: all ? "Export all boards (PDF)" : "Export PDF",
    body,
    width: "360px",
    actions: [
      { label: "Cancel", value: null },
      {
        label: "Export",
        primary: true,
        value: (card) => ({
          size: card.querySelector("#pdf-size").value,
          orientation: card.querySelector("#pdf-orientation").value,
          mode: card.querySelector("#pdf-mode").value,
          header: card.querySelector("#pdf-header").checked
        })
      }
    ]
  });
}

export { askPDFOptions };
