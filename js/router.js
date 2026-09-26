// ---------------------------------------------------------------------------
// DevWars: Market & Military - tiny screen router
// Screens register a render function; go() swaps screens with a 180ms
// opacity/translateX transition; refresh() re-renders without animation.
// ---------------------------------------------------------------------------

import { state } from "./state.js";
import { $$ } from "./util.js";

const screens = new Map();
let rootEl = null;

export function initRouter(el) {
  rootEl = el;
}

export function registerScreen(name, renderFn) {
  screens.set(name, renderFn);
}

function updateNav() {
  for (const btn of $$("[data-nav]")) {
    const active = btn.dataset.nav === state.screen;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-current", active ? "page" : "false");
  }
}

export function go(name) {
  if (!screens.has(name)) return;
  state.screen = name;
  render(true); // render once; subscribers re-render on real state changes
}

export function render(animate) {
  if (!rootEl) return;
  const fn = screens.get(state.screen);
  if (!fn) return;

  const scrollParent = rootEl;
  const keepScroll = scrollParent.scrollTop;

  rootEl.innerHTML = "";
  const node = fn();
  if (typeof node === "string") rootEl.innerHTML = node;
  else if (node) rootEl.appendChild(node);

  if (animate) {
    rootEl.classList.remove("screen-enter");
    void rootEl.offsetWidth; // restart animation
    rootEl.classList.add("screen-enter");
  }
  scrollParent.scrollTop = keepScroll;
  updateNav();
}

export function refresh() {
  render(false);
}

export default { initRouter, registerScreen, go, render, refresh };
