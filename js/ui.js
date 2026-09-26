// ---------------------------------------------------------------------------
// DevWars: Market & Military - UI primitives
// Inline SVG stroke icons (no emoji anywhere), toasts, modals, drawer.
// ---------------------------------------------------------------------------

import { esc } from "./util.js";

// -- icon system ---------------------------------------------------------------
// Every icon is stroke-only, 24x24 viewBox, colored via currentColor.
const ICON_PATHS = {
  terminal:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/>',
  chart:
    '<path d="M3 20h18"/><path d="M5 16l4-5 3 3 6-8"/>',
  shield:
    '<path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/>',
  sword:
    '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  box:
    '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  gear:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  coin:
    '<circle cx="12" cy="12" r="8"/><path d="M12 7v10"/><path d="M14.6 9.2c-.6-1.3-5.2-1.6-5.2.7 0 2.4 5.2 1 5.2 3.4 0 2.3-4.6 2-5.2.7"/>',
  lock:
    '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  power:
    '<path d="M12 2v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  cpu:
    '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="10" y="10" width="4" height="4"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  bot:
    '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/>',
  user:
    '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  server:
    '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
  zap:
    '<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  eye:
    '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  flask:
    '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  trophy:
    '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>',
  key:
    '<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10.5 12.5L21 2"/><path d="M15.5 7.5l3 3"/>',
  download:
    '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload:
    '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  plus:
    '<path d="M12 5v14M5 12h14"/>',
  minus:
    '<path d="M5 12h14"/>',
  close:
    '<path d="M6 6l12 12M18 6L6 18"/>',
  check:
    '<path d="M4 12l5 5L20 7"/>',
  warn:
    '<path d="M12 3L22 20H2z"/><path d="M12 9v4"/><path d="M12 16.5v.01"/>',
  db:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  card:
    '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  crown:
    '<path d="M3 17l1.5-9L9 12l3-7 3 7 4.5-4L21 17z"/><path d="M4 20h16"/>',
  arrowUp:
    '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
  arrowDown:
    '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
  arrowFlat:
    '<path d="M4 12h16"/><path d="M15 8l4 4-4 4"/>',
  crosshair:
    '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
};

export function icon(name, size) {
  const s = size || 18;
  const inner = ICON_PATHS[name] || ICON_PATHS.box;
  return (
    '<svg class="icon icon-' + esc(name) + '" viewBox="0 0 24 24" width="' + s + '" height="' + s +
    '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    inner + "</svg>"
  );
}

// -- toasts ---------------------------------------------------------------------
const TOAST_PREFIX = { ok: "[OK]", err: "[ERR]", warn: "[!]", info: "[i]" };

export function toast(kind, msg) {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast toast-" + kind;
  el.setAttribute("role", "status");
  const prefix = document.createElement("span");
  prefix.className = "toast-prefix";
  prefix.textContent = TOAST_PREFIX[kind] || "[i]";
  const body = document.createElement("span");
  body.className = "toast-body";
  body.textContent = msg;
  el.appendChild(prefix);
  el.appendChild(body);
  host.appendChild(el);
  while (host.children.length > 4) host.removeChild(host.firstChild);
  setTimeout(() => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 250);
  }, 3800);
}

// -- modal --------------------------------------------------------------------------
let modalEl = null;
let modalOnClose = null;

export function openModal(options) {
  const o = options || {};
  closeModal();
  const root = document.getElementById("modal-root");
  if (!root) return null;

  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  const box = document.createElement("div");
  box.className = "modal";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");

  const head = document.createElement("div");
  head.className = "modal-head";
  const title = document.createElement("span");
  title.className = "modal-title";
  title.textContent = o.title || "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost btn-icon";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "[X]";
  closeBtn.addEventListener("click", () => closeModal());
  head.appendChild(title);
  head.appendChild(closeBtn);

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "modal-body";
  if (typeof o.body === "string") bodyWrap.innerHTML = o.body;
  else if (o.body) bodyWrap.appendChild(o.body);

  box.appendChild(head);
  box.appendChild(bodyWrap);
  if (o.footer) {
    const foot = document.createElement("div");
    foot.className = "modal-foot";
    foot.appendChild(o.footer);
    box.appendChild(foot);
  }
  wrap.appendChild(box);
  wrap.addEventListener("mousedown", (e) => {
    if (e.target === wrap) closeModal();
  });
  root.appendChild(wrap);
  modalEl = wrap;
  modalOnClose = o.onClose || null;
  return bodyWrap;
}

export function closeModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  if (modalOnClose) {
    const cb = modalOnClose;
    modalOnClose = null;
    cb();
  }
}

export function confirmModal(message, onResult) {
  const foot = document.createElement("div");
  foot.className = "row gap";
  const ok = document.createElement("button");
  ok.className = "btn btn-danger";
  ok.type = "button";
  ok.textContent = "[CONFIRM]";
  const cancel = document.createElement("button");
  cancel.className = "btn btn-ghost";
  cancel.type = "button";
  cancel.textContent = "[CANCEL]";
  foot.appendChild(ok);
  foot.appendChild(cancel);

  const body = document.createElement("div");
  body.className = "confirm-msg";
  body.textContent = message;

  openModal({ title: "[!] CONFIRM", body, footer: foot });
  ok.addEventListener("click", () => {
    closeModal();
    if (onResult) onResult(true);
  });
  cancel.addEventListener("click", () => {
    closeModal();
    if (onResult) onResult(false);
  });
}

// ESC closes modal / drawer ---------------------------------------------------------
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modalEl) closeModal();
    else closeDrawer();
  }
});

// -- drawer ------------------------------------------------------------------------------
let drawerEl = null;

export function openDrawer(options) {
  const o = options || {};
  closeDrawer();
  const root = document.getElementById("drawer-root");
  if (!root) return null;

  const wrap = document.createElement("div");
  wrap.className = "drawer-backdrop";
  const panel = document.createElement("div");
  panel.className = "drawer";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const head = document.createElement("div");
  head.className = "drawer-head";
  const title = document.createElement("span");
  title.className = "drawer-title";
  title.textContent = o.title || "";
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-ghost btn-icon";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "[X]";
  closeBtn.addEventListener("click", () => closeDrawer());
  head.appendChild(title);
  head.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "drawer-body";
  if (typeof o.body === "string") body.innerHTML = o.body;
  else if (o.body) body.appendChild(o.body);

  panel.appendChild(head);
  panel.appendChild(body);
  wrap.appendChild(panel);
  wrap.addEventListener("mousedown", (e) => {
    if (e.target === wrap) closeDrawer();
  });
  root.appendChild(wrap);
  drawerEl = wrap;
  return body;
}

export function closeDrawer() {
  if (drawerEl) {
    drawerEl.remove();
    drawerEl = null;
  }
}

export default { icon, toast, openModal, closeModal, confirmModal, openDrawer, closeDrawer };
