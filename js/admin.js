// ---------------------------------------------------------------------------
// DevWars: Market & Military - ADMIN panel
// Visible only when session.operatorId === "admin".
// Persists edits into devwars.market.custom / devwars.items.custom slices.
// ---------------------------------------------------------------------------

import {
  state, emit, persist, resetProfile, wipeEverything,
  readCustomMarket, writeCustomMarket, readCustomItems, writeCustomItems,
  buildMarketStocks,
} from "./state.js";
import { fmtMoney, esc } from "./util.js";
import { icon, toast, confirmModal } from "./ui.js";
import { refresh } from "./router.js";
import { forceTick } from "./market.js";
import { buildItems, allItems } from "./items.js";

let adminTab = "market";

function saveStockOverride(id, patch) {
  const custom = readCustomMarket();
  if (custom.added[id]) Object.assign(custom.added[id], patch);
  else custom.overrides[id] = Object.assign({}, custom.overrides[id], patch);
  writeCustomMarket(custom);
}

function saveItemOverride(id, patch) {
  const custom = readCustomItems();
  if (custom.added[id]) Object.assign(custom.added[id], patch);
  else custom.overrides[id] = Object.assign({}, custom.overrides[id], patch);
  writeCustomItems(custom);
}

// ---------------------------------------------------------------------------
// MARKET CONTROL TAB
// ---------------------------------------------------------------------------
function marketTabHTML() {
  const stocks = Object.values(state.market.stocks).sort((a, b) => a.symbol.localeCompare(b.symbol));
  let html = '<div class="admin-toolbar">' +
    '<button type="button" class="btn btn-primary" data-adm="force-tick">[FORCE TICK]</button>' +
    '<span class="admin-hint">Tick index ' + state.market.lastTickIndex + "</span></div>";

  html += '<div class="card admin-form"><h3 class="admin-sub">ADD NEW STOCK</h3>' +
    '<div class="form-grid">' +
    '<label>SYMBOL<input id="adm-new-sym" maxlength="8" placeholder="ABCD" autocomplete="off"></label>' +
    '<label>NAME<input id="adm-new-name" maxlength="40" placeholder="Acme Corp" autocomplete="off"></label>' +
    '<label>BASE PRICE<input id="adm-new-price" type="number" min="1" step="0.01" value="10"></label>' +
    '<label>VOLATILITY<input id="adm-new-vol" type="number" min="0.001" max="0.2" step="0.001" value="0.03"></label>' +
    '<label>CATEGORY<select id="adm-new-cat">' +
    ["basic", "language", "hardware", "ai", "security", "web", "crypto", "legacy", "exotic", "quantum"]
      .map((c) => '<option value="' + c + '">' + c + "</option>").join("") +
    "</select></label>" +
    '<label>UNLOCK (EARNED)<input id="adm-new-unlock" type="number" min="0" step="100" value="0"></label>' +
    "</div>" +
    '<button type="button" class="btn btn-buy" data-adm="add-stock">[ADD STOCK]</button></div>';

  html += '<div class="admin-rows">';
  for (const s of stocks) {
    html +=
      '<div class="card admin-row">' +
      '<div class="admin-row-head"><span class="sym">' + esc(s.symbol) + "</span>" +
      '<span class="sname">' + esc(s.name) + "</span>" +
      (s.custom ? '<span class="tag rar-RARE">CUSTOM</span>' : "") +
      '<label class="inline-check"><input type="checkbox" data-adm-input="active" data-stock="' + s.id + '"' +
      (s.isActive ? " checked" : "") + '> ACTIVE</label></div>' +
      '<div class="form-grid">' +
      '<label>PRICE<input type="number" step="0.01" min="0.01" value="' + s.currentPrice.toFixed(2) +
      '" data-adm-input="price" data-stock="' + s.id + '"></label>' +
      '<label>VOL<input type="number" step="0.001" min="0.001" max="0.2" value="' + s.volatility.toFixed(3) +
      '" data-adm-input="vol" data-stock="' + s.id + '"></label>' +
      '<label>BIAS<input type="number" step="0.001" min="-0.05" max="0.05" value="' + s.trendBias.toFixed(3) +
      '" data-adm-input="bias" data-stock="' + s.id + '"></label>' +
      "</div>" +
      '<button type="button" class="btn btn-primary" data-adm="apply-stock" data-stock="' + s.id + '">[APPLY]</button>' +
      "</div>";
  }
  html += "</div>";
  return html;
}

