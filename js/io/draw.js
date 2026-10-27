/*
 * TASTBAAR moodboard — canvas drawing primitives.
 *
 * Draws cards, tabs, text, images, checkboxes, swatches, headings and
 * connectors straight onto a 2D canvas context, using the same tokens as the
 * stylesheets. Nothing here reads the DOM of the app.
 */

export const TOKENS = {
  paper: "#ffffff",
  ink: "#000000",
  line: "#cccccc",
  muted: "#777777",
  footer: "#aaaaaa",
  text: 14,
  leading: 18,
  textUi: 13,
  textSm: 11,
  textLg: 18,
  leadingLg: 24,
  cardPad: 40,
  cardPadSm: 20,
  gap: 10,
  listGap: 8,
  mono: '"Courier Prime", "Courier New", Courier, monospace',
  display: '"Helvetica Neue", Helvetica, Arial, sans-serif'
};

const COLORS = {
  ink: "#000000",
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff"
};

const DARK_TABS = new Set(["green", "yellow", "cyan"]);

export function colorOf(name) {
  return COLORS[name] || COLORS.ink;
}

export function tabTextColor(name) {
  return DARK_TABS.has(name) ? "#000000" : "#ffffff";
}

/** The complement of a colour (swap 0 and f). */
export function complement(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return "#" + full.split("").map(c => (c === "f" ? "0" : c === "0" ? "f" : c)).join("");
}

export function mono(size = TOKENS.text, weight = 400, italic = false) {
  return `${italic ? "italic " : ""}${weight} ${size}px ${TOKENS.mono}`;
}

/** Draw the white window with its resting shadow. */
export function drawWindow(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.2)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  ctx.shadowOffsetX = 0;
  ctx.fillStyle = TOKENS.paper;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Draw the label tab (top-left) and the meta tab (top-right).
 *
 * @returns {number} the height of the bar
 */
export function drawTabs(ctx, card, x, y, w, metaText) {
  const barH = 21;
  const label = String(card.label || "").toUpperCase();
  const meta = String(metaText ?? card.meta ?? "").toUpperCase();
  ctx.textBaseline = "alphabetic";

  if (label) {
    ctx.font = mono(TOKENS.textUi);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = colorOf(card.color);
    ctx.fillRect(x, y, tw + 12, barH);
    ctx.fillStyle = tabTextColor(card.color);
    ctx.fillText(label, x + 6, y + 15);
  }
  if (meta) {
    // counters and meta: a small black label flush top-right
    ctx.font = mono(TOKENS.textSm);
    const tw = ctx.measureText(meta).width;
    const mx = x + w - (tw + 10);
    ctx.fillStyle = TOKENS.ink;
    ctx.fillRect(mx, y, tw + 10, 17);
    ctx.fillStyle = TOKENS.paper;
    ctx.fillText(meta, mx + 5, y + 12);
  }
  return barH;
}

/** Draw text with a fixed letter spacing (canvas has no tracking everywhere). */
export function drawTracked(ctx, text, x, y, tracking) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return cx - x;
}

/** Draw an underlined link. */
export function drawLink(ctx, text, x, y, right = false, width = 0) {
  ctx.font = mono();
  const tw = ctx.measureText(text).width;
  const tx = right ? x + width - tw : x;
  ctx.fillStyle = TOKENS.ink;
  ctx.fillText(text, tx, y);
  ctx.fillRect(tx, y + 3, tw, 1);
  return tw;
}

/** Draw the dot grid of the paper: black dots at 9%, on the same 24px grid as the screen. */
export function drawGrid(ctx, x, y, w, h, step = 24) {
  ctx.save();
  ctx.fillStyle = TOKENS.ink;
  ctx.globalAlpha = 0.09;
  const x0 = Math.ceil(x / step) * step;
  const y0 = Math.ceil(y / step) * step;
  ctx.beginPath();
  for (let gy = y0; gy < y + h; gy += step) {
    for (let gx = x0; gx < x + w; gx += step) {
      ctx.moveTo(gx + 1, gy);
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

/** Footer, bottom-right: tastbaar.studio in #aaa, 11px mono. */
export function drawFooter(ctx, x, y, w, h) {
  ctx.save();
  ctx.font = mono(TOKENS.textSm);
  ctx.fillStyle = TOKENS.footer;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("tastbaar.studio", x + w - 16, y + h - 14);
  ctx.restore();
}

/** The accent of this page load (index.html picks it). */
export function pageAccent() {
  return window.TB_ACCENT || "#f00";
}

/** A square checkbox, filled ink when done. */
export function drawCheckbox(ctx, x, y, done) {
  ctx.save();
  ctx.strokeStyle = TOKENS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 14, 14);
  if (done) {
    ctx.fillStyle = TOKENS.ink;
    ctx.fillRect(x + 1, y + 1, 13, 13);
  }
  ctx.restore();
}
