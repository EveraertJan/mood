/*
 * Build sample-board.json: every card type, every label colour and both
 * connector styles, with Tastbaar copy.
 *
 * Run with: node tools/build-sample.js
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "sample-board.json");

let counter = 0;
function id(prefix) {
  counter += 1;
  return `${prefix}-${String(counter).padStart(3, "0")}-0000-4000-8000-000000000000`;
}

const cards = [];
const connectors = [];
const boardId = id("board");

// the logo, as the sample's image (stored once in assets, referenced by id)
const logo = readFileSync(join(here, "..", "assets", "logo.svg"), "utf8");
const logoAsset = {
  mime: "image/svg+xml",
  dataUrl: "data:image/svg+xml;base64," + Buffer.from(logo).toString("base64"),
  w: 100,
  h: 100
};
const logoId = id("asset");

function card(type, x, y, w, h, label, meta, color, data, extra = {}) {
  const c = {
    id: id("card"),
    type, x, y, w, h,
    z: cards.length + 1,
    rotation: 0,
    label: label ?? "",
    meta: meta ?? "",
    color: color || "ink",
    locked: false,
    parentColumnId: null,
    data: data || {}
  };
  Object.assign(c, extra);
  cards.push(c);
  return c;
}

/* ---------------------------------------------------------- the heading */
card("heading", 40, 30, 520, 80, "", "", "ink", { text: "Tastbaar" });

/* -------------------------------------------------- how we work (note) */
card("note", 40, 150, 360, 260, "How we work", "", "ink", {
  html:
    "<p><b>Research.</b> We dig into the place, the people and the problem before we design anything.</p>" +
    "<p><b>Think along.</b> We join your team as a creative partner, for a single brainstorm or the whole project.</p>" +
    "<p><b>Make it visible.</b> Sketches, visuals, prototypes: early and fast.</p>" +
    "<p class=\"rule\"><br></p>" +
    "<p>Take the whole route, or just the steps you need.</p>"
});

/* -------------------------------------------- experiences (note, lists) */
card("note", 440, 150, 360, 300, "Experiences", "", "cyan", {
  html:
    "<ul>" +
    "<li>Retail experiences</li>" +
    "<li>Immersive expos</li>" +
    "<li>Brand activations</li>" +
    "<li>Technical consultancy</li>" +
    "<li>Prototypes &amp; tangible interfaces</li>" +
    "<li>Anything with an experience angle</li>" +
    "</ul>"
});

/* ----------------------------------------------------- try this (note) */
card("note", 840, 150, 360, 180, "Try this", "1/40", "red", {
  html: "<p class=\"lg\">Hide a thank-you note where a stranger will find it.</p>"
});

/* ---------------------------------------------------------- a link card */
card("link", 40, 620, 360, 180, "Studio", "", "blue", {
  url: "https://tastbaar.studio",
  title: "Tastbaar — experience design studio",
  description: "We think along, make ideas visible, prototype and build."
});

/* ---------------------------------------------------------- a todo card */
card("todo", 440, 620, 360, 200, "To-do", "", "yellow", {
  items: [
    { id: id("item"), text: "Visit the space", done: true },
    { id: id("item"), text: "Sketch three routes", done: true },
    { id: id("item"), text: "Prototype the entrance", done: false },
    { id: id("item"), text: "Test with five people", done: false }
  ]
});

/* -------------------------------------------------------- a swatch card */
card("swatch", 840, 620, 170, 240, "Swatch", "", "magenta", {
  hex: "#1D2A44",
  name: "Brand navy"
});
card("swatch", 1030, 620, 170, 240, "Swatch", "", "green", {
  hex: "#FF00FF",
  name: "Accent magenta"
});

/* -------------------------------------------------------- an image card */
card("image", 1240, 620, 260, 260, "Logo", "", "ink", { assetId: logoId, caption: "Two strokes, one hand.", fit: "contain" });

/* -------------------------------------------------------- a column card */
const column = card("column", 840, 370, 360, 200, "Column", "", "green", { collapsed: false });
const kid1 = card("note", 0, 0, 220, 90, "Step 1", "", "ink", { html: "<p>Research the place.</p>" });
const kid2 = card("note", 0, 0, 220, 90, "Step 2", "", "ink", { html: "<p>Make it visible.</p>" });
kid1.parentColumnId = column.id;
kid2.parentColumnId = column.id;

/* --------------------------------------------------------- a board card */
const nested = {
  id: id("board"),
  name: "Retail ideas",
  parentId: boardId,
  titleColor: "blue",
  showTitle: true,
  grid: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  cards: [
    {
      id: id("card"), type: "note", x: 40, y: 40, w: 300, h: 160, z: 1, rotation: 0,
      label: "Entrance", meta: "", color: "ink", locked: false, parentColumnId: null,
      data: { html: "<p>Make the threshold feel like an invitation.</p>" }
    },
    {
      id: id("card"), type: "swatch", x: 380, y: 40, w: 200, h: 200, z: 2, rotation: 0,
      label: "Swatch", meta: "", color: "ink", locked: false, parentColumnId: null,
      data: { hex: "#00f", name: "Signal blue" }
    }
  ],
  connectors: []
};
card("board", 1240, 150, 260, 220, "Retail ideas", "", "blue", { boardId: nested.id });

/* --------------------------------------------------------- connectors */
connectors.push({
  id: id("conn"), from: cards[1].id, to: cards[2].id,
  style: "solid", arrow: "end", label: ""
});
connectors.push({
  id: id("conn"), from: cards[2].id, to: cards[3].id,
  style: "dashed", arrow: "both", label: ""
});
connectors.push({
  id: id("conn"), from: cards[3].id, to: column.id,
  style: "solid", arrow: "end", label: "then"
});

/* ------------------------------------------------------------ the board */
const board = {
  id: boardId,
  name: "Tastbaar",
  parentId: null,
  titleColor: "red",
  showTitle: true,
  grid: true,
  viewport: { x: 0, y: 50, zoom: 1 }, // clear of the toolbar
  cards,
  connectors
};

const doc = {
  app: "tastbaar-moodboard",
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  boards: [board, nested],
  assets: { [logoId]: logoAsset }
};

writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${out} (${cards.length} cards, ${connectors.length} connectors)`);
