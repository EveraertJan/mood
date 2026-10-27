# Tastbaar Moodboard

A Milanote-style moodboarding tool in the **Tastbaar** house style: white paper,
floating white windows with black uppercase label tabs, Courier Prime text,
one huge inverting Helvetica title and one accent colour that changes on every
visit. The look follows `TASTBAAR-tool-style.md`.

Plain HTML, CSS and JavaScript. No build step, no framework, no npm runtime.

---

## Run it

The app uses ES modules, so it needs a static server (opening `index.html` from
the file system will not work).

```sh
cd TOOLS/MOOD
python3 -m http.server 8000
#   or
npx serve .
```

Then open <http://localhost:8000>.

Everything is offline: Courier Prime is vendored in `assets/fonts/`, jsPDF in
`vendor/`. No CDN calls at runtime.

---

## Shortcuts

| Key | Action |
| --- | --- |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete the selected cards |
| `Cmd/Ctrl + D` | Duplicate |
| `Cmd/Ctrl + C` / `X` / `V` | Copy / cut / paste cards (they travel between tabs as JSON, images included). Pasting an image or a URL makes an image or link card |
| `Cmd/Ctrl + A` | Select all |
| `Esc` | Deselect |
| Arrow keys | Nudge 1px (`Shift` = 10px) |
| `N` | New note |
| `T` | New to-do |
| `H` | New heading |
| `G` | Toggle the dot grid |
| `+` / `-` | Zoom in / out |
| `0` | Zoom to fit |
| `1` | Zoom to 100% |
| `?` | Show the shortcuts |

Shortcuts are off while you are typing in a card.

### Mouse

One click selects, a drag moves, **a double-click changes** what is under the pointer.

| Double-click on… | Does |
| --- | --- |
| Empty paper | A new note, ready to type in |
| Card text (note, heading, caption, link, swatch name) | Edit it, caret where you clicked. Click the paper or press `Esc` to stop. One edit is one undo step |
| The label tab (or the empty bar where it goes) | Rename it inline; the seven label colours sit underneath |
| The tab top-right | Edit it (on a link: the URL; on a folded column: unfold) |
| A swatch's colour or hex | The colour picker |
| An image | Pick a new image file |
| A board card | Open that board |
| A column's empty body | Fold or unfold it |
| A connector | Its label |
| The board name in the toolbar | (a single click) Rename the board |

| Action | How |
| --- | --- |
| Move | Drag a card (5px threshold tells a click from a drag) |
| Resize | Drag a square corner handle (`Shift` keeps the image ratio) |
| Select several | Drag a marquee on the paper |
| Extend a selection | `Shift`-click a card |
| Connect two cards | Drag the small square handle on a card's edge to another card |
| Pan | Space + drag, middle mouse, or two-finger scroll |
| Zoom | `Cmd/Ctrl` + wheel, or pinch |
| Drop into a column | Drag a card onto it; drag it out again to take it out |
| More | Right-click a card, a connector or the paper (long-press on a touch screen) |

Hold `Alt` to turn snapping off.

---

## The JSON format

The JSON file is the source of truth. Everything visible on a board survives
export → import with nothing lost.

```jsonc
{
  "app": "tastbaar-moodboard",
  "schemaVersion": 1,
  "exportedAt": "2026-01-01T00:00:00.000Z",
  "boards": [
    {
      "id": "uuid",
      "name": "Tastbaar",
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
          "z": 0,
          "rotation": 0,
          "label": "the black label tab text",
          "meta": "the white 'year' tab text",
          "color": "ink | red | green | blue | yellow | cyan | magenta",
          "locked": false,
          "parentColumnId": "uuid | null",
          "data": {}
        }
      ],
      "connectors": [
        {
          "id": "uuid",
          "from": "cardId",
          "to": "cardId",
          "style": "solid | dashed",
          "arrow": "none | end | both",
          "label": ""
        }
      ]
    }
  ],
  "assets": {
    "assetId": { "mime": "image/png", "dataUrl": "data:…", "w": 0, "h": 0 }
  }
}
```

### `data` per card type

| Type | `data` |
| --- | --- |
| `note` | `{ html }` — bold, italic, underline, bullet and numbered lists, links and the `.rule` divider |
| `image` | `{ assetId, caption, fit }` — `fit` is `cover` or `contain` |
| `link` | `{ url, title, description }` |
| `todo` | `{ items: [{ id, text, done }] }` |
| `swatch` | `{ hex, name }` |
| `heading` | `{ text }` |
| `column` | `{ collapsed }` |
| `board` | `{ boardId }` |

Images are stored once in `assets` and referenced by id. `label` is the black
tab text, `meta` is the white tab text; either can be empty, which hides that
tab.

`js/state/schema.js` holds the format, `validate(doc)` returns a list of
readable errors and `migrate(doc)` upgrades older `schemaVersion`s.

---

## Changing the tokens

Every colour, size and shadow lives in `css/tokens.css`, which follows section 2
of `TASTBAAR-tool-style.md`:

