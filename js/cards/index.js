/*
 * TASTBAAR moodboard — card type registry.
 *
 * One module per card type. Each exposes create(card), update(el, card) and
 * an optional mount(el, card) that runs once the element is in the DOM.
 */

import { note } from "./note.js";
import { image } from "./image.js";
import { link } from "./link.js";
import { todo } from "./todo.js";
import { swatch } from "./swatch.js";
import { heading } from "./heading.js";
import { column } from "./column.js";
import { board } from "./board.js";

export const TYPES = { note, image, link, todo, swatch, heading, column, board };

export function getType(type) {
  return TYPES[type] || note;
}

/** Minimum sizes per card type, used by the resize handles. */
export const MIN_SIZE = {
  note: { w: 180, h: 80 },
  image: { w: 160, h: 140 },
  link: { w: 200, h: 120 },
  todo: { w: 200, h: 120 },
  swatch: { w: 120, h: 160 },
  heading: { w: 80, h: 40 },
  column: { w: 180, h: 160 },
  board: { w: 200, h: 140 }
};

/** Default size per card type. */
export const DEFAULT_SIZE = {
  note: { w: 360, h: 200 },
  image: { w: 360, h: 280 },
  link: { w: 300, h: 180 },
  todo: { w: 300, h: 200 },
  swatch: { w: 200, h: 200 },
  heading: { w: 400, h: 80 },
  column: { w: 260, h: 320 },
  board: { w: 300, h: 240 }
};

export { drawMini } from "./board.js";
