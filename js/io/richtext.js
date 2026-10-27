/*
 * TASTBAAR moodboard — rich text parsing for the canvas renderer.
 *
 * Turns the note card's HTML into a flat list of blocks with styled runs, so
 * the PNG and PDF exports can lay the same text out without a DOM.
 */

/**
 * Parse note HTML into blocks.
 *
 * @returns {Array<{type:string, runs:Array, indent:number, list:string|null, space:number}>}
 *   type is "text" or "rule"; list is "ul", "ol" or null; space is the gap
 *   above the block in px (10 between paragraphs, 8 between list items, as on screen)
 */
export function parseRichText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const blocks = [];
  let current = null;

  let lg = false; // inside a .lg paragraph (18/24, like .ritual__text)
  const open = (list, indent) => {
    current = { type: "text", runs: [], indent, list, space: 0, lg };
    blocks.push(current);
    return current;
  };
  const close = () => { current = null; };

  const inline = (node, style, list, indent) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, " ");
      if (!text.trim() && !current) return;
      (current || open(list, indent)).runs.push({ text, ...style });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === "BR") {
      // a line break: the rest goes on a new line of the same block kind
      const prev = current || open(list, indent);
      open(prev.list, prev.indent).space = 0;
      current.continued = true;
      return;
    }
    if (tag === "P" || tag === "DIV") return block(node, list, indent);
    if (tag === "UL" || tag === "OL") return listBlock(node, indent);
    const next = {
      ...style,
      b: style.b || tag === "B" || tag === "STRONG",
      i: style.i || tag === "I" || tag === "EM",
      u: style.u || tag === "U",
      href: tag === "A" ? node.getAttribute("href") : style.href
    };
    for (const child of node.childNodes) inline(child, next, list, indent);
  };

  const block = (node, list, indent) => {
    close();
    if (node.classList?.contains("rule")) blocks.push({ type: "rule", runs: [], indent, list: null, space: 0 });
    const outer = lg;
    lg = lg || !!node.classList?.contains("lg");
    for (const child of node.childNodes) inline(child, {}, list, indent);
    close();
    lg = outer;
  };

  const listBlock = (node, indent) => {
    close();
    const type = node.tagName === "UL" ? "ul" : "ol";
    for (const li of node.children) {
      if (li.tagName !== "LI") continue;
      close();
      open(type, indent + 1);
      for (const child of li.childNodes) inline(child, {}, type, indent + 1);
      close();
    }
  };

  for (const node of [...doc.body.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE && /^(P|DIV)$/.test(node.tagName)) block(node, null, 0);
    else if (node.nodeType === Node.ELEMENT_NODE && /^(UL|OL)$/.test(node.tagName)) listBlock(node, 0);
    else inline(node, {}, null, 0);
  }

  // drop empty blocks, trim the runs, set the gaps between blocks
  const out = blocks.filter(b => b.type === "rule" || b.runs.some(r => r.text.trim()) || b.continued);
  out.forEach((b, i) => {
    if (b.runs.length) {
      b.runs[0].text = b.runs[0].text.replace(/^\s+/, "");
      b.runs[b.runs.length - 1].text = b.runs[b.runs.length - 1].text.replace(/\s+$/, "");
    }
    if (i === 0 || b.continued) return;
    if (out[i - 1].type === "rule") return; // the rule already carries its 14px
    b.space = b.list && out[i - 1].list ? 8 : 10;
  });
  return out;
}

/**
 * Wrap a styled run list into lines that fit a maximum width.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} runs
 * @param {number} maxWidth
 * @returns {Array<Array<{text:string, style:object, width:number}>>}
 */
export function wrapRuns(ctx, runs, maxWidth, size = 14) {
  const lines = [];
  let line = [];
  let lineWidth = 0;

  const flush = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const run of runs) {
    ctx.font = fontFor(run, size);
    const words = run.text.split(/(\s+)/);
    for (const word of words) {
      if (word === "") continue;
      const width = ctx.measureText(word).width;
      if (/^\s+$/.test(word)) {
        if (line.length) {
          line.push({ text: word, style: run, width });
          lineWidth += width;
        }
        continue;
      }
      if (lineWidth + width > maxWidth && line.length) {
        flush();
      }
      line.push({ text: word, style: run, width });
      lineWidth += width;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** The canvas font string for a run. */
export function fontFor(run, size = 14) {
  const weight = run.b ? 700 : 400;
  const style = run.i ? "italic " : "";
  return `${style}${weight} ${size}px "Courier Prime", "Courier New", Courier, monospace`;
}
