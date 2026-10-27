/*
 * TASTBAAR moodboard — snapping and alignment guides.
 *
 * Cards snap to an 8px grid and to other cards' edges and centres, with 1px
 * --line guides. Holding alt turns snapping off (see interact.js).
 */

const GRID = 8;
const THRESHOLD = 6; // screen px tolerance

/**
 * Compute a snapped position for a moving card.
 *
 * @param {object} move  {x, y, w, h} the desired position
 * @param {Array}  cards other cards on the board (not moving)
 * @param {number} zoom current zoom
 * @returns {{x:number, y:number, guides:Array}}
 */
export function snapMove(move, cards, zoom) {
  const tol = THRESHOLD / zoom;
  const guides = [];

  const xs = [];
  const ys = [];

  for (const c of cards) {
    xs.push({ v: c.x, edge: "start" });
    xs.push({ v: c.x + c.w / 2, edge: "center" });
    xs.push({ v: c.x + c.w, edge: "end" });
    ys.push({ v: c.y, edge: "start" });
    ys.push({ v: c.y + c.h / 2, edge: "center" });
    ys.push({ v: c.y + c.h, edge: "end" });
  }

  const moving = {
    xs: [move.x, move.x + move.w / 2, move.x + move.w],
    ys: [move.y, move.y + move.h / 2, move.y + move.h]
  };

  let bestX = null;
  for (const m of moving.xs) {
    for (const t of xs) {
      const d = Math.abs(m - t.v);
      if (d <= tol && (!bestX || d < bestX.d)) {
        bestX = { d, delta: t.v - m, v: t.v, edge: t.edge };
      }
    }
  }

  let bestY = null;
  for (const m of moving.ys) {
    for (const t of ys) {
      const d = Math.abs(m - t.v);
      if (d <= tol && (!bestY || d < bestY.d)) {
        bestY = { d, delta: t.v - m, v: t.v, edge: t.edge };
      }
    }
  }

  let x = move.x;
  let y = move.y;

  if (bestX) {
    x = move.x + bestX.delta;
    guides.push({ axis: "v", at: bestX.v });
  } else {
    const g = Math.round(move.x / GRID) * GRID;
    if (Math.abs(g - move.x) <= tol) x = g;
  }

  if (bestY) {
    y = move.y + bestY.delta;
    guides.push({ axis: "h", at: bestY.v });
  } else {
    const g = Math.round(move.y / GRID) * GRID;
    if (Math.abs(g - move.y) <= tol) y = g;
  }

  return { x, y, guides };
}

/**
 * Snap the resizing edge of a card.
 *
 * @returns {{w:number, h:number, guides:Array}}
 */
export function snapResize(rect, edge, cards, zoom) {
  const tol = THRESHOLD / zoom;
  const guides = [];

  const xs = [];
  const ys = [];
  for (const c of cards) {
    xs.push(c.x, c.x + c.w / 2, c.x + c.w);
    ys.push(c.y, c.y + c.h / 2, c.y + c.h);
  }

  let w = rect.w;
  let h = rect.h;

  if (edge.includes("e")) {
    const right = rect.x + rect.w;
    let best = null;
    for (const v of xs) {
      const d = Math.abs(right - v);
      if (d <= tol && (!best || d < best.d)) best = { d, v };
    }
    if (best) {
      w = best.v - rect.x;
      guides.push({ axis: "v", at: best.v });
    }
  }
  if (edge.includes("s")) {
    const bottom = rect.y + rect.h;
    let best = null;
    for (const v of ys) {
      const d = Math.abs(bottom - v);
      if (d <= tol && (!best || d < best.d)) best = { d, v };
    }
    if (best) {
      h = best.v - rect.y;
      guides.push({ axis: "h", at: best.v });
    }
  }

  return { w, h, guides };
}

/** Render alignment guides into the guide layer (board coordinates). */
export function drawGuides(layer, guides) {
  if (!layer) return;
  layer.replaceChildren();
  for (const g of guides) {
    const div = document.createElement("div");
    div.className = `guide guide--${g.axis}`;
    if (g.axis === "v") {
      div.style.left = `${g.at}px`;
      div.style.top = "-10000px";
      div.style.height = "20000px";
    } else {
      div.style.top = `${g.at}px`;
      div.style.left = "-10000px";
      div.style.width = "20000px";
    }
    layer.appendChild(div);
  }
}