// ---------------------------------------------------------------------------
// ITEMS CONTROL TAB
// ---------------------------------------------------------------------------
function itemsTabHTML() {
  let html = '<div class="card admin-form"><h3 class="admin-sub">ADD NEW ITEM</h3>' +
    '<div class="form-grid">' +
    '<label>NAME<input id="adm-item-name" maxlength="40" placeholder="Debug Duck" autocomplete="off"></label>' +
    '<label>COST<input id="adm-item-cost" type="number" min="1" step="1" value="100"></label>' +
    '<label>TYPE<select id="adm-item-type">' +
    ["collectible", "booster", "consumable", "rare", "currency"]
      .map((t) => '<option value="' + t + '">' + t + "</option>").join("") +
    "</select></label>" +
    '<label>RARITY<select id="adm-item-rar">' +
    ["COMMON", "RARE", "LEGENDARY"].map((r) => '<option value="' + r + '">' + r + "</option>").join("") +
    "</select></label>" +
    '<label class="wide">DESCRIPTION<input id="adm-item-desc" maxlength="120" placeholder="A custom item." autocomplete="off"></label>' +
    "</div>" +
    '<button type="button" class="btn btn-buy" data-adm="add-item">[ADD ITEM]</button></div>';

  html += '<div class="admin-rows">';
  for (const it of allItems().sort((a, b) => a.type.localeCompare(b.type) || a.cost - b.cost)) {
    html +=
      '<div class="card admin-row">' +
      '<div class="admin-row-head"><span class="sym">' + esc(it.name) + "</span>" +
      '<span class="tag type-' + it.type + '">' + it.type.toUpperCase() + "</span>" +
      (it.custom ? '<span class="tag rar-RARE">CUSTOM</span>' : "") + "</div>" +
      '<div class="form-grid">' +
      '<label>COST<input type="number" min="0" step="1" value="' + it.cost + '" data-adm-input="cost" data-item="' + it.id + '"></label>' +
      "</div>" +
      '<button type="button" class="btn btn-primary" data-adm="apply-item" data-item="' + it.id + '">[APPLY]</button>' +
      "</div>";
  }
  html += "</div>";
  return html;
}

// ---------------------------------------------------------------------------
// GLOBAL CONTROLS TAB
// ---------------------------------------------------------------------------
function globalTabHTML() {
  return (
    '<div class="card admin-form"><h3 class="admin-sub">GRANT DEVCOINS</h3>' +
    '<div class="form-grid"><label>AMOUNT<input id="adm-grant-amt" type="number" min="1" step="100" value="10000"></label></div>' +
    '<button type="button" class="btn btn-buy" data-adm="grant">[GRANT]</button></div>' +
    '<div class="card admin-form"><h3 class="admin-sub">DANGER ZONE</h3>' +
    '<div class="row gap wrap">' +
    '<button type="button" class="btn btn-danger" data-adm="reset">[RESET PROFILE]</button>' +
    '<button type="button" class="btn btn-danger" data-adm="wipe">[WIPE EVERYTHING]</button>' +
    "</div>" +
    '<p class="admin-hint">Reset clears the player profile only. Wipe clears session, profile and all admin custom data, then reloads.</p></div>'
  );
}

