/*
 * TASTBAAR moodboard — IMAGE card.
 *
 * Full-bleed image with the label tab overlapping the top edge, plus an
 * optional caption below the image. Images live in doc.assets and are
 * referenced by id.
 */

import { buildBar, updateBar, makeEditable, patchData, dataOf } from "./common.js";
import { getDoc } from "../state/store.js";

export const image = {
  type: "image",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--image";
    el.dataset.type = "image";
    el.appendChild(buildBar(card));

    const img = document.createElement("img");
    img.className = "card__img";
    img.alt = card.label || "";
    img.draggable = false;
    el.appendChild(img);

    const body = document.createElement("div");
    body.className = "card__body card__body--edit";
    body.textContent = card.data.caption || "";
    el.appendChild(body);

    el.__img = img;
    el.__body = body;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const asset = getDoc().assets[card.data.assetId];
    const img = el.__img;
    if (img) {
      const src = asset ? asset.dataUrl : "";
      if (img.getAttribute("src") !== src) img.setAttribute("src", src);
      img.classList.toggle("is-contain", card.data.fit === "contain");
      img.alt = card.label || "Image";
    }
    const body = el.__body;
    if (body && document.activeElement !== body) {
      const want = card.data.caption || "";
      if (body.textContent !== want) body.textContent = want;
    }
  },

  mount(el, card) {
    const body = el.__body;
    if (!body || body.__mounted) return;
    body.__mounted = true;
    makeEditable(body, (html) => {
      const text = html.replace(/<[^>]*>/g, "").trim();
      patchData(card.id, { caption: text });
    }, { plain: true, placeholder: "Caption" });
  }
};
