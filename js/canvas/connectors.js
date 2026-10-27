/*
 * TASTBAAR moodboard — connector interaction.
 *
 * Drag from a small square handle on a card edge to another card to create a
 * connector. Lines are 1.5px ink, dashed optional, with arrowheads drawn as
 * open "V"s with round caps, like the logo strokes. The handles themselves are
 * added to every card by render.js.
 */

import { getCurrentBoard, addConnector, setSelection } from "../state/store.js";
import { createConnector } from "../state/schema.js";
import { screenToBoard } from "./viewport.js";
import { render } from "./render.js";
import { push } from "../state/history.js";

let svgLayer = null;
let paper = null;
let active = null; // { fromId, from, to, preview }

export function initConnectors(dom) {
  svgLayer = dom.connectorsLayer;
  paper = dom.paper;

  paper.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest("[data-connector-handle]");
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    startConnector(e, handle);
  }, true);

  window.addEventListener("pointermove", (e) => {
    if (!active) return;
    active.to = screenToBoard(e.clientX, e.clientY);
    draw();
  });

  window.addEventListener("pointerup", (e) => {
    if (!active) return;
    finishConnector(e);
  });
}

function startConnector(e, handle) {
  const cardId = handle.dataset.connectorHandle;
  const board = getCurrentBoard();
  const card = board.cards.find(c => c.id === cardId);
  if (!card) return;
  const el = handle.closest(".card");
  const h = el ? el.offsetHeight : card.h;
  active = {
    fromId: cardId,
    from: { x: card.x + card.w, y: card.y + h / 2 },
    to: screenToBoard(e.clientX, e.clientY),
    preview: null
  };
  draw();
}

function finishConnector(e) {
  if (!active) return;
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".board-layer .card");
  const board = getCurrentBoard();
  const target = under && board.cards.find(c => c.id === under.dataset.id && c.id !== active.fromId && !c.parentColumnId);
  const exists = target && board.connectors.some(c =>
    (c.from === active.fromId && c.to === target.id) || (c.from === target.id && c.to === active.fromId));
  cancelConnector();
  if (target && !exists) {
    push("connect");
    const conn = createConnector(active.fromId, target.id);
    addConnector(conn);
    setSelection([], [conn.id]);
  }
  active = null;
}

function cancelConnector() {
  active?.preview?.remove();
  render();
}

/** Draw the line being dragged on top of the existing connectors. */
function draw() {
  if (!svgLayer || !active) return;
  if (!active.preview || !active.preview.isConnected) {
    active.preview = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgLayer.appendChild(active.preview);
  }
  const a = active.from;
  const b = active.to;
  active.preview.innerHTML =
    `<path class="connector is-dashed" d="M${a.x} ${a.y} L${b.x} ${b.y}"/>` +
    `<circle class="connector__dot" cx="${b.x}" cy="${b.y}" r="4"/>`;
}