// ---------------------------------------------------------------------------
// ADMIN SCREEN
// ---------------------------------------------------------------------------
export function renderAdmin() {
  const wrap = document.createElement("div");
  wrap.className = "screen admin-screen";

  if (!state.session || !state.session.isAdmin) {
    wrap.innerHTML = '<div class="card denied">' + icon("lock", 24) +
      "<h2>[ERR] ACCESS DENIED</h2><p>Admin clearance required. Log in as operator \"admin\".</p></div>";
    return wrap;
  }

  const tabs = [["market", "MARKET CONTROL"], ["items", "ITEMS CONTROL"], ["global", "GLOBAL CONTROLS"]];
  let chips = '<div class="chips">';
  for (const [key, label] of tabs) {
    chips += '<button type="button" class="chip' + (adminTab === key ? " active" : "") + '" data-admtab="' + key + '">' + label + "</button>";
  }
  chips += "</div>";

  let body = "";
  if (adminTab === "market") body = marketTabHTML();
  else if (adminTab === "items") body = itemsTabHTML();
  else body = globalTabHTML();

  wrap.innerHTML =
    '<div class="admin-head">' + icon("key", 18) +
    '<h1>ADMIN PANEL</h1><span class="admin-hint">operator: ' + esc(state.session.operatorId) + "</span></div>" +
    chips + body;

  wrap.addEventListener("click", (e) => {
    const tabEl = e.target.closest("[data-admtab]");
    if (tabEl) { adminTab = tabEl.dataset.admtab; refresh(); return; }

    const el = e.target.closest("[data-adm]");
    if (!el) return;
    const act = el.dataset.adm;

    if (act === "force-tick") {
      forceTick();
      toast("ok", "Manual tick forced. Index " + state.market.lastTickIndex + ".");
      refresh();
      return;
    }

    if (act === "apply-stock") {
      const id = el.dataset.stock;
      const stock = state.market.stocks[id];
      if (!stock) return;
      const price = parseFloat(inputVal(wrap, "price", id));
      const vol = parseFloat(inputVal(wrap, "vol", id));
      const bias = parseFloat(inputVal(wrap, "bias", id));
      const activeEl = wrap.querySelector('[data-adm-input="active"][data-stock="' + id + '"]');
      const patch = {};
      if (Number.isFinite(price) && price > 0) { stock.currentPrice = price; patch.currentPrice = price; }
      if (Number.isFinite(vol)) { stock.volatility = Math.max(0.001, Math.min(0.2, vol)); patch.volatility = stock.volatility; }
      if (Number.isFinite(bias)) { stock.trendBias = Math.max(-0.05, Math.min(0.05, bias)); patch.trendBias = stock.trendBias; }
      if (activeEl) { stock.isActive = activeEl.checked; patch.isActive = stock.isActive; }
      saveStockOverride(id, patch);
      persist();
      toast("ok", stock.symbol + " updated.");
      return;
    }

    if (act === "add-stock") {
      const sym = ($("#adm-new-sym", wrap).value || "").trim().toUpperCase();
      const name = ($("#adm-new-name", wrap).value || "").trim();
      const price = parseFloat($("#adm-new-price", wrap).value);
      const vol = parseFloat($("#adm-new-vol", wrap).value);
      const cat = $("#adm-new-cat", wrap).value;
      const unlock = parseFloat($("#adm-new-unlock", wrap).value);
      if (!/^[A-Z0-9]{2,8}$/.test(sym)) { toast("err", "Symbol must be 2-8 chars A-Z / 0-9."); return; }
      const clash = Object.values(state.market.stocks).some((s) => s.symbol === sym);
      if (clash) { toast("err", "Symbol already exists."); return; }
      if (!Number.isFinite(price) || price < 1) { toast("err", "Base price must be >= 1."); return; }
      const id = "custom_" + sym.toLowerCase();
      const def = {
        symbol: sym,
        name: name || sym,
        basePrice: price,
        currentPrice: price,
        volatility: Number.isFinite(vol) ? Math.max(0.001, Math.min(0.2, vol)) : 0.03,
        trendBias: 0,
        category: cat,
        unlockRequirement: Number.isFinite(unlock) ? Math.max(0, unlock) : 0,
        history: [price, price, price],
        isActive: true,
        lastTick: state.market.lastTickIndex,
        custom: true,
      };
      const custom = readCustomMarket();
      custom.added[id] = def;
      writeCustomMarket(custom);
      state.market.stocks = buildMarketStocks({ stocks: state.market.stocks, lastTickIndex: state.market.lastTickIndex });
      persist();
      toast("ok", "Stock " + sym + " listed.");
      refresh();
      return;
    }

    if (act === "apply-item") {
      const id = el.dataset.item;
      const cost = parseFloat(inputVal(wrap, "cost", id, "item"));
      if (!Number.isFinite(cost) || cost < 0) { toast("err", "Cost must be a number >= 0."); return; }
      saveItemOverride(id, { cost: Math.floor(cost) });
      buildItems();
      toast("ok", "Item cost updated.");
      return;
    }

    if (act === "add-item") {
      const name = ($("#adm-item-name", wrap).value || "").trim();
      const cost = parseFloat($("#adm-item-cost", wrap).value);
      const type = $("#adm-item-type", wrap).value;
      const rarity = $("#adm-item-rar", wrap).value;
      const desc = ($("#adm-item-desc", wrap).value || "").trim();
      if (!name) { toast("err", "Item name required."); return; }
      if (!Number.isFinite(cost) || cost < 1) { toast("err", "Cost must be >= 1."); return; }
      const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
      const custom = readCustomItems();
      custom.added[id] = { name, cost: Math.floor(cost), type, rarity, description: desc || "A custom item." };
      writeCustomItems(custom);
      buildItems();
      toast("ok", "Item \"" + name + "\" added to the shop.");
      refresh();
      return;
    }

    if (act === "grant") {
      const amt = parseFloat($("#adm-grant-amt", wrap).value);
      if (!Number.isFinite(amt) || amt < 1) { toast("err", "Amount must be >= 1."); return; }
      state.profile.devCoins += amt;
      persist();
      emit();
      toast("ok", "Granted " + fmtMoney(amt) + " DevCoins.");
      return;
    }

    if (act === "reset") {
      confirmModal("[!] This cannot be undone. Reset the player profile?", (yes) => {
        if (!yes) return;
        resetProfile();
        emit();
        toast("warn", "Profile reset.");
      });
      return;
    }

    if (act === "wipe") {
      confirmModal("[!] This cannot be undone. Wipe ALL DevWars data on this device?", (yes) => {
        if (!yes) return;
        wipeEverything();
        window.location.reload();
      });
    }
  });

  return wrap;
}

function inputVal(root, field, id, kind) {
  const attr = kind === "item" ? "data-item" : "data-stock";
  const el = root.querySelector('[data-adm-input="' + field + '"]["' + attr + '="' + id + '"]');
  return el ? el.value : "";
}

function $(sel, root) {
  return (root || document).querySelector(sel);
}

export default { renderAdmin };
