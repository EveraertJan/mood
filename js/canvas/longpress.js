/*
 * TASTBAAR moodboard — long-press opens the context menu on touch screens.
 *
 * iOS has no contextmenu event, so a press held for 550ms without moving
 * sends one. interact.js starts it on a touch pointerdown and cancels it on
 * move and up.
 */

const HOLD_MS = 550;

let press = null;

/** onFire() runs first and may return false to call the menu off. */
export function startLongPress(e, onFire) {
  clearTimeout(press?.timer);
  const { clientX: x, clientY: y, target } = e;
  press = {
    x, y,
    timer: setTimeout(() => {
      press = null;
      if (onFire() === false) return;
      target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    }, HOLD_MS)
  };
}

/** A move past the threshold, or letting go, cancels the press. */
export function cancelLongPress(e, threshold) {
  if (!press) return;
  if (e.type === "pointermove" && Math.hypot(e.clientX - press.x, e.clientY - press.y) < threshold) return;
  clearTimeout(press.timer);
  press = null;
}
