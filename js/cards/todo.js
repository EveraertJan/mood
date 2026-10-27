/*
 * TASTBAAR moodboard — TO-DO card.
 *
 * Add, remove and reorder items. Checkboxes are square 14px ink boxes, filled
 * ink when done. Done items are struck through in --muted. The meta tab shows
 * a count like "3/7".
 */

import { buildBar, updateBar, patchData, dataOf } from "./common.js";
import { generateId } from "../state/schema.js";

export const todo = {
  type: "todo",

  create(card) {
    const el = document.createElement("article");
    el.className = "card card--todo";
    el.dataset.type = "todo";
    el.appendChild(buildBar(card));

    const body = document.createElement("div");
    body.className = "card__body";

    const list = document.createElement("ul");
    list.className = "todo";

    const add = document.createElement("button");
    add.className = "btn todo__add";
    add.type = "button";
    add.textContent = "+ Add item";
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      const added = { id: generateId(), text: "", done: false };
      patchData(card.id, { items: [...(dataOf(card.id).items || []), added] });
      list.querySelector(`li[data-id="${added.id}"] input[type="text"]`)?.focus();
    });

    body.append(list, add);
    el.appendChild(body);

    el.__list = list;
    return el;
  },

  update(el, card) {
    updateBar(el, card);
    const meta = el.querySelector(".card__meta");
    if (meta && !meta.isContentEditable) {
      const items = card.data.items || [];
      const done = items.filter(i => i.done).length;
      const text = items.length ? `${done}/${items.length}` : (card.meta || "");
      if (meta.textContent !== text) meta.textContent = text;
    }

    const list = el.__list;
    if (!list) return;
    const items = card.data.items || [];
    // Rebuild only when the item ids differ (keeps focus while typing)
    const currentIds = [...list.children].map(li => li.dataset.id).join(",");
    const wantedIds = items.map(i => i.id).join(",");
    if (currentIds !== wantedIds) {
      const focused = document.activeElement?.closest?.("li")?.dataset.id;
      list.replaceChildren(...items.map(item => buildItem(item, card)));
      if (focused) list.querySelector(`li[data-id="${focused}"] input[type="text"]`)?.focus();
    } else {
      // same items: bring text and ticks in line (after an undo, an import)
      items.forEach((item, i) => {
        const li = list.children[i];
        const check = li.querySelector('input[type="checkbox"]');
        const text = li.querySelector('input[type="text"]');
        if (check.checked !== !!item.done) check.checked = !!item.done;
        if (text !== document.activeElement && text.value !== (item.text || "")) text.value = item.text || "";
      });
    }
  },

  mount(el, card) {
    const list = el.__list;
    if (!list || list.__mounted) return;
    list.__mounted = true;

    list.addEventListener("change", (e) => {
      const input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      const id = input.closest("li").dataset.id;
      const items = (dataOf(card.id).items || []).map(i => i.id === id ? { ...i, done: input.checked } : i);
      patchData(card.id, { items });
    });

    list.addEventListener("input", (e) => {
      const input = e.target.closest('input[type="text"]');
      if (!input) return;
      const id = input.closest("li").dataset.id;
      const items = (dataOf(card.id).items || []).map(i => i.id === id ? { ...i, text: input.value } : i);
      patchData(card.id, { items });
    });

    list.addEventListener("click", (e) => {
      const del = e.target.closest(".todo__del");
      if (del) {
        e.stopPropagation();
        const id = del.closest("li").dataset.id;
        const items = (dataOf(card.id).items || []).filter(i => i.id !== id);
        patchData(card.id, { items });
        return;
      }
      const up = e.target.closest(".todo__up");
      const down = e.target.closest(".todo__down");
      if (up || down) {
        e.stopPropagation();
        const li = (up || down).closest("li");
        const id = li.dataset.id;
        const items = [...(dataOf(card.id).items || [])];
        const index = items.findIndex(i => i.id === id);
        const target = up ? index - 1 : index + 1;
        if (target < 0 || target >= items.length) return;
        const [moved] = items.splice(index, 1);
        items.splice(target, 0, moved);
        patchData(card.id, { items });
      }
    });

    list.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        const input = e.target.closest('input[type="text"]');
        if (!input) return;
        const id = input.closest("li").dataset.id;
        const index = (dataOf(card.id).items || []).findIndex(i => i.id === id);
        const items = [...(dataOf(card.id).items || [])];
        const added = { id: generateId(), text: "", done: false };
        items.splice(index + 1, 0, added);
        patchData(card.id, { items });
        list.querySelector(`li[data-id="${added.id}"] input[type="text"]`)?.focus();
      }
    });
  }
};

function buildItem(item, card) {
  const li = document.createElement("li");
  li.dataset.id = item.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = !!item.done;
  check.setAttribute("aria-label", item.done ? "Done" : "Not done");

  const text = document.createElement("input");
  text.type = "text";
  text.value = item.text || "";
  text.placeholder = "New item";
  text.setAttribute("aria-label", "Item text");

  const controls = document.createElement("span");
  controls.className = "todo__controls";
  controls.append(
    iconBtn("todo__up", "Move up", "M14 52 L14 20 L30 20"),
    iconBtn("todo__down", "Move down", "M14 20 L14 52 L30 52"),
    iconBtn("todo__del", "Remove item", "M16 16 L48 48 M48 16 L16 48")
  );

  li.append(check, text, controls);
  return li;
}

function iconBtn(cls, label, path) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `todo__btn ${cls}`;
  b.setAttribute("aria-label", label);
  b.title = label;
  b.innerHTML = `<svg viewBox="0 0 64 72" aria-hidden="true"><path d="${path}"/></svg>`;
  return b;
}
