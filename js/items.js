// ---------------------------------------------------------------------------
// DevWars: Market & Military - item shop, inventory, boosts
// 54 items defined in items-data.js. This module owns the shop UI, the
// [BUY]/[USE]/[SELL] logic, the ACTIVE EFFECTS panel and boost modifiers.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { state, emit, persist, readCustomItems } from "./state.js";
import { fmtMoney, fmtCountdown, esc, randInt } from "./util.js";
import { icon, toast } from "./ui.js";
import { ITEMS, getPassives as baseGetPassives } from "./items-data.js";

// re-export so market.js / army.js only depend on this module
export const getPassives = baseGetPassives;

const TYPE_LABEL = { booster: "BOOSTERS", consumable: "CONSUMABLES", collectible: "COLLECTIBLES", rare: "RARE", currency: "CURRENCIES" };
const TYPE_ICON = { booster: "zap", consumable: "flask", collectible: "trophy", rare: "crown", currency: "coin" };

let currentFilter = "all";

// ---------------------------------------------------------------------------
// ITEM REGISTRY (base items + admin custom slice)
// ---------------------------------------------------------------------------
let registry = null;

export function buildItems() {
  const custom = readCustomItems();
  const map = {};
  for (const it of ITEMS) map[it.id] = Object.assign({}, it);

  const added = (custom && custom.added) || {};
  for (const id of Object.keys(added)) {
    const a = added[id];
    if (!a || !a.name) continue;
    map[id] = {
      id,
      name: String(a.name).slice(0, 40),
      type: ["booster", "consumable", "collectible", "rare", "currency"].includes(a.type) ? a.type : "collectible",
      rarity: ["COMMON", "RARE", "LEGENDARY"].includes(a.rarity) ? a.rarity : "COMMON",
      cost: Math.max(1, Math.floor(Number(a.cost) || 1)),
      description: String(a.description || "Custom item."),
      usable: false,
      effect: null,
      custom: true,
    };
  }

  const overrides = (custom && custom.overrides) || {};
  for (const id of Object.keys(overrides)) {
    const ov = overrides[id];
    if (!ov || !map[id]) continue;
    if (typeof ov.cost === "number" && ov.cost >= 0) map[id].cost = ov.cost;
    if (typeof ov.name === "string") map[id].name = ov.name;
    if (typeof ov.description === "string") map[id].description = ov.description;
  }

  registry = map;
  return map;
}

export function allItems() {
  if (!registry) buildItems();
  return Object.values(registry);
}

export function itemDef(id) {
  if (!registry) buildItems();
  return registry[id] || null;
}

export function ownedQty(id) {
  return (state.profile && state.profile.items && state.profile.items[id]) || 0;
}

// ---------------------------------------------------------------------------
// BOOST MODIFIERS (timed effects from profile.boosts)
// ---------------------------------------------------------------------------
export function getActiveBoostMods(profile) {
  const p = profile || state.profile;
  const mods = {
    sellProfitBonus: 0,
    botIncomeBonus: 0,
    recruitDiscount: 0,
    upkeepMult: 1,
    atkMult: 1,
    defMult: 1,
    seniorBonus: 0,
  };
  if (!p || !p.boosts) return mods;
  const now = Date.now();
  const b = p.boosts;
  if (b.lucky_penny && b.lucky_penny.expiresAt > now) mods.sellProfitBonus += 0.05;
  if (b.beta_key && b.beta_key.expiresAt > now) mods.sellProfitBonus += 0.15;
  if (b.coffee_shot && b.coffee_shot.expiresAt > now) mods.botIncomeBonus += 0.10;
  if (b.gpu_rental && b.gpu_rental.expiresAt > now) mods.botIncomeBonus += 0.25;
  if (b.spreadsheet_pro && b.spreadsheet_pro.expiresAt > now) mods.recruitDiscount += 0.10;
  if (b.refactor_elixir && b.refactor_elixir.expiresAt > now) mods.upkeepMult *= 0.8;
  if (b.server_uptime && b.server_uptime.expiresAt > now) mods.upkeepMult *= 0.5;
  if (b.power_surge && b.power_surge.expiresAt > now) mods.atkMult *= 1.2;
  if (b.firewall_token && b.firewall_token.expiresAt > now) mods.defMult *= 1.25;
  if (b.code_review && b.code_review.expiresAt > now) mods.seniorBonus += 0.5;
  return mods;
}

