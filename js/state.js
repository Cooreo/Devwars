// ---------------------------------------------------------------------------
// DevWars: Market & Military - central state store
//
// One state object + subscribe/emit pub-sub. All persistent player state is
// written to localStorage["devwars.v1"]. Cross-tab sync rides the "storage"
// event. Admin market/item edits live in their own custom slices.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { STOCKS } from "./stocks-data.js";
import { readJSON, writeJSON, removeKey } from "./util.js";

export const state = {
  layout: "phone",
  screen: "market",
  session: null, // { operatorId, passwordHash, salt, loggedInAt, isAdmin }
  profile: null,
  market: { stocks: {}, lastTickIndex: 0 },
  armyCycles: { lastCollectedAt: 0 },
  selectedStockId: null,
  selectedUnitId: "junior",
  selectedItemId: null,
  notifications: [],
};

// -- pub/sub ------------------------------------------------------------------
const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function emit() {
  for (const fn of Array.from(subscribers)) {
    try {
      fn(state);
    } catch (e) {
      // one bad subscriber must not kill the loop
      // eslint-disable-next-line no-console
      console.error("[devwars] subscriber error", e);
    }
  }
}

// -- defaults --------------------------------------------------------------------
export function defaultProfile() {
  return {
    devCoins: CONFIG.STARTING_COINS,
    totalEarned: 0,
    holdings: {},      // { stockId: qty }
    costBasis: {},     // { stockId: totalCoinsSpent } (for average cost / P&L)
    army: { juniors: 0, seniors: 0, devops: 0, bots: 0 },
    unlockedStocks: [],
    powerups: {},      // { serverRack: true, insiderBot: true }
    items: {},         // { itemId: qty }
    boosts: {},        // { boostId: { expiresAt } }
    reveals: {},       // { stockId: { ticks, expiresAt } }
    flags: {},         // one-shot flags: auditShield, nextSellBonus, nextRecruitHalfPrice
    settings: { scanlines: true },
    createdAt: Date.now(),
  };
}

export function mergeProfile(saved) {
  const base = defaultProfile();
  if (!saved || typeof saved !== "object") return base;
  const out = Object.assign(base, saved);
  out.holdings = Object.assign({}, saved.holdings || {});
  out.costBasis = Object.assign({}, saved.costBasis || {});
  out.army = Object.assign({ juniors: 0, seniors: 0, devops: 0, bots: 0 }, saved.army || {});
  out.unlockedStocks = Array.isArray(saved.unlockedStocks) ? saved.unlockedStocks.slice() : [];
  out.powerups = Object.assign({}, saved.powerups || {});
  out.items = Object.assign({}, saved.items || {});
  out.boosts = Object.assign({}, saved.boosts || {});
  out.reveals = Object.assign({}, saved.reveals || {});
  out.flags = Object.assign({}, saved.flags || {});
  out.settings = Object.assign({ scanlines: true }, saved.settings || {});
  return out;
}

// -- custom slices (admin) -----------------------------------------------------------
export function readCustomMarket() {
  return readJSON(CONFIG.MARKET_CUSTOM_KEY, { overrides: {}, added: {} });
}

export function writeCustomMarket(data) {
  writeJSON(CONFIG.MARKET_CUSTOM_KEY, data);
}

export function readCustomItems() {
  return readJSON(CONFIG.ITEMS_CUSTOM_KEY, { overrides: {}, added: {} });
}

export function writeCustomItems(data) {
  writeJSON(CONFIG.ITEMS_CUSTOM_KEY, data);
}

