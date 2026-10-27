# Tastbaar — style guide for tools

How Tastbaar tools look and feel. Distilled from tastbaar.studio and the Interlinked rebrand (v59), so new tools start in the right place instead of being restyled afterwards.

**In one line:** white paper, black ink, a typewriter voice, frames that float, and one loud colour that changes every visit.

---

## 1. Principles

- **Paper and ink.** Everything is black on white. Grey is only for things that should step back.
- **Frames, not boxes.** Cards and panels have no outline. A soft shadow lifts them off the page.
- **Labels speak in black boxes.** Headings, tags, counters and the current state sit in small black, uppercase labels.
- **One accent, chosen by chance.** Each page load picks one bright colour. It's used sparingly, for the moment of interaction: hover, selection, focus, the title.
- **The name is part of the page.** The tool's name is set big, cropped by the screen edge, never as a neat logo lock-up.
- **Tangible over clever.** Things should feel like you can touch them. Prefer one good interaction over five features.

---

## 2. Tokens

Paste this at the top of every tool's stylesheet.

```css
@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap');

:root {
  --paper: #ffffff;
  --ink: #000000;
  --muted: #777;          /* inactive buttons, secondary text */
  --line: #ccc;           /* separators */
  --mono: "Courier Prime", "Courier New", Courier, monospace;
  --display: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --shadow: rgba(0, 0, 0, 0.2) 0px 6px 12px;

  /* set per page load by the accent script (section 4) */
  --accent: #0ff;
  --accent-ink: #000;     /* text on top of the accent */
  --accent-paint: #f00;   /* complement, for inverted titles */
  --accent-soft: color-mix(in srgb, var(--accent) 22%, white);
}
```

---

## 3. Typography

| Role | Font | Size / line | Style |
|---|---|---|---|
| Body, UI, buttons | `--mono` (Courier Prime) | 13–14px / 17–18px | Sentence case for text, **UPPERCASE** for UI |
| Labels | `--mono` | 13px / 17px | Uppercase, white on black, `padding: 2px 6px` |
| Big name / title | `--display` (Helvetica Neue) | Screen-sized | Weight 800, `letter-spacing: -0.075em`, `line-height: 1` |
| Canvas text | `"Courier Prime", "Courier New", monospace` | 11–12px | Same as UI |

- Courier Prime is everywhere, including canvas drawing and exports. When text is measured in canvas, measure again once the font has loaded (`document.fonts.load(...)`), or labels wrap wrongly.
- Bold (700) only for the term being defined, e.g. **Think along.** at the start of a list item.
- No other typefaces.

---

## 4. Colour

### Base
- Page: `#fff`. Text: `#000`. Muted: `#777`. Separators: `#ccc` or `#e4e4e4`.
- Danger (delete) is the only fixed colour: `#d00`, used in menus only.

### The accent (random per load)
Any mix of `0` and `f` that isn't black or white: `#f00 #0f0 #00f #ff0 #0ff #f0f`.
It's picked before the page draws, so there's never a flash of a different colour:

```html
<script>
  (function () {
    const picks = ["#f00", "#0f0", "#00f", "#ff0", "#0ff", "#f0f"];
    const accent = picks[Math.floor(Math.random() * picks.length)];
    const paint = "#" + [...accent.slice(1)].map(c => (c === "f" ? "0" : "f")).join("");
    const ink = (accent === "#00f" || accent === "#f00") ? "#fff" : "#000";
    const root = document.documentElement.style;
    root.setProperty("--accent", accent);
    root.setProperty("--accent-paint", paint);
    root.setProperty("--accent-ink", ink);
    window.TB_ACCENT = accent;   // for canvas drawing
  })();
</script>
```

**Use the accent for:** button hover/press, the selected item (hard shadow), input focus (hard shadow), suggestions (`--accent-soft` background), the big title on white.
**Don't use it for:** body text, large areas, anything that has to stay readable in every colour (yellow on white is weak).

### Inverting titles
Big titles use `mix-blend-mode: difference` and are painted in the complement (`--accent-paint`). On white they show the accent, and over black they flip to its opposite. This is the signature effect on the website.

```css
.big-title { color: var(--accent-paint); mix-blend-mode: difference; }
```