// Remove expired boosts/reveals. Returns true if anything was pruned.
export function pruneExpired(profile) {
  const p = profile || state.profile;
  if (!p) return false;
  const now = Date.now();
  let changed = false;
  for (const key of Object.keys(p.boosts || {})) {
    if (p.boosts[key].expiresAt <= now) { delete p.boosts[key]; changed = true; }
  }
  for (const key of Object.keys(p.reveals || {})) {
    if (p.reveals[key].expiresAt <= now) { delete p.reveals[key]; changed = true; }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// BUY / SELL / USE
// ---------------------------------------------------------------------------
export function buyItem(id) {
  const p = state.profile;
  const item = itemDef(id);
  if (!p || !item) return;
  if (p.devCoins < item.cost) { toast("err", "Insufficient funds. Need " + fmtMoney(item.cost) + "."); return; }

  p.devCoins -= item.cost;
  p.items[id] = ownedQty(id) + 1;
  persist();
  emit();

  if (item.type === "currency") {
    toast("ok", "Bought 1 " + item.name + " at face value.");
  } else if (item.usable) {
    toast("ok", "Bought " + item.name + ". Use [USE] to activate it.");
  } else {
    toast("ok", item.name + " acquired. Passive bonus active.");
  }
}

export function sellPrice(item) {
  if (item.type === "currency") return item.cost; // chips trade at face value
  return Math.floor(item.cost * CONFIG.ITEM_SELL_REFUND);
}

export function sellItem(id) {
  const p = state.profile;
  const item = itemDef(id);
  if (!p || !item) return;
  const qty = ownedQty(id);
  if (qty < 1) { toast("err", "You do not own " + item.name + "."); return; }
  const refund = sellPrice(item);
  p.items[id] = qty - 1;
  if (p.items[id] <= 0) delete p.items[id];
  p.devCoins += refund;
  persist();
  emit();
  toast("ok", "Sold 1 " + item.name + " for " + fmtMoney(refund) + ".");
}

function addRandomItems(n, excludeIds) {
  const pool = allItems().filter(
    (it) => it.type !== "currency" && !excludeIds.includes(it.id)
  );
  const names = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const pick = pool[randInt(0, pool.length - 1)];
    state.profile.items[pick.id] = ownedQty(pick.id) + 1;
    names.push(pick.name);
  }
  return names;
}

export function useItem(id) {
  const p = state.profile;
  const item = itemDef(id);
  if (!p || !item) return;
  if (!item.usable || typeof item.effect !== "function") { toast("info", item.name + " has no activatable effect."); return; }
  const qty = ownedQty(id);
  if (qty < 1) { toast("err", "You do not own " + item.name + "."); return; }

  const ctx = {
    now: Date.now(),
    selectedStockId: state.selectedStockId,
    addItems: (n, exclude) => addRandomItems(n, exclude || []),
    forceTick: () => window.dispatchEvent(new CustomEvent("dw-force-tick")),
  };

  let result = null;
  try {
    result = item.effect(p, state.market, ctx);
  } catch (err) {
    toast("err", "Item effect failed.");
    return;
  }

  p.items[id] = qty - 1;
  if (p.items[id] <= 0) delete p.items[id];

  if (result && result.toast) toast("ok", result.toast);
  persist();
  emit();
}

// ---------------------------------------------------------------------------
// ACTIVE EFFECTS PANEL
// ---------------------------------------------------------------------------
function activeEffectsHTML() {
  const p = state.profile;
  if (!p) return "";
  const now = Date.now();
  const rows = [];

  const boostNames = {
    lucky_penny: "+5% sell profit",
    beta_key: "+15% sell profit",
    coffee_shot: "+10% bot income",
    gpu_rental: "+25% bot income",
    spreadsheet_pro: "-10% recruit cost",
    refactor_elixir: "-20% upkeep",
    server_uptime: "-50% upkeep",
    power_surge: "+20% ATK",
    firewall_token: "+25% DEF",
    code_review: "+50% senior recruits",
  };
  for (const key of Object.keys(p.boosts || {})) {
    const b = p.boosts[key];
    if (b.expiresAt <= now) continue;
    rows.push(
      '<div class="fx-row"><span class="fx-name">' + (boostNames[key] || key) + "</span>" +
      '<span class="fx-timer" data-expires="' + b.expiresAt + '">' + fmtCountdown(b.expiresAt - now) + "</span></div>"
    );
  }
  for (const key of Object.keys(p.reveals || {})) {
    const r = p.reveals[key];
    if (r.expiresAt <= now) continue;
    const stock = state.market.stocks[key];
    rows.push(
      '<div class="fx-row"><span class="fx-name">INTEL: ' + (stock ? esc(stock.symbol) : key) + " next " + r.ticks + " ticks</span>" +
      '<span class="fx-timer" data-expires="' + r.expiresAt + '">' + fmtCountdown(r.expiresAt - now) + "</span></div>"
    );
  }
  if (p.flags) {
    if (p.flags.auditShield) rows.push('<div class="fx-row"><span class="fx-name">AUDIT SHIELD armed</span><span class="fx-timer">--:--</span></div>');
    if (p.flags.nextSellBonus) rows.push('<div class="fx-row"><span class="fx-name">WHALE FRIEND: next sell +25%</span><span class="fx-timer">--:--</span></div>');
    if (p.flags.nextRecruitHalfPrice) rows.push('<div class="fx-row"><span class="fx-name">HACKER TOOLKIT: next recruit -50%</span><span class="fx-timer">--:--</span></div>');
  }

  if (!rows.length) {
    return '<div class="fx-empty">No active effects. Boosts and intel appear here with countdowns.</div>';
  }
  return rows.join("");
}

// Called once a second from app.js - cheap targeted DOM update.
export function updateEffectTimers() {
  const timers = document.querySelectorAll(".fx-timer[data-expires]");
  if (!timers.length) return;
  const now = Date.now();
  let anyExpired = false;
  for (const el of timers) {
    const exp = Number(el.dataset.expires);
    if (exp <= now) anyExpired = true;
    else el.textContent = fmtCountdown(exp - now);
  }
  if (anyExpired && state.profile) {
    if (pruneExpired(state.profile)) {
      persist();
      emit();
    }
  }
}

// ---------------------------------------------------------------------------
// ITEMS SCREEN RENDER
// ---------------------------------------------------------------------------
function itemCardHTML(item) {
  const p = state.profile;
  const qty = ownedQty(item.id);
  const canAfford = p.devCoins >= item.cost;
  const passive = (item.type === "collectible" || item.type === "rare") && !item.usable;

  let actions =
    '<button type="button" class="btn btn-buy" data-act="item-buy" data-id="' + item.id + '"' +
    (canAfford ? "" : " disabled") + ">[BUY] " + fmtMoney(item.cost) + "</button>";

  if (item.usable) {
    actions +=
      '<button type="button" class="btn btn-primary" data-act="item-use" data-id="' + item.id + '"' +
      (qty > 0 ? "" : " disabled") + ">[USE]</button>";
  }
  if (qty > 0) {
    actions +=
      '<button type="button" class="btn btn-sell" data-act="item-sell" data-id="' + item.id + '">[SELL] ' + fmtMoney(sellPrice(item)) + "</button>";
  }
  if (passive && qty > 0) {
    actions += '<span class="equipped-tag">[EQUIP] ACTIVE</span>';
  }

  return (
    '<article class="card item-card" data-id="' + item.id + '">' +
    '<div class="item-head"><span class="item-icon">' + icon(TYPE_ICON[item.type] || "box", 20) + "</span>" +
    '<div class="item-id"><span class="iname">' + esc(item.name) + "</span>" +
    '<span class="tags"><span class="tag rar-' + item.rarity + '">' + item.rarity + "</span>" +
    '<span class="tag type-' + item.type + '">' + TYPE_LABEL[item.type] + "</span></span></div>" +
    '<span class="owned">x' + qty + "</span></div>" +
    '<p class="idesc">' + esc(item.description) + "</p>" +
    '<div class="item-actions">' + actions + "</div>" +
    "</article>"
  );
}

export function renderItems() {
  const wrap = document.createElement("div");
  wrap.className = "screen items-screen";

  const filters = ["all", "booster", "consumable", "collectible", "rare", "currency"];
  let chips = '<div class="chips" role="tablist" aria-label="Item filters">';
  for (const f of filters) {
    chips +=
      '<button type="button" role="tab" class="chip' + (currentFilter === f ? " active" : "") +
      '" data-filter="' + f + '" aria-selected="' + (currentFilter === f) + '">' +
      (f === "all" ? "ALL" : TYPE_LABEL[f]) + "</button>";
  }
  chips += "</div>";

  const items = allItems()
    .filter((it) => currentFilter === "all" || it.type === currentFilter)
    .sort((a, b) => a.cost - b.cost);

  let grid = '<div class="items-grid">';
  for (const it of items) grid += itemCardHTML(it);
  grid += "</div>";

  wrap.innerHTML =
    chips +
    '<section class="fx-panel" aria-label="Active effects"><h2 class="section-title">' + icon("eye", 14) +
    " ACTIVE EFFECTS</h2>" + activeEffectsHTML() + "</section>" +
    '<div class="list-head"><span>' + items.length + " ITEMS IN SHOP</span><span>OWNED TYPES " +
    Object.keys(state.profile.items).length + "</span></div>" +
    grid;

  wrap.addEventListener("click", (e) => {
    const chipEl = e.target.closest("[data-filter]");
    if (chipEl) {
      currentFilter = chipEl.dataset.filter;
      emit();
      return;
    }
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.dataset.act;
    const id = actEl.dataset.id;
    if (act === "item-buy") buyItem(id);
    else if (act === "item-use") useItem(id);
    else if (act === "item-sell") sellItem(id);
  });

  return wrap;
}

export default {
  buildItems, allItems, itemDef, ownedQty, getPassives, getActiveBoostMods,
  pruneExpired, buyItem, sellItem, useItem, sellPrice,
  updateEffectTimers, renderItems,
};
