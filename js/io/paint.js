/*
 * TASTBAAR moodboard — canvas painting of cards and connectors.
 *
 * Every card type is painted from state onto a 2D context: the white window
 * with its shadow, the label and meta tabs, wrapped Courier text, images,
 * checkboxes, swatches, headings and connectors with V arrowheads.
 */

import {
  TOKENS, drawWindow, drawTabs, drawTracked, drawLink, drawGrid, drawCheckbox, mono
} from "./draw.js";
import { parseRichText, wrapRuns, fontFor } from "./richtext.js";

/**
 * Paint one card.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} card
 * @param {object} env  { doc, images, boards }
 */
export function paintCard(ctx, card, env) {
  switch (card.type) {
    case "image": return paintImage(ctx, card, env);
    case "link": return paintLink(ctx, card, env);
    case "todo": return paintTodo(ctx, card, env);
    case "swatch": return paintSwatch(ctx, card, env);
    case "heading": return paintHeading(ctx, card, env);
    case "column": return paintColumn(ctx, card, env);
    case "board": return paintBoard(ctx, card, env);
    default: return paintNote(ctx, card, env);
  }
}

function paintNote(ctx, card) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const barH = drawTabs(ctx, card, card.x, card.y, card.w);
  const pad = TOKENS.cardPad;
  const blocks = parseRichText(card.data.html);
  paintRichText(ctx, blocks, card.x + pad, card.y + barH + pad, card.w - pad * 2);
}

function paintImage(ctx, card, env) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const asset = env.doc.assets[card.data.assetId];
  const img = asset ? env.images.get(card.data.assetId) : null;

  const caption = String(card.data.caption || "");
  const captionH = caption ? TOKENS.leading + TOKENS.gap : 0;
  const imgH = Math.max(40, card.h - captionH);

  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(card.x, card.y, card.w, imgH);
    ctx.clip();
    const ratio = img.naturalWidth / img.naturalHeight;
    const boxRatio = card.w / imgH;
    let dw = card.w;
    let dh = imgH;
    if (card.data.fit === "contain") {
      if (ratio > boxRatio) { dh = card.w / ratio; }
      else { dw = imgH * ratio; }
    } else {
      if (ratio > boxRatio) { dw = imgH * ratio; }
      else { dh = card.w / ratio; }
    }
    ctx.drawImage(img, card.x + (card.w - dw) / 2, card.y + (imgH - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = TOKENS.line;
    ctx.fillRect(card.x, card.y, card.w, imgH);
  }

  // the label tab overlaps the image's top edge
  drawTabs(ctx, card, card.x, card.y, card.w);

  if (caption) {
    ctx.font = mono();
    ctx.fillStyle = TOKENS.ink;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(caption, card.x + TOKENS.cardPadSm, card.y + imgH + TOKENS.leading);
  }
}

function paintLink(ctx, card) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const barH = drawTabs(ctx, card, card.x, card.y, card.w, domainOf(card.data.url));
  const pad = TOKENS.cardPadSm;
  let y = card.y + barH + pad + TOKENS.text;
  const x = card.x + pad;
  const width = card.w - pad * 2;

  ctx.textBaseline = "alphabetic";
  ctx.font = mono(TOKENS.text, 700);
  ctx.fillStyle = TOKENS.ink;
  y += wrapPlain(ctx, card.data.title || "", x, y, width, 18);
  y += TOKENS.gap;
  ctx.font = mono();
  y += wrapPlain(ctx, card.data.description || "", x, y, width, TOKENS.leading);
  y += 14;
  drawLink(ctx, "OPEN →", x, y, true, width);
}

function paintTodo(ctx, card) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const items = card.data.items || [];
  const done = items.filter(i => i.done).length;
  const meta = items.length ? `${done}/${items.length}` : (card.meta || "");
  const barH = drawTabs(ctx, card, card.x, card.y, card.w, meta);

  const pad = TOKENS.cardPadSm;
  const x = card.x + pad;
  let y = card.y + barH + pad + 2;
  ctx.textBaseline = "alphabetic";

  for (const item of items) {
    drawCheckbox(ctx, x, y - 10, !!item.done);
    ctx.font = mono();
    ctx.fillStyle = item.done ? TOKENS.muted : TOKENS.ink;
    const text = item.text || "";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, x + 22, y);
    if (item.done) {
      ctx.fillRect(x + 22, y - 4, tw, 1);
    }
    y += TOKENS.leading + TOKENS.listGap;
  }
}

