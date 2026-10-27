/*
 * TASTBAAR moodboard — LINK card.
 *
 * The meta tab shows the domain in uppercase, the title and description are
 * editable, and the card ends with an uppercase "OPEN →" link aligned right.
 * No preview fetching.
 */

import { buildBar, updateBar, makeEditable, domainOf, patchData, dataOf } from "./common.js";

export const link = {
  type: "link",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--link";
    el.dataset.type = "link";
    el.appendChild(buildBar(card));

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("p");
    title.className = "link__title card__body--edit";
    title.textContent = card.data.title || "";

    const desc = document.createElement("p");
    desc.className = "card__body--edit";
    desc.textContent = card.data.description || "";

    const more = document.createElement("a");
    more.className = "more";
    more.textContent = "Open →";
    more.href = card.data.url || "#";
    more.target = "_blank";
    more.rel = "noopener noreferrer";

    body.append(title, desc, more);
    el.appendChild(body);

    el.__title = title;
    el.__desc = desc;
    el.__more = more;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const meta = el.querySelector(".card__meta");
    if (meta && !meta.isContentEditable) {
      const domain = domainOf(card.data.url);
      const text = domain || card.meta || "";
      if (meta.textContent !== text) meta.textContent = text;
    }
    const title = el.__title;
    if (title && document.activeElement !== title && title.textContent !== (card.data.title || "")) {
      title.textContent = card.data.title || "";
    }
    const desc = el.__desc;
    if (desc && document.activeElement !== desc && desc.textContent !== (card.data.description || "")) {
      desc.textContent = card.data.description || "";
    }
    const more = el.__more;
    if (more) {
      more.href = card.data.url || "#";
      more.setAttribute("aria-label", card.data.title ? `Open ${card.data.title}` : "Open link");
    }
  },

  mount(el, card) {
    bind(el.__title, card, "title", "Title");
    bind(el.__desc, card, "description", "Description");

    function bind(node, c, key, placeholder) {
      if (!node || node.__mounted) return;
      node.__mounted = true;
      makeEditable(node, (html) => {
        const text = html.replace(/<[^>]*>/g, "");
        patchData(c.id, { [key]: text });
      }, { plain: true, placeholder });
    }
  }
};
