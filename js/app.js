// ---------------------------------------------------------------------------
// DevWars: Market & Military - application bootstrap
// Layout switching, boot sequence, timers, keyboard shortcuts, SW register.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import {
  state, subscribe, emit, hydrate, persist, crossTabSync,
  syncSessionFromStorage,
} from "./state.js";
import { $ } from "./util.js";
import { icon, toast } from "./ui.js";
import { initRouter, registerScreen, go, refresh } from "./router.js";
import { initProfile, openSettings, showAuthScreen, hideAuthScreen } from "./profile.js";
import { renderMarket, startLoop, catchup, forceTick } from "./market.js";
import { renderArmy, collectArmyCycle, computePower } from "./army.js";
import { renderItems, updateEffectTimers, buildItems, pruneExpired } from "./items.js";
import { renderAdmin } from "./admin.js";

// ---------------------------------------------------------------------------
// RESPONSIVE LAYOUT MODE (phone / tablet / desktop)
// ---------------------------------------------------------------------------
function setLayoutMode() {
  const w = window.innerWidth;
  const mode = w <= 600 ? "phone" : (w <= 1024 ? "tablet" : "desktop");
  document.body.dataset.layout = mode;
  state.layout = mode;
}
window.addEventListener("resize", () => {
  const prev = state.layout;
  setLayoutMode();
  if (prev !== state.layout && state.session && state.screen !== "admin") refresh();
});
setLayoutMode();

// ---------------------------------------------------------------------------
// HEADER
// ---------------------------------------------------------------------------
function updateHeader() {
  const coins = $("#coin-amount");
  const nick = $("#nick-pill");
  if (coins && state.profile) coins.textContent = Math.floor(state.profile.devCoins).toLocaleString("en-US");
  if (nick && state.session) {
    nick.innerHTML = icon("user", 13) + " " + state.session.operatorId +
      (state.session.isAdmin ? ' <span class="admin-flag">[A]</span>' : "");
  }
  if (state.profile) {
    document.body.classList.toggle("no-scanlines", !(state.profile.settings && state.profile.settings.scanlines));
  }
}

// ---------------------------------------------------------------------------
// APP ENTER / AUTH GATE
// ---------------------------------------------------------------------------
function enterApp() {
  hideAuthScreen();
  if (!state.armyCycles.lastCollectedAt) {
    state.armyCycles.lastCollectedAt = Date.now();
    persist();
  }
  updateHeader();
  go(state.screen && state.screen !== "admin" ? state.screen : "market");
}

// ---------------------------------------------------------------------------
// BOOT
// ---------------------------------------------------------------------------
function boot() {
  hydrate();
  buildItems();
  catchup();
  if (state.profile && pruneExpired(state.profile)) persist();

  // screens -------------------------------------------------------------------
  initRouter($("#screen"));
  registerScreen("market", renderMarket);
  registerScreen("army", renderArmy);
  registerScreen("items", renderItems);
  registerScreen("admin", renderAdmin);

  // state changes re-render the active screen (admin re-renders explicitly) ---
  subscribe(() => {
    updateHeader();
    if (state.screen === "admin") return;
    refresh();
  });

  // header icons / buttons ------------------------------------------------------
  const gear = $("#btn-settings");
  gear.innerHTML = icon("gear", 20);
  gear.addEventListener("click", () => {
    if (!state.session) return;
    openSettings();
  });

  // bottom nav ---------------------------------------------------------------------
  const navLabels = { market: "MARKET", army: "ARMY", items: "ITEMS", pvp: "PVP" };
  const navIcons = { market: "chart", army: "shield", items: "box", pvp: "sword" };
  for (const btn of document.querySelectorAll("[data-nav]")) {
    const key = btn.dataset.nav;
    btn.innerHTML =
      '<span class="nav-ind"></span>' +
      '<span class="nav-icon">' + icon(navIcons[key], 20) + "</span>" +
      '<span class="nav-label">' + navLabels[key] + "</span>";
    btn.addEventListener("click", () => {
      if (!state.session) return;
      if (key === "pvp") {
        toast("info", "[LOCKED] PVP arena disabled in this build.");
        return;
      }
      go(key);
    });
  }

  // keyboard shortcuts: 1/2/3 switch tabs ------------------------------------------------
  window.addEventListener("keydown", (e) => {
    if (!state.session) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    if (e.key === "1") go("market");
    else if (e.key === "2") go("army");
    else if (e.key === "3") go("items");
  });

  // cross-tab sync -------------------------------------------------------------------------
  crossTabSync((key) => {
    if (key === CONFIG.SESSION_KEY) {
      const hadSession = !!state.session;
      syncSessionFromStorage();
      if (!state.session && hadSession) showAuthScreen();
      return;
    }
    hydrate();
    if (key === CONFIG.ITEMS_CUSTOM_KEY) buildItems();
    catchup();
    updateHeader();
    if (state.screen !== "admin") refresh();
  });

  // auth --------------------------------------------------------------------------------------
  initProfile({
    onEnter: enterApp,
    onLogout: () => {
      showAuthScreen();
    },
  });

  // loops -----------------------------------------------------------------------------------------
  startLoop();
  window.setInterval(collectArmyCycle, 5000);
  window.setInterval(updateEffectTimers, CONFIG.BOOST_TICK_MS);
  window.setInterval(() => {
    // periodic persist keeps other tabs fresh even without user actions
    if (state.profile) persist();
  }, 15000);

  // session gate --------------------------------------------------------------------------------------
  if (state.session) enterApp();
  else showAuthScreen();

  // global API (PvP-ready) ------------------------------------------------------------------------------
  window.DevWars = {
    version: CONFIG.VERSION,
    state,
    army: { computePower },
    market: { forceTick },
    emit,
  };
}

// ---------------------------------------------------------------------------
// SERVICE WORKER + LAUNCH
// ---------------------------------------------------------------------------
window.addEventListener("load", () => {
  boot();
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // offline caching unavailable (e.g. file:// or unsupported host) - game still works
    });
  }
});
