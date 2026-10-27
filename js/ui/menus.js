/*
 * TASTBAAR moodboard — pop-up menus.
 *
 * Any button with data-menu="<id>" opens the .popmenu with that id: the View
 * and File menus under the toolbar, the add-card menu above the + button
 * (data-place="above"). A menu closes when you pick an item, tap elsewhere,
 * press Esc or resize the window. Only one is open at a time.
 */

let open = null;

function close() {
  if (!open) return;
  open.menu.hidden = true;
  open.trigger.setAttribute("aria-expanded", "false");
  open = null;
}

function show(trigger) {
  const menu = document.getElementById(trigger.dataset.menu);
  if (!menu) return;
  close();
  menu.hidden = false;
  const r = trigger.getBoundingClientRect();
  const right = Math.max(8, window.innerWidth - r.right);
  menu.style.left = "auto";
  menu.style.right = `${right}px`;
  if (trigger.dataset.place === "above") {
    menu.style.top = "auto";
    menu.style.bottom = `${window.innerHeight - r.top + 10}px`;
  } else {
    menu.style.bottom = "auto";
    menu.style.top = `${r.bottom + 6}px`;
  }
  trigger.setAttribute("aria-expanded", "true");
  open = { trigger, menu };
}

export function closeMenus() { close(); }

export function initMenus() {
  document.querySelectorAll("[data-menu]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (open?.trigger === trigger) close();
      else show(trigger);
    });
  });
  document.querySelectorAll(".popmenu").forEach((menu) => {
    menu.addEventListener("click", (e) => { if (e.target.closest(".menu__item")) close(); });
  });
  document.addEventListener("pointerdown", (e) => {
    if (!open || open.menu.contains(e.target) || open.trigger.contains(e.target)) return;
    close();
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) { const t = open.trigger; close(); t.focus(); }
  });
  window.addEventListener("resize", close);
}
