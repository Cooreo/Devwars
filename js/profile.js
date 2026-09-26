// ---------------------------------------------------------------------------
// DevWars: Market & Military - operator auth + settings
// Username + password, once per device. PBKDF2-SHA256 via Web Crypto.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import {
  state, emit, persist, hydrate, mergeProfile,
  getSessionRecord, saveSessionRecord, clearSession, resetProfile,
} from "./state.js";
import { pbkdf2Hash, timingSafeEqual, $, downloadJSON, removeKey } from "./util.js";
import { toast, openDrawer, closeDrawer, confirmModal, icon } from "./ui.js";
import { go } from "./router.js";

let onEnterApp = null;
let onLogout = null;
let authMode = "register";

export function initProfile(callbacks) {
  onEnterApp = callbacks && callbacks.onEnter;
  onLogout = callbacks && callbacks.onLogout;
  wireAuthScreen();
}

// ---------------------------------------------------------------------------
// AUTH SCREEN
// ---------------------------------------------------------------------------
function wireAuthScreen() {
  const screen = $("#auth-screen");
  if (!screen) return;

  const tabReg = $("#tab-register");
  const tabLogin = $("#tab-login");
  const form = $("#auth-form");
  const pass2Wrap = $("#auth-pass2-wrap");
  const submit = $("#auth-submit");

  function setMode(mode) {
    authMode = mode;
    tabReg.classList.toggle("active", mode === "register");
    tabLogin.classList.toggle("active", mode === "login");
    tabReg.setAttribute("aria-selected", String(mode === "register"));
    tabLogin.setAttribute("aria-selected", String(mode === "login"));
    pass2Wrap.hidden = mode !== "register";
    submit.textContent = mode === "register" ? "[ REGISTER ]" : "[ LOGIN ]";
    setAuthError("");
  }

  function setAuthError(msg) {
    const box = $("#auth-error");
    box.textContent = msg;
    box.hidden = !msg;
  }

  tabReg.addEventListener("click", () => setMode("register"));
  tabLogin.addEventListener("click", () => setMode("login"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const opId = ($("#auth-op").value || "").trim().toLowerCase();
    const pass = $("#auth-pass").value || "";
    const pass2 = $("#auth-pass2").value || "";
    setAuthError("");

    if (!CONFIG.OPERATOR_RE.test(opId)) {
      setAuthError("[ERR] Operator ID must be 3-16 chars: lowercase a-z, 0-9, underscore.");
      return;
    }
    if (pass.length < CONFIG.MIN_PASSWORD_LEN) {
      setAuthError("[ERR] Password must be at least 6 characters.");
      return;
    }

    submit.disabled = true;
    try {
      if (authMode === "register") {
        if (pass !== pass2) {
          setAuthError("[ERR] Passwords do not match.");
          return;
        }
        const existing = getSessionRecord();
        if (existing && existing.operatorId) {
          setAuthError('[ERR] Operator "' + existing.operatorId + '" already registered on this device.');
          return;
        }
        const salt = crypto.randomUUID();
        const hash = await pbkdf2Hash(pass, salt);
        saveSessionRecord({ operatorId: opId, salt, hash, createdAt: Date.now(), loggedInAt: Date.now() });
        if (!state.profile) {
          state.profile = mergeProfile(null);
          state.armyCycles = { lastCollectedAt: Date.now() };
        }
        persist();
        toast("ok", "Operator " + opId + " registered. Welcome to DevWars.");
        enterApp();
      } else {
        const rec = getSessionRecord();
        if (!rec || !rec.operatorId) {
          setAuthError("[ERR] No operator registered on this device. Register first.");
          return;
        }
        if (rec.operatorId !== opId) {
          setAuthError("[ERR] Unknown operator ID for this device.");
          return;
        }
        const hash = await pbkdf2Hash(pass, rec.salt);
        if (!timingSafeEqual(hash, rec.hash)) {
          setAuthError("[ERR] Wrong password.");
          return;
        }
        saveSessionRecord(Object.assign({}, rec, { loggedInAt: Date.now() }));
        hydrate();
        toast("ok", "Welcome back, " + opId + ".");
        enterApp();
      }
    } catch (err) {
      setAuthError("[ERR] " + (err && err.message ? err.message : "Operation failed."));
    } finally {
      submit.disabled = false;
    }
  });

  setMode(getSessionRecord() ? "login" : "register");
}

