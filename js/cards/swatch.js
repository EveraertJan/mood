/*
 * TASTBAAR moodboard — SWATCH card.
 *
 * A block of colour filling the top of the card, the hex in uppercase mono
 * below it, and an editable name. Clicking the hex copies it.
 */

import { buildBar, updateBar, makeEditable, patchData, dataOf } from "./common.js";

export const swatch = {
  type: "swatch",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--swatch";
    el.dataset.type = "swatch";
    el.appendChild(buildBar(card));

    const chip = document.createElement("div");
    chip.className = "swatch__chip";

    const body = document.createElement("div");
    body.className = "card__body";

    const hex = document.createElement("p");
    hex.className = "swatch__hex";
    hex.textContent = (card.data.hex || "#000000").toUpperCase();
    hex.setAttribute("role", "button");
    hex.setAttribute("tabindex", "0");
    hex.title = "Copy hex";

    const name = document.createElement("p");
    name.className = "card__body--edit";
    name.textContent = card.data.name || "";

    body.append(hex, name);
    el.append(chip, body);

    el.__chip = chip;
    el.__hex = hex;
    el.__name = name;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const hexValue = (card.data.hex || "#000000").toUpperCase();
    if (el.__chip) el.__chip.style.setProperty("--chip", card.data.hex || "#000000");
    if (el.__hex && el.__hex.textContent !== hexValue) el.__hex.textContent = hexValue;
    if (el.__name && document.activeElement !== el.__name && el.__name.textContent !== (card.data.name || "")) {
      el.__name.textContent = card.data.name || "";
    }
  },

  mount(el, card) {
    const copy = () => {
      const value = (dataOf(card.id).hex || "#000000").toUpperCase();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(value).catch(() => {});
      }
      el.dispatchEvent(new CustomEvent("swatch:copy", { bubbles: true, detail: value }));
    };
    if (el.__hex && !el.__hex.__mounted) {
      el.__hex.__mounted = true;
      el.__hex.addEventListener("click", copy);
      el.__hex.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); copy(); }
      });
    }
    if (el.__name && !el.__name.__mounted) {
      el.__name.__mounted = true;
      makeEditable(el.__name, (html) => {
        patchData(card.id, { name: html.replace(/<[^>]*>/g, "") });
      }, { plain: true, placeholder: "Name" });
    }
  }
};