// -- market construction: base STOCKS + admin custom + saved dynamics -----------------
export function buildMarketStocks(savedMarket) {
  const custom = readCustomMarket();
  const stocks = {};

  // 1. base seed
  for (const s of STOCKS) {
    stocks[s.id] = Object.assign({}, s, { history: s.history.slice() });
  }

  // 2. admin-added stocks
  const added = (custom && custom.added) || {};
  for (const id of Object.keys(added)) {
    const a = added[id];
    if (!a || !a.symbol) continue;
    const basePrice = Math.max(1, Number(a.basePrice) || 1);
    stocks[id] = {
      id,
      symbol: String(a.symbol).toUpperCase().slice(0, 8),
      name: String(a.name || a.symbol).slice(0, 40),
      basePrice,
      currentPrice: Number(a.currentPrice) || basePrice,
      volatility: clampNum(a.volatility, 0.001, 0.2, 0.03),
      trendBias: clampNum(a.trendBias, -0.05, 0.05, 0),
      category: String(a.category || "exotic").toLowerCase(),
      unlockRequirement: a.unlockRequirement === null || a.unlockRequirement === undefined ? 0 : Number(a.unlockRequirement) || 0,
      history: Array.isArray(a.history) && a.history.length ? a.history.slice(-CONFIG.HISTORY_LEN) : [basePrice, basePrice, basePrice],
      isActive: a.isActive !== false,
      lastTick: Number(a.lastTick) || 0,
      custom: true,
    };
  }

  // 3. saved dynamics from devwars.v1
  const savedStocks = (savedMarket && savedMarket.stocks) || {};
  for (const id of Object.keys(savedStocks)) {
    const sv = savedStocks[id];
    if (!sv || !stocks[id]) continue;
    if (typeof sv.currentPrice === "number" && sv.currentPrice > 0) stocks[id].currentPrice = sv.currentPrice;
    if (Array.isArray(sv.history) && sv.history.length) stocks[id].history = sv.history.slice(-CONFIG.HISTORY_LEN);
    if (typeof sv.trendBias === "number") stocks[id].trendBias = sv.trendBias;
    if (typeof sv.lastTick === "number") stocks[id].lastTick = sv.lastTick;
    if (typeof sv.isActive === "boolean") stocks[id].isActive = sv.isActive;
  }

  // 4. admin overrides win last
  const overrides = (custom && custom.overrides) || {};
  for (const id of Object.keys(overrides)) {
    const ov = overrides[id];
    if (!ov || !stocks[id]) continue;
    if (typeof ov.currentPrice === "number" && ov.currentPrice > 0) {
      stocks[id].currentPrice = ov.currentPrice;
      stocks[id].history = stocks[id].history.slice();
      stocks[id].history[stocks[id].history.length - 1] = ov.currentPrice;
    }
    if (typeof ov.volatility === "number") stocks[id].volatility = ov.volatility;
    if (typeof ov.trendBias === "number") stocks[id].trendBias = ov.trendBias;
    if (typeof ov.isActive === "boolean") stocks[id].isActive = ov.isActive;
  }

  return stocks;
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// -- hydration / persistence -----------------------------------------------------------
export function hydrate() {
  const saved = readJSON(CONFIG.STORAGE_KEY, null);

  if (saved && saved.profile) {
    state.profile = mergeProfile(saved.profile);
  }
  if (saved && saved.armyCycles) {
    state.armyCycles = Object.assign({ lastCollectedAt: 0 }, saved.armyCycles);
  }

  const savedMarket = saved && saved.market ? saved.market : null;
  state.market.stocks = buildMarketStocks(savedMarket);
  state.market.lastTickIndex =
    savedMarket && typeof savedMarket.lastTickIndex === "number"
      ? savedMarket.lastTickIndex
      : Math.floor(Date.now() / CONFIG.TICK_MS) - 1;

  refreshUnlocked();
  syncSessionFromStorage();
}

export function refreshUnlocked() {
  if (!state.profile) return;
  const earned = state.profile.totalEarned || 0;
  state.profile.unlockedStocks = Object.values(state.market.stocks)
    .filter((s) => s.unlockRequirement === null || s.unlockRequirement === undefined || earned >= s.unlockRequirement)
    .map((s) => s.id);
}

export function persist() {
  if (!state.profile) return;
  refreshUnlocked();
  writeJSON(CONFIG.STORAGE_KEY, {
    v: 1,
    savedAt: Date.now(),
    profile: state.profile,
    market: state.market,
    armyCycles: state.armyCycles,
  });
}

// -- session ------------------------------------------------------------------------------
export function syncSessionFromStorage() {
  const rec = readJSON(CONFIG.SESSION_KEY, null);
  if (rec && rec.operatorId && rec.hash) {
    state.session = {
      operatorId: rec.operatorId,
      passwordHash: rec.hash,
      salt: rec.salt,
      loggedInAt: rec.loggedInAt || Date.now(),
      isAdmin: rec.operatorId === CONFIG.ADMIN_OPERATOR,
    };
  }
}

export function saveSessionRecord(rec) {
  writeJSON(CONFIG.SESSION_KEY, rec);
  syncSessionFromStorage();
}

export function getSessionRecord() {
  return readJSON(CONFIG.SESSION_KEY, null);
}

export function clearSession() {
  removeKey(CONFIG.SESSION_KEY);
  state.session = null;
}

// -- destructive ops ------------------------------------------------------------------------
export function resetProfile() {
  state.profile = defaultProfile();
  state.armyCycles = { lastCollectedAt: Date.now() };
  persist();
}

export function wipeEverything() {
  removeKey(CONFIG.STORAGE_KEY);
  removeKey(CONFIG.SESSION_KEY);
  removeKey(CONFIG.MARKET_CUSTOM_KEY);
  removeKey(CONFIG.ITEMS_CUSTOM_KEY);
  state.profile = null;
  state.session = null;
}

// -- cross-tab sync ----------------------------------------------------------------------------
let syncBound = false;
export function crossTabSync(onChange) {
  if (syncBound) return;
  syncBound = true;
  window.addEventListener("storage", (e) => {
    if (
      e.key === CONFIG.STORAGE_KEY ||
      e.key === CONFIG.MARKET_CUSTOM_KEY ||
      e.key === CONFIG.ITEMS_CUSTOM_KEY ||
      e.key === CONFIG.SESSION_KEY
    ) {
      if (typeof onChange === "function") onChange(e.key);
      else {
        hydrate();
        emit();
      }
    }
  });
}

export default state;