function enterApp() {
  if (typeof onEnterApp === "function") onEnterApp();
}

export function showAuthScreen() {
  const a = $("#auth-screen");
  const s = $("#shell");
  if (a) a.classList.remove("hidden");
  if (s) s.classList.add("hidden");
}

export function hideAuthScreen() {
  const a = $("#auth-screen");
  const s = $("#shell");
  if (a) a.classList.add("hidden");
  if (s) s.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// SETTINGS DRAWER
// ---------------------------------------------------------------------------
export function openSettings() {
  if (!state.session) return;

  const body = document.createElement("div");
  body.className = "settings-list";
  body.innerHTML =
    '<div class="settings-op">' +
    '<div class="settings-row-static"><span class="k">OPERATOR</span><span class="v op-id">' + state.session.operatorId + "</span></div>" +
    '<div class="settings-row-static"><span class="k">CLEARANCE</span><span class="v">' + (state.session.isAdmin ? "ADMIN" : "OPERATOR") + "</span></div>" +
    '<div class="settings-row-static"><span class="k">COINS</span><span class="v">' + Math.floor(state.profile ? state.profile.devCoins : 0).toLocaleString("en-US") + "</span></div>" +
    "</div>";

  // scanlines toggle
  const scan = document.createElement("label");
  scan.className = "settings-toggle";
  const scanBox = document.createElement("input");
  scanBox.type = "checkbox";
  scanBox.id = "toggle-scanlines";
  scanBox.checked = !!(state.profile && state.profile.settings && state.profile.settings.scanlines);
  const scanText = document.createElement("span");
  scanText.textContent = "SCANLINE OVERLAY";
  scan.appendChild(scanBox);
  scan.appendChild(scanText);
  body.appendChild(scan);

  scanBox.addEventListener("change", () => {
    if (!state.profile) return;
    state.profile.settings.scanlines = scanBox.checked;
    document.body.classList.toggle("no-scanlines", !scanBox.checked);
    persist();
    toast("ok", "Scanlines " + (scanBox.checked ? "enabled" : "disabled") + ".");
  });

  function btnRow(label, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn " + cls;
    b.textContent = label;
    body.appendChild(b);
    return b;
  }

  const bExport = btnRow("[EXPORT PROFILE]", "btn-ghost");
  const bImport = btnRow("[IMPORT PROFILE]", "btn-ghost");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.className = "visually-hidden";
  body.appendChild(fileInput);

  const bReset = btnRow("[RESET PROFILE]", "btn-danger");

  if (state.session.isAdmin) {
    const bAdmin = btnRow("[ADMIN]", "btn-primary");
    bAdmin.addEventListener("click", () => {
      closeDrawer();
      go("admin");
    });
  }

  const bLogout = btnRow("[LOGOUT]", "btn-danger");

  bExport.addEventListener("click", () => {
    downloadJSON("devwars-profile.json", { app: "devwars", v: 1, exportedAt: Date.now(), profile: state.profile });
    toast("ok", "Profile exported as JSON.");
  });

  bImport.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const prof = parsed && parsed.profile ? parsed.profile : parsed;
        if (!prof || typeof prof.devCoins !== "number") throw new Error("Invalid profile file");
        state.profile = mergeProfile(prof);
        persist();
        emit();
        toast("ok", "Profile imported.");
        closeDrawer();
      } catch (err) {
        toast("err", "Import failed: not a valid DevWars profile.");
      }
    };
    reader.readAsText(f);
  });

  bReset.addEventListener("click", () => {
    confirmModal("[!] This cannot be undone. Reset your entire profile?", (yes) => {
      if (!yes) return;
      resetProfile();
      emit();
      toast("warn", "Profile reset. Fresh start, operator.");
      closeDrawer();
    });
  });

  bLogout.addEventListener("click", () => {
    confirmModal("[!] This cannot be undone. Log out and wipe this device session?", (yes) => {
      if (!yes) return;
      logout();
    });
  });

  openDrawer({ title: icon("gear", 16) + " SETTINGS", body });
}

export function logout() {
  clearSession();
  removeKey(CONFIG.STORAGE_KEY);
  state.profile = null;
  state.session = null;
  closeDrawer();
  if (typeof onLogout === "function") onLogout();
  else showAuthScreen();
}

export default { initProfile, openSettings, logout, showAuthScreen, hideAuthScreen };