function paintSwatch(ctx, card) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const barH = drawTabs(ctx, card, card.x, card.y, card.w);
  const chipH = 140;
  ctx.fillStyle = card.data.hex || "#000000";
  ctx.fillRect(card.x, card.y + barH, card.w, chipH);

  const pad = TOKENS.cardPadSm;
  let y = card.y + barH + chipH + pad + TOKENS.text;
  ctx.textBaseline = "alphabetic";
  ctx.font = mono(TOKENS.text, 700);
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(String(card.data.hex || "#000000").toUpperCase(), card.x + pad, y);
  y += TOKENS.leading;
  ctx.font = mono();
  ctx.fillText(card.data.name || "", card.x + pad, y);
}

function paintHeading(ctx, card) {
  const size = 64;
  ctx.font = `800 ${size}px ${TOKENS.display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TOKENS.ink;
  const text = card.data.text || "";
  const tracking = -0.075 * size;
  drawTracked(ctx, text, card.x, card.y + size, tracking);
}

/** A column is a group: a faint dotted outline, no paper, no shadow. */
function paintColumn(ctx, card, env) {
  ctx.save();
  ctx.strokeStyle = TOKENS.line;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 2]);
  ctx.strokeRect(card.x + 0.5, card.y + 0.5, card.w - 1, card.h - 1);
  ctx.restore();
  const kids = (env.board?.cards || [])
    .filter(c => c.parentColumnId === card.id)
    .sort((a, b) => (a.z || 0) - (b.z || 0));
  const barH = drawTabs(ctx, card, card.x, card.y, card.w, card.data.collapsed ? String(kids.length) : (card.meta || ""));
  if (card.data.collapsed) return;

  const pad = TOKENS.cardPadSm;
  let y = card.y + barH + pad;
  for (const kid of kids) {
    const child = { ...kid, x: card.x + pad, y, w: card.w - pad * 2 };
    paintCard(ctx, child, env);
    y += (kid.h || 80) + 10;
  }
}

function paintBoard(ctx, card, env) {
  drawWindow(ctx, card.x, card.y, card.w, card.h);
  const barH = drawTabs(ctx, card, card.x, card.y, card.w, "OPEN");
  const pad = TOKENS.cardPadSm;
  const boxX = card.x + pad;
  const boxY = card.y + barH + pad;
  const boxW = card.w - pad * 2;
  const boxH = card.h - barH - pad * 2;

  ctx.strokeStyle = TOKENS.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW, boxH);

  const target = env.doc.boards.find(b => b.id === card.data.boardId);
  const cards = (target?.cards || []).filter(c => !c.parentColumnId);
  if (!cards.length) {
    ctx.font = mono();
    ctx.fillStyle = TOKENS.muted;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("EMPTY", boxX + 20, boxY + 30);
    return;
  }
  const minX = Math.min(...cards.map(c => c.x));
  const minY = Math.min(...cards.map(c => c.y));
  const maxX = Math.max(...cards.map(c => c.x + c.w));
  const maxY = Math.max(...cards.map(c => c.y + c.h));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = TOKENS.paper;
  for (const c of cards) {
    if (c.type === "heading") continue;
    ctx.fillRect(
      boxX + ((c.x - minX) / w) * boxW,
      boxY + ((c.y - minY) / h) * boxH,
      Math.max(4, (c.w / w) * boxW),
      Math.max(4, (c.h / h) * boxH)
    );
  }
  ctx.restore();
}

/** Paint the connectors of a board. */
export function paintConnectors(ctx, board) {
  const cards = new Map(board.cards.map(c => [c.id, c]));
  ctx.save();
  ctx.strokeStyle = TOKENS.muted; // thin, neutral grey
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const conn of board.connectors) {
    const from = cards.get(conn.from);
    const to = cards.get(conn.to);
    if (!from || !to || from.parentColumnId || to.parentColumnId) continue;
    const a = anchorOf(from, to);
    const b = anchorOf(to, from);
    if (conn.style === "dashed") ctx.setLineDash([6, 6]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (conn.arrow === "end" || conn.arrow === "both") paintArrow(ctx, b, a);
    if (conn.arrow === "both") paintArrow(ctx, a, b);

    if (conn.label) {
      ctx.font = mono(TOKENS.textUi);
      const text = String(conn.label).toUpperCase();
      const tw = ctx.measureText(text).width;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.fillStyle = TOKENS.paper;
      ctx.fillRect(mx - tw / 2 - 6, my - 11, tw + 12, 22);
      ctx.fillStyle = TOKENS.ink;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, mx - tw / 2, my + 5);
    }
  }
  ctx.restore();
}

function paintArrow(ctx, tip, from) {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const size = 10;
  ctx.beginPath();
  ctx.moveTo(tip.x - ux * size - uy * size * 0.6, tip.y - uy * size + ux * size * 0.6);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(tip.x - ux * size + uy * size * 0.6, tip.y - uy * size - ux * size * 0.6);
  ctx.stroke();
}

function anchorOf(card, other) {
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const ox = other.x + other.w / 2;
  const oy = other.y + other.h / 2;
  const dx = ox - cx;
  const dy = oy - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? card.x + card.w : card.x, y: cy };
  }
  return { x: cx, y: dy > 0 ? card.y + card.h : card.y };
}

/** Draw wrapped plain text; returns the height used. */
function wrapPlain(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return 0;
  const words = String(text).split(/\s+/);
  let line = "";
  let used = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + used);
      used += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + used);
    used += lineHeight;
  }
  return used;
}

/** Draw the rich text blocks of a note; returns the height used. */
export function paintRichText(ctx, blocks, x, y, maxWidth) {
  let cursor = y;
  const counters = new Map(); // "ol:indent" -> number
  ctx.textBaseline = "alphabetic";

  for (const block of blocks) {
    cursor += block.space || 0;
    if (block.type === "rule") {
      // the .rule divider: 1px ink line with 14px above it
      cursor += 4;
      ctx.fillStyle = TOKENS.ink;
      ctx.fillRect(x, cursor, maxWidth, 1);
      cursor += 14;
      continue;
    }

    if (!block.list) counters.clear();
    let marker = "";
    if (block.list && !block.continued) {
      const key = `${block.list}:${block.indent}`;
      const n = (counters.get(key) || 0) + 1;
      counters.set(key, n);
      marker = block.list === "ol" ? `${n}.` : "•";
    }
    const indent = (block.indent || 0) * 18;

    const size = block.lg ? TOKENS.textLg : TOKENS.text;
    const leading = block.lg ? TOKENS.leadingLg : TOKENS.leading;
    const lines = wrapRuns(ctx, block.runs, maxWidth - indent, size);
    if (!lines.length) lines.push([]);
    lines.forEach((line, i) => {
      const ly = cursor + size + (leading - size) / 2 + i * leading - 2;
      if (i === 0 && marker) {
        ctx.font = mono();
        ctx.fillStyle = TOKENS.ink;
        const mw = ctx.measureText(marker).width;
        ctx.fillText(marker, x + indent - mw - 6, ly);
      }
      let cx = x + indent;
      for (const part of line) {
        const run = part.style;
        ctx.font = fontFor(run, size);
        ctx.fillStyle = TOKENS.ink;
        ctx.fillText(part.text, cx, ly);
        if (run.u || run.href) ctx.fillRect(cx, ly + 3, part.width, 1);
        cx += part.width;
      }
    });
    cursor += lines.length * leading;
  }
  return cursor - y;
}

function domainOf(url) {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    return u.hostname.replace(/^www\./, "").toUpperCase();
  } catch {
    return String(url).toUpperCase();
  }
}
