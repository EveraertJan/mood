/*
 * TASTBAAR moodboard — toasts and dialogs.
 *
 * Toasts are a small black label tab sliding in bottom-centre, uppercase,
 * gone after 2.5s. Dialogs are Tastbaar windows centred on screen with a
 * translucent white backdrop.
 */

const TOAST_MS = 2500;

let backdrop = null;
let toastContainer = null;

export function initDialogs(dom) {
  backdrop = dom.backdrop;
  toastContainer = dom.toastContainer;
}

/** Show a short uppercase message. */
export function toast(message, ms = TOAST_MS) {
  if (!toastContainer) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = String(message).toUpperCase();
  el.setAttribute("role", "status");
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-in"));
  setTimeout(() => {
    el.classList.remove("is-in");
    setTimeout(() => el.remove(), 250);
  }, ms);
}

/**
 * Open a Tastbaar dialog window.
 *
 * @param {object} opts
 *   title    - the black label tab text
 *   meta     - optional muted text top-right (BY TASTBAAR)
 *   body     - an HTMLElement or an HTML string
 *   actions  - [{label, value, primary}] buttons; value may be a function
 *              that receives the dialog card
 *   width    - optional css width
 * @returns {Promise<any>} the value of the chosen action (null when closed)
 */
export function dialog({ title = "", meta = "", body = "", actions = [], width = "" }) {
  return new Promise((resolve) => {
    if (!backdrop) return resolve(null);
    backdrop.replaceChildren();
    backdrop.hidden = false;

    const card = document.createElement("article");
    card.className = "card dialog";
    if (width) card.style.width = width;

    const bar = document.createElement("header");
    bar.className = "card__bar";
    const label = document.createElement("span");
    label.className = "card__label";
    label.textContent = title;
    bar.appendChild(label);
    if (meta) {
      const m = document.createElement("span");
      m.className = "dialog__meta";
      m.textContent = meta;
      bar.appendChild(m);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "dialog__close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = `<svg class="icon"><use href="assets/icons.svg#i-close"/></svg>`;
    close.addEventListener("click", () => finish(null));
    bar.appendChild(close);

    const bodyEl = document.createElement("div");
    bodyEl.className = "card__body";
    if (body instanceof HTMLElement) {
      bodyEl.appendChild(body);
    } else {
      bodyEl.innerHTML = body;
    }

    card.append(bar, bodyEl);

    if (actions.length) {
      const row = document.createElement("div");
      row.className = "dialog__actions";
      for (const action of actions) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn" + (action.primary ? " is-primary" : "");
        btn.textContent = action.label;
        btn.addEventListener("click", () => {
          const value = typeof action.value === "function" ? action.value(card) : action.value;
          finish(value);
        });
        row.appendChild(btn);
      }
      card.appendChild(row);
    }

    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", title);
    const opener = document.activeElement;
    backdrop.appendChild(card);

    backdrop.addEventListener("pointerdown", onBackdropDown);
    document.addEventListener("keydown", onKeyDown, true);

    // focus the first field, else the primary button
    const first = card.querySelector("input, select, textarea") || card.querySelector(".is-primary") || close;
    first.focus();
    if (first.select) first.select();

    function onBackdropDown(e) {
      if (e.target === backdrop) finish(null);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        finish(null);
      } else if (e.key === "Enter" && e.target.matches?.("input[type='text']")) {
        e.preventDefault();
        card.querySelector(".is-primary")?.click();
      }
    }
    function finish(value) {
      backdrop.removeEventListener("pointerdown", onBackdropDown);
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.replaceChildren();
      backdrop.hidden = true;
      opener?.focus?.();
      resolve(value);
    }
  });
}

/** A yes/no dialog. Resolves true when the primary action is chosen. */
export function confirmDialog(title, message, okLabel = "OK", cancelLabel = "CANCEL") {
  return dialog({
    title,
    body: `<p>${escapeHTML(message)}</p>`,
    actions: [
      { label: cancelLabel, value: false },
      { label: okLabel, value: true, primary: true }
    ]
  }).then(v => v === true);
}

/** A prompt dialog that asks for a single line of text. */
export function promptDialog(title, message, value = "") {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p>${escapeHTML(message)}</p>`;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "dialog__input";
  input.value = value;
  input.setAttribute("aria-label", message);
  wrap.appendChild(input);
  return dialog({
    title,
    body: wrap,
    actions: [
      { label: "Cancel", value: null },
      { label: "OK", value: (card) => card.querySelector(".dialog__input")?.value ?? null, primary: true }
    ]
  });
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