### Data colours
Functional colour coding (like Interlinked's colours per sense) is allowed inside the content, never in the chrome. Keep it muted and consistent.

---

## 5. Components

### Label
The core building block. Used for headings, tags, the current tab, the project name and counters.

```css
.label {
  display: inline-block;
  background: var(--ink);
  color: #fff;
  text-transform: uppercase;
  padding: 2px 6px;
  font: 13px/17px var(--mono);
}
```

### Frame / card
White, **no border**, soft shadow. A label can sit flush in the top-left corner (the frame's title) and a counter flush in the top-right corner.

```css
.frame { background: #fff; box-shadow: var(--shadow); }
.frame__body { padding: 40px; }   /* 28px on phones */
```

- **Selected:** a hard shadow in the accent, `6px 6px 0 var(--accent)`, in place of the soft one.
- **Numbers / counters:** a small black label (white text, 11px) flush in the top-right corner.

### Buttons
- **Default:** transparent, `--muted`, uppercase mono. Hover: black and underlined. Press: accent background.
- **Toggled on** (e.g. Snap): black background, white text, like the current page in the site menu.
- **Primary:** black background, white text. Hover: accent background with `--accent-ink` text.
- No rounded corners, anywhere (`border-radius: 0`).

### Inputs
`1px solid var(--ink)`, no radius, mono 13px. Focus shows a hard accent shadow: `box-shadow: 4px 4px 0 var(--accent)`. Field labels use the label style.

### Toolbar
- White, fixed at the top, 44px, **soft shadow, no line**.
- Left to right: logo (28px, links to tastbaar.studio), project name as a black label (click to rename; hover turns it to the accent), then tools.
- File actions (Load / Save / Export) go top-right on desktop and into a bottom bar on phones (with an upward shadow).
- Separators: 1px × 20px, `#ccc`.

### Menus, popups, dialogs
Frames with `--shadow`. The overlay behind a dialog is a light veil, `rgba(255,255,255,0.6)`, not a dark one. Menu items are uppercase; hover underlines them.

### Tooltips
Black background, white mono 13px, no radius.

### Welcome / about screen
A large frame with a `TOOL` label top-left and `BY TASTBAAR` in muted text top-right. Under that, the tool name as a big inverting title, then one sentence on what it's for, then the steps.

---

## 6. The big name

Every tool carries its name big, cropped by the screen edge, like TASTBAAR on the site.

- **In tools:** stand it up along the right edge, reading bottom to top, light grey `#ececec`, *behind* the working area, a bit larger than the screen.
- **On the website (desktop):** horizontal and centred, inverting, on top of everything with `pointer-events: none`.

```css
#brand-title {
  position: fixed; top: 0; bottom: 0; right: -0.12em;
  z-index: 0;                         /* behind the canvas (z-index: 1) */
  display: flex; align-items: center; justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);          /* reads bottom to top */
  font: 800 calc(100svh / 5.6)/1 var(--display);
  letter-spacing: -0.075em;
  color: #ececec;
  pointer-events: none; user-select: none;
}
```

To size it, use a lower divisor for a bigger name and more cropping. For a short word (TASTBAAR) around 4.4; for a long one (INTERLINKED) around 5.6.

---

## 7. Canvas tools

- Clear the canvas to transparent so the page (and the big name) shows through.
- Dot grid: 24px spacing, black dots at `globalAlpha` 0.09, dot radius about 1px × zoom.
- Nodes/cards: white, no outline, soft shadow (`shadowBlur 12`, `shadowOffsetY 6`, `rgba(0,0,0,0.2)`); selected gets the hard accent shadow.
- Connections: thin, neutral grey. Use dashes for special cases (loops), not colour.
- Show a small version number and zoom level bottom-right in `#aaa`, 9–11px mono.

---

## 8. Exports (SVG / PNG)

- Same look as on screen: mono font, cards without outlines plus a soft shadow (SVG: `feDropShadow dx=0 dy=6 stdDeviation=6 opacity 0.2`), so cards still read on a white page.
- Transparent background.
- Numbered notes use the black label for the number.
- Footer, bottom-right: `tastbaar.studio` in `#aaa`, 11px mono.
- When the export wraps text into columns, estimate Courier Prime as 0.6em per character (7.2px at 12px).

---

## 9. Motion

- Little and slow. Frames may drift a few pixels (8–10s cycles); nothing bounces for attention.
- Feedback can be quick: a short nudge (0.6s) when something is called forward.
- Always honour `prefers-reduced-motion: reduce` by switching animations off.
- Interaction is the motion: things give way, spring back and leave traces (the touch fields on the site).

---

## 10. Phones

- Below 600px (tools) or 800px (site): toolbars stack into two rows, grids become one column, file actions move to a bottom bar.
- The big name stands up along the right edge. In tools it does that everywhere; on the site only on phones.
- Tap targets are at least 30px high; long-press replaces right-click.

---

## 11. Voice

- Short and plain. One idea per sentence.
- UI words are UPPERCASE nouns and verbs: `NEW`, `AUTO-LAYOUT`, `SAVE`.
- Body copy is sentence case and speaks to "you".
- Start from the feeling, not the technology ("Target a feeling", then the sensors).
- Sign-off: *Ideas are nice. Tangible is better.*

---

## 12. Checklist for a new tool

- [ ] Tokens block and Courier Prime import at the top of the CSS
- [ ] Accent script in `<head>`, before the stylesheet is applied
- [ ] Toolbar: logo, project name label, uppercase buttons, soft shadow
- [ ] Panels and cards: no outlines, `--shadow`, `border-radius: 0`
- [ ] Headings and counters as black labels
- [ ] Big tool name along the right edge, light grey, behind the content
- [ ] Canvas text and exports in Courier Prime, re-measured after the font loads
- [ ] Exports: transparent, soft-shadow cards, `tastbaar.studio` footer
- [ ] Reduced motion respected; phone layout checked at 390px wide
- [ ] Welcome screen: `TOOL` / `BY TASTBAAR` bar, inverting title, one-line purpose, steps

---

**Assets:** logo at `images/logo.svg` (navy strokes, `#1d2a44`). Use it at 28px in toolbars and 56px in about screens. Reference implementations: `TOOLS/INTERLINKED/TOOL` (tool) and `SITE/experiencedesign` (website).