```css
:root {
  --paper: #ffffff;
  --ink: #000000;
  --muted: #777;            /* inactive buttons, secondary text */
  --line: #ccc;             /* separators, guides */
  --accent: #0ff;           /* set per page load by the script in index.html */
  --accent-ink: #000;
  --accent-paint: #f00;     /* complement, for the inverting titles */
  --c-red: #f00;  --c-green: #0f0;  --c-blue: #00f;   /* card label colours */
  --c-yellow: #ff0;  --c-cyan: #0ff;  --c-magenta: #f0f;
  --mono: "Courier Prime", …;
  --display: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --shadow: rgba(0,0,0,.2) 0 6px 12px;
  --highlight: 1px solid var(--accent);
  --radius: 0;
  …
}
```

Change a value there and the whole tool follows. The PNG and PDF exports read
the same values from `js/io/draw.js`, so change them there too.

The accent is used sparingly: hover and press, the selected or dragged card (a thin accent
border, never a coloured shadow), focused inputs and the board title. Courier Prime is vendored rather
than imported from Google Fonts, so the tool works offline.

`design/tokens-preview.html` shows every token, the label tabs in all colours,
each card type and the toolbar.

---

## Layout

```
/index.html
/css/    tokens.css · base.css · board.css · ui.css
/js/     main.js
         state/    store.js · history.js · schema.js · persist.js
         canvas/   viewport.js · render.js · interact.js · edit.js · connectors.js
                  snap.js · columns.js · marquee.js · longpress.js
         cards/    one module per card type + common.js · formatbar.js
         io/       json.js · png.js · pdf.js · paint.js · draw.js · richtext.js
         ui/       toolbar.js · boards.js · shortcuts.js · dialogs.js
                  clipboard.js · contextmenu.js
/vendor/ jspdf.umd.min.js
/assets/ fonts/ (woff2 for the page, ttf/ for the PDF) · logo.svg · icons.svg
```

No file is longer than ~400 lines.

---

## Exports

- **JSON** — the current board (plus its nested boards) or every board.
  Named `boardname-YYYY-MM-DD.json`.
- **PNG** — drawn straight onto a `<canvas>` from state, not a DOM snapshot:
  the paper, the windows with their shadows, the tabs, wrapped Courier text,
  images, checkboxes, swatches, headings and the connectors. Whole board or
  current view, 1× / 2× / 3×, transparent (the default) or on white paper.
  `tastbaar.studio` sits small in the bottom-right corner.
- **PDF** — the PNG renderer placed into jsPDF. A4 / A3 / Letter, portrait,
  landscape or auto (per board), fitted on one page or tiled across pages. An
  optional header mirrors a card: the board name and the date as black labels,
  in Courier Prime. Footer: `tastbaar.studio`. EXPORT ALL BOARDS (PDF) puts every
  board on its own page(s), in board-list order.

The board title is drawn last with `globalCompositeOperation = "difference"`,
so it inverts over the cards exactly as it does on screen.

---

## Tests

```sh
node tools/build-sample.js    # rebuild sample-board.json
```

`sample-board.json` holds every card type, every label colour and both
connector styles, with Tastbaar copy.

---

## Phone and layout changes (2026-10-25)

- **Top bar:** one slim row: logo, board name (click to rename), undo, redo, and two menus. **View** holds Grid, Breathe and Board title. **File** holds Import, the exports and About. The menus are `.popmenu` elements in `index.html`, opened by `js/ui/menus.js`.
- **Add a card:** the black **+** button bottom-right opens a menu with every card type (Note, Image, Link, To-do, Swatch, Heading, Column, Board). Shortcuts (N, T, H) and double-click on the paper still work.
- **Remove:** a selected card (or selection) gets a black **REMOVE** button centred right above it, so cards can be deleted without a keyboard (`js/ui/removebar.js`). It hides while you type in a card.
- **Board title:** the big title is now the board's name, standing up along the right edge, inverting (accent on white, opposite over black). Longer names get smaller type so the name always runs a little longer than the screen (`render.js` sets `--title-size`). The View menu's Board title toggle hides it. PNG and PDF exports still use the big centred title.
- **Browser tab:** `<board name> — Mood`.
- **Loading:** a full-screen white start-up loader (inline in `index.html`): a black MOOD label, an 8px bar with a hard accent shadow, and a status word (LOADING, STARTING, READY). `main.js` calls `TB_LOAD(88, "STARTING", true)` as it boots and `TB_LOAD(100, "READY", true)` once the fonts are in and the board is drawn. If a script fails, the loader hides and a black bar at the bottom says SOMETHING WENT WRONG. The font and `main.js` are preloaded, and jsPDF (360 KB) is only fetched the first time you export a PDF.
- **Phones:** safe-area insets for notches and the home bar, dialogs shrink to the screen width, 16px dialog fields (no iOS zoom on focus), no pull-to-refresh while panning.
