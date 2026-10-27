# Moodboard tool — task list for opencode

A Milanote-style moodboarding tool in the **Tastbaar** house style, built in plain HTML/CSS/JS. Boards are saved and loaded as JSON files and exported as PNG or PDF.

The style comes from the Tastbaar studio site (`tastbaar.studio`, source in `SITE/experiencedesign`: `css/home.css`, `index.html`, `scripts/windows.js`, `images/logo.svg`). The board should feel like that homepage turned into a working tool: white paper, floating white windows with black uppercase label tabs, Courier text, and one huge inverting Helvetica title.

## Review notes (2026-10-22) — read before changing anything

- **The look follows `TASTBAAR-tool-style.md`** where it differs from Phase 0 below: greys `#777` / `#ccc`; one random accent per page load (`--accent`, set in `index.html`'s `<head>`) for hover, press, the selected or dragged card (a thin 1px accent border — no coloured shadows anywhere, a deliberate change from the style guide's hard shadow), focused inputs and the board title; a full-width 44px toolbar with a 28px logo linking to tastbaar.studio and the board name as a black label (click to rename); the counter / meta tab is a small black label; the tool name MOOD stands up along the right edge in `#ececec` behind the board; connectors are thin neutral grey; menus underline on hover and DELETE is `#d00`; dialogs sit on a light veil; PNG exports are transparent by default with a `tastbaar.studio` footer; the phone breakpoint is 600px with file actions in a bottom bar. `board.titleColor` is still in the file format but the screen and exports use the page's accent.
- Courier Prime stays vendored (offline-first wins over the style guide's Google Fonts import).
- **Double-click changes things** (`js/canvas/edit.js`): text, the label tab (with the label colours underneath), the tab top-right, a swatch's colour, an image, a column's fold, a connector's label. A single click only selects; text is only editable while it is being edited.
- Text cards grow to fit their content; the drawn height is written back to `card.h`.
- The board list sits inside the paper's layer, under the cards.

## Ground rules (read first)

- **No build step, no framework, no npm runtime.** Plain `index.html`, ES modules (`<script type="module">`), plain CSS. Must work from a static server (`npx serve` / `python -m http.server`).
- **Only allowed third-party code:** `jsPDF`, saved as a single file in `/vendor/`. Everything else is hand-written. No html2canvas.
- **Offline-first.** No CDN calls at runtime. Courier Prime is vendored in `/assets/fonts/`.
- **The JSON file is the source of truth.** Everything visible on a board must survive export → import with nothing lost.
- **Follow the Tastbaar tokens in Phase 0 exactly.** Don't add rounded corners, gradients, extra greys or extra fonts.
- Keep modules small and single-purpose. No file over ~400 lines. Comment the top of each file the way `scripts/windows.js` does (what it does, how to use it).
- After each phase: run the app, check the browser console is clean, tick the boxes in this file.

## Target file structure

```
/index.html
/css/
  tokens.css        # Tastbaar design tokens (Phase 0)
  base.css          # reset, typography, layout shell
  board.css         # paper, cards (windows), connectors, selection, title
  ui.css            # toolbar, board list, menus, dialogs, toasts
/js/
  main.js
  state/store.js    state/history.js    state/schema.js    state/persist.js
  canvas/viewport.js  canvas/render.js  canvas/interact.js  canvas/connectors.js
  cards/*.js        # one module per card type
  io/json.js        io/png.js           io/pdf.js
  ui/toolbar.js  ui/boards.js  ui/shortcuts.js  ui/dialogs.js
/vendor/jspdf.umd.min.js
/assets/fonts/CourierPrime-{Regular,Bold,Italic,BoldItalic}.woff2
/assets/logo.svg    # copy of SITE/experiencedesign/images/logo.svg with the <metadata> block removed
/assets/icons.svg   # SVG sprite, drawn like the logo (see Phase 0)
/design/tokens-preview.html
```

---

## Phase 0 — Tastbaar tokens

- [x] Create `css/tokens.css` with exactly these values (taken from `css/home.css`):

```css
:root {
  /* colour */
  --paper: #ffffff;          /* page and card background */
  --ink: #000000;            /* text, label tabs, rules, outlines */
  --line: #aaaaaa;           /* the only grey for lines: grid dots, guides, inactive connectors */
  --muted: #888888;          /* the only grey for text: secondary text, small headings */
  --brand-navy: #1d2a44;     /* logo stroke only */

  /* accent set: every mix of 0 and f, never black or white */
  --c-red: #f00;  --c-green: #0f0;  --c-blue: #00f;
  --c-yellow: #ff0;  --c-cyan: #0ff;  --c-magenta: #f0f;

  /* type */
  --mono: "Courier Prime", "Courier New", Courier, monospace;      /* all UI and card text */
  --display: "Helvetica Neue", Helvetica, Arial, sans-serif;       /* the big title and heading cards only */
  --text: 14px;  --leading: 18px;                                  /* body: 14/18 mono */
  --text-lg: 18px;  --leading-lg: 24px;                            /* note emphasis, like .ritual__text */
  --display-weight: 800;  --display-tracking: -0.075em;  --display-leading: 1;
  --title-size: clamp(64px, 15.5vw, 300px);

  /* shape */
  --radius: 0;               /* square corners everywhere, no exceptions */
  --rule: 1px solid var(--ink);
  --focus: 2px solid var(--ink);  --focus-offset: 2px;

  /* spacing */
  --card-pad: 40px;          /* like .win__body; 28px below 800px */
  --card-pad-sm: 20px;       /* small cards: swatch, link, heading */
  --gap: 10px;               /* paragraph spacing */
  --list-gap: 8px;
  --edge: 30px;              /* distance of fixed UI from the screen edges */
  --card-w: 360px;           /* default note width (= --win-w) */

  /* shadow */
  --shadow-rest: rgba(0,0,0,.2) 0 6px 12px;
  --shadow-float: rgba(0,0,0,.16) 0 12px 22px;   /* top of the breathing loop */
  --shadow-drag: rgba(0,0,0,.25) 0 14px 28px;
}
```

- [x] Download Courier Prime (Google Fonts, OFL licence) as woff2 into `/assets/fonts/` and `@font-face` it. Helvetica Neue stays a system font (it can't be vendored), with Arial as the fallback, the same as on the site.
- [x] Text: everything is `14px/18px var(--mono)` with antialiased font smoothing. Labels, buttons, menu items and "more →" links are UPPERCASE. Bold is 700. Links are ink-coloured and underlined.
- [x] **Card = Tastbaar window.** White, square corners, `--shadow-rest`, no border. The title sits in a black label tab (`background: var(--ink); color: #fff; padding: 2px 6px; uppercase`) flush in the top-left corner. An optional white "year" tab sits flush top-right (use it for meta: date, item count, "linked"). The body has `--card-pad` padding.
- [x] **Card colour = label tab colour.** The card body always stays white. The colour picker offers ink (default) plus the six accent colours. On `--c-yellow`, `--c-green` and `--c-cyan` the tab text turns black so it stays readable.
- [x] **Image cards** are like the site's `win--project`: the image runs edge to edge, and the label tab overlaps the image's top edge (`margin-bottom: -22px`).
- [x] **Paper (canvas):** plain `--paper`. Optional dot grid in `--line`, off by default, toggled from the toolbar.
- [x] **Board title:** the board name is drawn the way the site draws TASTBAAR: centred in the viewport, `--display` 800, `--title-size`, `letter-spacing: -0.075em`, `mix-blend-mode: difference`, `pointer-events: none`, above the cards. Per board, store a title colour from the accent set (random when the board is created, like the site's per-load colour). Paint it in the complement (swap 0↔f) so it shows as the chosen colour on white. A toolbar toggle hides it while working.
- [ ] **Motion:** cards may "breathe" with the site's `float` keyframes (8s ease-in-out, 4px lift, shadow from rest to float, a different duration and delay per card). Off by default, on with a "Breathe" toggle. Paused on the selected or dragged card. Fully off under `prefers-reduced-motion`. When a card is called forward (from search or the board list), play the site's `called` nudge (0.6s scale 1.035 with a slight rotate).
- [ ] **Dragging:** `cursor: grab`, `grabbing` and `--shadow-drag` while dragging, and the dragged card comes to the front. Same feel as `scripts/windows.js`, including the 5px move threshold that tells a click from a drag.
- [ ] **Selection:** a `--focus` outline at `--focus-offset`. Multi-select uses the same outline. The marquee is a 1px dashed ink rectangle with no fill.
- [x] **Icons:** `/assets/icons.svg` sprite drawn like the logo: `viewBox 0 0 100 100`, no fill, `stroke: currentColor`, `stroke-width: 6.5`, round caps and joins, few strokes. Icons are always paired with an uppercase label, except in the compact zoom controls.
- [ ] Build `design/tokens-preview.html` showing every token, the label-tab variants in all colours, each card type, the board title over a few cards, and the toolbar. Get sign-off before Phase 1.

## Phase 1 — App shell

- [ ] `index.html` regions: the full-screen paper with the board, a toolbar, a board list, and the board title layer.
- [ ] **Toolbar:** a white panel with `--shadow-rest` along the top edge at `--edge` from the sides. Uppercase text buttons: NOTE, IMAGE, LINK, TO-DO, SWATCH, HEADING, COLUMN, BOARD, then UNDO / REDO, then IMPORT / EXPORT ▾. Active or pressed state: inverted (black background, white text), like the site's `aria-current` quicklink.
- [ ] **Board list:** styled like the site's quicklinks panel. A white 220px panel, fixed bottom-right at `--edge`, uppercase links, the current board inverted. Below it: NEW BOARD, plus RENAME / DUPLICATE / DELETE in a context menu. The panel sits underneath the cards, so cards slide over it, and it collapses to a single "BOARDS" tab.
- [ ] **Zoom controls:** a small white panel bottom-left: `−`, a percentage readout, `+`, FIT.
- [ ] The Tastbaar logo (56px, navy) sits in the top-left corner of the toolbar and opens an "About" window that works like the site's info card.
- [ ] Below 800px: the toolbar collapses into a MENU button, and the board list becomes a full-width overlay. Use the site's 800px breakpoint.
- [ ] Light theme only. The site has no dark mode.

## Phase 2 — State and data model

- [ ] `state/schema.js` defines the document format:

```json
{
  "app": "tastbaar-moodboard",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "boards": [
    {
      "id": "uuid",
      "name": "string",
      "parentId": "uuid | null",
      "titleColor": "red | green | blue | yellow | cyan | magenta",
      "showTitle": true,
      "grid": false,
      "viewport": { "x": 0, "y": 0, "zoom": 1 },
      "cards": [
        {
          "id": "uuid",
          "type": "note | image | link | todo | swatch | heading | column | board",
          "x": 0, "y": 0, "w": 360, "h": 200,
          "z": 0, "rotation": 0,
          "label": "string",
          "meta": "string",
          "color": "ink | red | green | blue | yellow | cyan | magenta",
          "locked": false,
          "parentColumnId": "uuid | null",
          "data": {}
        }
      ],
      "connectors": [
        { "id": "uuid", "from": "cardId", "to": "cardId",
          "style": "solid | dashed", "arrow": "none | end | both", "label": "" }
      ]
    }
  ],
  "assets": {
    "assetId": { "mime": "image/jpeg", "dataUrl": "data:...", "w": 0, "h": 0 }
  }
}
```

  `label` is the black tab text and `meta` is the white "year" tab text. Either can be empty, which hides that tab.

- [ ] Per-type `data` shapes documented in `schema.js`: note `{html}`, image `{assetId, caption, fit}`, link `{url, title, description}`, todo `{items:[{id,text,done}]}`, swatch `{hex, name}`, heading `{text}`, column `{collapsed}`, board `{boardId}`.
- [ ] Images are stored once in `assets` and referenced by id.
- [ ] `validate(doc)` returns a list of readable errors. `migrate(doc)` upgrades older `schemaVersion`s.
- [ ] `store.js`: a single state object, pure action functions (`addCard`, `moveCards`, `updateCard`, `deleteCards`, `connect`, …), and `subscribe(listener)`.
- [ ] `history.js`: undo/redo over actions. A continuous drag counts as one step. Limit 200 steps.
- [ ] `persist.js`: debounced autosave to IndexedDB, and restore the last open board on load.

## Phase 3 — Canvas

- [ ] Infinite paper. Pan with space+drag, middle mouse, or trackpad two-finger scroll. Zoom with ctrl/cmd+wheel or pinch, centred on the cursor, from 10% to 400%.
- [ ] `viewport.js` exposes `screenToBoard` / `boardToScreen`, and all interaction code goes through them.
- [ ] Cards are absolutely positioned DOM elements in one transformed layer (`transform: translate() scale()`). The board title layer stays outside the transform, fixed to the viewport.
- [ ] Only re-render cards that changed (keyed by id).
- [ ] "Zoom to fit" and "Reset zoom" commands.

## Phase 4 — Cards

- [ ] **Note:** the label tab plus a rich-text body (bold, italic, underline, bullet and numbered lists, link, and a "rule" that inserts the site's `.note` divider: a 1px ink line with 14px space above it). Edited through `contenteditable` with a small floating format bar (white, shadow, uppercase B / I / U / LIST / LINK). Pasted HTML is cleaned down to that subset.
- [ ] **Image:** add from the file picker, drag-and-drop or paste. Images over 2400px on the long side are scaled down. Full-bleed, with the label tab overlapping the top edge. Optional caption in the body below the image. Fit is cover or contain.
- [ ] **Link:** paste a URL. The meta tab shows the domain in uppercase, the title and description are editable, and the card ends with an uppercase "OPEN →" link aligned right, like the site's `.more`. No preview fetching.
- [ ] **To-do:** add, remove and reorder items. Checkboxes are square 14px ink boxes, filled ink when done. Done items are struck through in `--muted`. The meta tab shows a count like "3/7".
- [ ] **Swatch:** a block of colour filling the top of the card, the hex in uppercase mono below it, and an editable name. Clicking copies the hex (with a toast).
- [ ] **Heading:** a large `--display` 800 text with `-0.075em` tracking. No card background or shadow, just type on paper.
- [ ] **Column:** a tall white window with a label tab. Cards dropped on it snap into a vertical list with 10px gaps and can be reordered. Collapsing it shows only the label tab plus a count.
- [ ] **Board card:** a window whose body shows a miniature of the nested board (redrawn when that board changes), with the meta tab "OPEN". Double-click opens the board. A breadcrumb in the toolbar (uppercase, separated by `/`) leads back.
- [ ] Every card: label colour, lock and unlock, duplicate, delete, bring forward and send back.

## Phase 5 — Interaction

- [ ] Click to select, shift-click to add to the selection, marquee-drag on empty paper to select several.
- [ ] Drag to move (selected cards move together). The 5px threshold from `windows.js` separates a click from a drag. Resize handles are small square ink handles on the corners, with minimum sizes per type. Shift keeps the image aspect ratio.
- [ ] Snap to an 8px grid and to other cards' edges and centres, with 1px `--line` guides. Hold alt to turn snapping off.
- [ ] Double-click on empty paper adds a note there.
- [ ] Right-click opens a context menu: a white panel with shadow and uppercase items, the hovered item inverted.
- [ ] **Connectors:** drag from a small square handle on a card edge to another card. Lines are 1.5px ink, dashed optional, with arrowheads drawn as open "V"s with round caps, like the logo strokes. Labels go in a small white tab in the middle of the line. A selected connector turns a 2px line.
- [ ] Copy, cut and paste cards within and between boards (internal clipboard, plus the system clipboard as JSON).
- [ ] Shortcuts (`ui/shortcuts.js`) with a `?` overlay shown as a Tastbaar window: undo/redo, delete, duplicate, select all, arrow nudge (1px, or 10px with shift), N note, T to-do, H heading, G toggle grid, zoom in/out/fit, Esc to deselect.
- [ ] Shortcuts are off while typing in a card.

## Phase 6 — JSON import / export

- [ ] Export the current board, or all boards, as `.json` (`Blob` + `URL.createObjectURL`), named `boardname-YYYY-MM-DD.json`.
- [ ] The export includes nested boards and only the assets in use.
- [ ] Import from the file picker, or by dropping a `.json` on the window.
- [ ] Run `validate` and `migrate`. If there are errors, list them in a dialog window and import nothing.
- [ ] If ids clash, ask whether to REPLACE or IMPORT AS COPY (new ids, with references remapped).
- [ ] Round-trip test: export → clear storage → import → the document is deep-equal.

## Phase 7 — PNG export

- [ ] `io/png.js` draws the board **directly onto a `<canvas>` from state**, not from a DOM screenshot: the paper (plus grid if on), cards with `--shadow-rest` (canvas `shadowBlur` / `shadowOffsetY`), label and meta tabs, wrapped Courier text, images, checkboxes, swatches, headings, connectors with V arrowheads and label tabs.
- [ ] **Board title:** if it is shown, draw it last using `globalCompositeOperation = "difference"` in the complement colour, so the export inverts over cards the same way the screen does.
- [ ] Wait for `document.fonts.ready` and use the same font stacks as the CSS.
- [ ] Options window: whole board (bounding box of all cards plus 80px padding, the site's `--pad`) or current view. Scale 1× / 2× / 3×. Paper on or off (off gives a transparent PNG, and the title is then drawn in its plain colour instead of with difference).
- [ ] Cap the canvas at about 16k px per side. If that's exceeded, warn and lower the scale.
- [ ] Visual check: export a board with every card type and compare it side by side with the screen.

## Phase 8 — PDF export

- [ ] `io/pdf.js` reuses the PNG renderer and places the result with jsPDF.
- [ ] Options: A4 / A3 / Letter, portrait / landscape / auto. Either fit on one page, or tile across pages with a small overlap.
- [ ] Optional header: a black label tab with the board name in the top-left and a white meta tab with the date in the top-right, mirroring a card. Both in Courier Prime, which needs registering with jsPDF (`addFileToVFS` + `addFont`) if the header is drawn as PDF text rather than as an image.
- [ ] Small footer: `TASTBAAR` in Helvetica 800 with tight tracking, bottom-right, in `--muted`.
- [ ] EXPORT ALL BOARDS puts each board on its own page(s), in board-list order.

## Phase 9 — Polish and QA

- [ ] Empty board: only the big board title and one note window at 30,30 (like the site's info card) saying something in the Tastbaar voice, for example: "Empty board. Double-click anywhere to start. Ideas are nice. Tangible is better."
- [ ] Toasts: a small black label tab sliding in bottom-centre, uppercase ("SAVED", "IMPORTED 3 BOARDS", "EXPORT FAILED: …"), gone after 2.5s.
- [ ] Dialogs (import errors, export options, confirm delete) are Tastbaar windows centred on screen, with a translucent white backdrop.
- [ ] Focus: the `--focus` outline on everything focusable. ARIA labels on icon-only buttons. The toolbar works from the keyboard alone.
- [ ] Performance: 300 cards and 50 images pan and zoom smoothly, with breathing off. Autosave never blocks a drag.
- [ ] Test in the latest Chrome, Firefox and Safari.
- [ ] Ship `sample-board.json` with every card type, every label colour and both connector styles, using Tastbaar copy (the "How we work" steps, the experiences list, a "Try this" ritual) as content.
- [ ] `README.md`: how to run, the shortcuts, a JSON format summary, and how to change the tokens.

## Definition of done

- Opens from a static server with no build step and no console errors.
- Side by side with tastbaar.studio, cards read as the same windows: same tabs, type, shadow, square corners, motion.
- Every card type can be created, edited, moved, resized, connected, deleted and undone.
- JSON export → import loses nothing, including images and nested boards.
- PNG and PDF exports match the screen, including the inverting board title.
