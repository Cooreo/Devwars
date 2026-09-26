// ---------------------------------------------------------------------------
// DevWars: Market & Military - market engine + MARKET screen
// Deterministic 3s tick shared across tabs via a seeded PRNG keyed by
// Math.floor(Date.now()/3000). Buy/sell, power-ups, unlock tiers, charts.
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { state, emit, persist, refreshUnlocked } from "./state.js";
import { mulberry32, hashStr, clamp, fmtMoney, fmtPct, fmtNum, esc, tickIndexAt } from "./util.js";
import { drawSparkline, drawChart } from "./chart.js";
import { icon, toast, openModal } from "./ui.js";
import { getPassives, getActiveBoostMods } from "./items.js";

// per-card stepper quantities survive re-renders
const uiQty = {};

// ---------------------------------------------------------------------------
// DETERMINISTIC TICK ENGINE
// ---------------------------------------------------------------------------
function rngFor(stockId, tickIdx) {
  const seed = (hashStr(stockId) ^ Math.imul(tickIdx + 1, 2654435761)) >>> 0;
  return mulberry32(seed);
}

function tickStock(stock, tickIdx) {
  if (!stock.isActive) return;
  const rnd = rngFor(stock.id, tickIdx);
  const change = (rnd() - 0.5 + stock.trendBias) * stock.volatility * stock.currentPrice;
  stock.currentPrice = Math.max(0.01, stock.currentPrice + change);
  stock.history.push(stock.currentPrice);
  if (stock.history.length > CONFIG.HISTORY_LEN) stock.history.shift();
  // slow random drift of trendBias toward 0
  stock.trendBias += (rnd() - 0.5) * 0.004;
  stock.trendBias *= 0.995;
  stock.trendBias = clamp(stock.trendBias, -0.05, 0.05);
  stock.lastTick = tickIdx;
}

export function applyTicks(targetIndex) {
  const stocks = state.market.stocks;
  let applied = 0;
  while (state.market.lastTickIndex < targetIndex && applied < CONFIG.MAX_CATCHUP_TICKS) {
    state.market.lastTickIndex += 1;
    for (const id of Object.keys(stocks)) tickStock(stocks[id], state.market.lastTickIndex);
    applied += 1;
  }
  if (targetIndex - state.market.lastTickIndex > CONFIG.MAX_CATCHUP_TICKS) {
    state.market.lastTickIndex = targetIndex;
  }
  return applied;
}

export function catchup() {
  const current = tickIndexAt();
  if (state.market.lastTickIndex < current) {
    applyTicks(Math.min(current, state.market.lastTickIndex + CONFIG.MAX_CATCHUP_TICKS));
  }
}

let loopStarted = false;
export function startLoop() {
  if (loopStarted) return;
  loopStarted = true;

  window.setInterval(() => {
    const current = tickIndexAt();
    if (current > state.market.lastTickIndex) {
      applyTicks(current);
      persist();
      emit();
    }
  }, 1000);

  window.addEventListener("dw-force-tick", () => {
    applyTicks(state.market.lastTickIndex + 1);
    persist();
    emit();
  });
}

export function forceTick() {
  applyTicks(state.market.lastTickIndex + 1);
  persist();
  emit();
}

// Deterministic forecast of the next n ticks for one stock.
export function forecast(stockId, n) {
  const stock = state.market.stocks[stockId];
  if (!stock) return [];
  let price = stock.currentPrice;
  let bias = stock.trendBias;
  const out = [];
  for (let i = 1; i <= n; i += 1) {
    const idx = state.market.lastTickIndex + i;
    const rnd = rngFor(stockId, idx);
    const change = (rnd() - 0.5 + bias) * stock.volatility * price;
    price = Math.max(0.01, price + change);
    bias += (rnd() - 0.5) * 0.004;
    bias *= 0.995;
    bias = clamp(bias, -0.05, 0.05);
    out.push(price);
  }
  return out;
}

// ---------------------------------------------------------------------------
// UNLOCKS / HOLDINGS
// ---------------------------------------------------------------------------
export function isUnlocked(stock) {
  if (!state.profile) return false;
  const req = stock.unlockRequirement;
  if (req === null || req === undefined) return true;
  return (state.profile.totalEarned || 0) >= req;
}

export function lockedPreview() {
  return Object.values(state.market.stocks)
    .filter((s) => s.isActive && !isUnlocked(s))
    .sort((a, b) => (a.unlockRequirement || 0) - (b.unlockRequirement || 0))
    .slice(0, CONFIG.LOCKED_PREVIEW_COUNT);
}

export function maxHolding() {
  if (!state.profile) return CONFIG.HOLDING_CAP_BASE;
  const rack = state.profile.powerups && state.profile.powerups.serverRack ? CONFIG.HOLDING_CAP_RACK : CONFIG.HOLDING_CAP_BASE;
  return rack + getPassives(state.profile.items).holdingAdd;
}

export function heldQty(stockId) {
  return (state.profile && state.profile.holdings[stockId]) || 0;
}

export function avgCost(stockId) {
  const p = state.profile;
  if (!p) return 0;
  const qty = p.holdings[stockId] || 0;
  const basis = p.costBasis[stockId] || 0;
  return qty > 0 ? basis / qty : 0;
}

export function changePct(stock) {
  const hist = stock.history;
  if (hist.length < 2) return 0;
  const prev = hist[hist.length - 2];
  if (prev <= 0) return 0;
  return ((stock.currentPrice - prev) / prev) * 100;
}

function hasInsight(stockId) {
  const p = state.profile;
  if (!p) return false;
  if (p.powerups && p.powerups.insiderBot) return true;
  if (getPassives(p.items).oracle) return true;
  const rev = p.reveals && p.reveals[stockId];
  return !!(rev && rev.expiresAt > Date.now());
}

function trendArrow(stock) {
  if (!hasInsight(stock.id)) return "";
  if (stock.trendBias > 0.002) return '<span class="trend trend-up">' + icon("arrowUp", 12) + "</span>";
  if (stock.trendBias < -0.002) return '<span class="trend trend-down">' + icon("arrowDown", 12) + "</span>";
  return '<span class="trend trend-flat">' + icon("arrowFlat", 12) + "</span>";
}

function revealForecast(stockId) {
  const p = state.profile;
  if (!p) return [];
  const oracle = getPassives(p.items).oracle;
  const rev = p.reveals && p.reveals[stockId];
  let n = 0;
  if (rev && rev.expiresAt > Date.now()) n = rev.ticks;
  if (oracle) n = Math.max(n, 1);
  return n > 0 ? forecast(stockId, n) : [];
}

// ---------------------------------------------------------------------------
// TRADING
// ---------------------------------------------------------------------------
export function buyStock(stockId, qty) {
  const p = state.profile;
  const stock = state.market.stocks[stockId];
  if (!p || !stock) return;
  const n = Math.floor(qty);
  if (!stock.isActive) { toast("err", stock.symbol + " is suspended."); return; }
  if (!isUnlocked(stock)) { toast("err", stock.symbol + " is locked. Earn more to unlock."); return; }
  if (n < 1) { toast("err", "Quantity must be at least 1."); return; }

  const held = heldQty(stockId);
  const cap = maxHolding();
  if (held + n > cap) { toast("err", "Holding cap reached (" + cap + " per stock)."); return; }

  const cost = stock.currentPrice * n;
  if (p.devCoins < cost) { toast("err", "Insufficient funds. Need " + fmtMoney(cost) + "."); return; }

  p.devCoins -= cost;
  p.holdings[stockId] = held + n;
  p.costBasis[stockId] = (p.costBasis[stockId] || 0) + cost;
  if (!state.selectedStockId) state.selectedStockId = stockId;
  persist();
  emit();
  toast("ok", "Bought " + n + " " + stock.symbol + " for " + fmtMoney(cost) + ".");
}

export function sellStock(stockId, qty) {
  const p = state.profile;
  const stock = state.market.stocks[stockId];
  if (!p || !stock) return;
  const n = Math.floor(qty);
  const held = heldQty(stockId);
  if (n < 1) { toast("err", "Quantity must be at least 1."); return; }
  if (held < n) { toast("err", "You only hold " + held + " " + stock.symbol + "."); return; }

  const avg = avgCost(stockId);
  const revenue = stock.currentPrice * n;
  let profit = (stock.currentPrice - avg) * n;

  // sell-profit bonuses: boosts, collectibles, whale friend one-shot
  const mods = getActiveBoostMods(p);
  const passives = getPassives(p.items);
  let bonus = mods.sellProfitBonus + passives.sellProfitBonus;
  if (p.flags && p.flags.nextSellBonus) {
    bonus += p.flags.nextSellBonus;
    delete p.flags.nextSellBonus;
  }
  let extra = 0;
  if (profit > 0 && bonus > 0) extra = profit * bonus;
  const gained = revenue + extra;

  p.devCoins += gained;
  p.holdings[stockId] = held - n;
  if (p.holdings[stockId] <= 0) {
    delete p.holdings[stockId];
    delete p.costBasis[stockId];
  } else {
    p.costBasis[stockId] = Math.max(0, (p.costBasis[stockId] || 0) - avg * n);
  }
  if (profit > 0) {
    p.totalEarned = (p.totalEarned || 0) + profit + extra;
  }
  refreshUnlocked();
  persist();
  emit();
  const bonusNote = extra > 0 ? " (incl. +" + fmtMoney(extra) + " bonus)" : "";
  toast(profit >= 0 ? "ok" : "warn",
    "Sold " + n + " " + stock.symbol + " for " + fmtMoney(gained) + ". P/L " + fmtMoney(profit) + bonusNote);
}

export function buyPowerup(powerId) {
  const p = state.profile;
  const def = CONFIG.POWERUPS[powerId];
  if (!p || !def) return;
  if (p.powerups[powerId]) { toast("info", def.name + " already installed."); return; }
  if (p.devCoins < def.cost) { toast("err", "Insufficient funds. Need " + fmtMoney(def.cost) + "."); return; }
  p.devCoins -= def.cost;
  p.powerups[powerId] = true;
  persist();
  emit();
  toast("ok", def.name + " installed.");
}

// ---------------------------------------------------------------------------
// CHART MODAL
// ---------------------------------------------------------------------------
export function openChartModal(stockId) {
  const stock = state.market.stocks[stockId];
  if (!stock) return;
  state.selectedStockId = stockId;

  const body = document.createElement("div");
  body.className = "chart-modal";
  body.innerHTML =
    '<div class="chart-modal-head">' +
    '<span class="sym">' + esc(stock.symbol) + '</span><span class="sname">' + esc(stock.name) + "</span>" +
    '<span class="price">' + fmtMoney(stock.currentPrice) + "</span>" +
    '<span class="chg ' + (changePct(stock) >= 0 ? "up" : "down") + '">' + fmtPct(changePct(stock), true) + "</span>" +
    "</div>" +
    '<canvas class="big-chart"></canvas>' +
    '<div class="chart-modal-meta">VOL ' + (stock.volatility * 100).toFixed(1) + "% | BIAS " +
    (stock.trendBias * 100).toFixed(2) + "% | CAT " + esc(stock.category.toUpperCase()) +
    " | HELD " + heldQty(stockId) + "</div>";

  openModal({
    title: icon("chart", 16) + " " + esc(stock.symbol) + " CHART",
    body,
    onClose: () => emit(),
  });

  const canvas = body.querySelector("canvas");
  const width = Math.min(360, window.innerWidth - 64);
  drawChart(canvas, stock.history.slice(), { width, height: 220, forecast: revealForecast(stockId) });
}

// ---------------------------------------------------------------------------
// MARKET SCREEN RENDER
// ---------------------------------------------------------------------------
function qtyFor(id) {
  return uiQty[id] || 1;
}

function powerupCard(def, owned) {
  return (
    '<div class="card powerup-card">' +
    '<div class="powerup-info"><span class="pu-name">' + icon("zap", 14) + " " + esc(def.name) + "</span>" +
    '<span class="pu-desc">' + esc(def.description) + "</span></div>" +
    (owned
      ? '<button class="btn btn-ghost" disabled>[OWNED]</button>'
      : '<button class="btn btn-primary" data-act="buy-powerup" data-id="' + def.id + '">[BUY] ' + fmtMoney(def.cost) + "</button>") +
    "</div>"
  );
}

function stockCardHTML(stock) {
  const held = heldQty(stock.id);
  const avg = avgCost(stock.id);
  const pl = held > 0 ? (stock.currentPrice - avg) * held : 0;
  const chg = changePct(stock);
  return (
    '<article class="card stock-card" data-id="' + stock.id + '" data-act="select" tabindex="0">' +
    '<div class="stock-head">' +
    '<button type="button" class="spark-btn" data-act="chart" data-id="' + stock.id + '" aria-label="Open chart for ' + esc(stock.symbol) + '">' +
    '<canvas class="spark" data-spark="' + stock.id + '" width="60" height="18"></canvas></button>' +
    '<div class="stock-id"><span class="sym">' + esc(stock.symbol) + "</span>" +
    '<span class="sname">' + esc(stock.name) + "</span></div>" +
    trendArrow(stock) +
    '<div class="stock-price"><span class="price">' + fmtMoney(stock.currentPrice) + "</span>" +
    '<span class="chg ' + (chg >= 0 ? "up" : "down") + '">' + fmtPct(chg, true) + "</span></div>" +
    "</div>" +
    '<div class="stock-meta">HELD ' + held + " | AVG " + (held > 0 ? fmtMoney(avg) : "--") +
    ' | P/L <span class="' + (pl >= 0 ? "up" : "down") + '">' + (held > 0 ? fmtMoney(pl) : "--") + "</span>" +
    ' | CAP ' + maxHolding() + "</div>" +
    '<div class="stock-actions">' +
    '<div class="stepper">' +
    '<button type="button" class="btn btn-ghost btn-icon" data-act="dec" data-id="' + stock.id + '" aria-label="Decrease quantity">[-]</button>' +
    '<span class="qty" data-qty="' + stock.id + '">' + qtyFor(stock.id) + "</span>" +
    '<button type="button" class="btn btn-ghost btn-icon" data-act="inc" data-id="' + stock.id + '" aria-label="Increase quantity">[+]</button>' +
    "</div>" +
    '<button type="button" class="btn btn-buy" data-act="buy" data-id="' + stock.id + '">[BUY]</button>' +
    '<button type="button" class="btn btn-sell" data-act="sell" data-id="' + stock.id + '"' + (held < 1 ? " disabled" : "") + ">[SELL]</button>" +
    "</div></article>"
  );
}

function detailHTML(stock) {
  if (!stock) {
    return '<div class="detail-empty">' + icon("chart", 28) + "<p>Select a stock to inspect its chart.</p></div>";
  }
  const held = heldQty(stock.id);
  const avg = avgCost(stock.id);
  const pl = held > 0 ? (stock.currentPrice - avg) * held : 0;
  const chg = changePct(stock);
  return (
    '<div class="detail-inner">' +
    '<div class="detail-head"><span class="sym">' + esc(stock.symbol) + "</span>" + trendArrow(stock) +
    '<span class="sname">' + esc(stock.name) + "</span></div>" +
    '<div class="detail-price"><span class="price">' + fmtMoney(stock.currentPrice) + "</span>" +
    '<span class="chg ' + (chg >= 0 ? "up" : "down") + '">' + fmtPct(chg, true) + "</span></div>" +
    '<canvas class="detail-chart" data-detail="' + stock.id + '"></canvas>' +
    '<dl class="detail-stats">' +
    "<dt>HELD</dt><dd>" + held + "</dd>" +
    "<dt>AVG COST</dt><dd>" + (held > 0 ? fmtMoney(avg) : "--") + "</dd>" +
    "<dt>P/L</dt><dd class='" + (pl >= 0 ? "up" : "down") + "'>" + (held > 0 ? fmtMoney(pl) : "--") + "</dd>" +
    "<dt>VOLATILITY</dt><dd>" + (stock.volatility * 100).toFixed(1) + "%</dd>" +
    "<dt>CATEGORY</dt><dd>" + esc(stock.category.toUpperCase()) + "</dd>" +
    "<dt>STATUS</dt><dd>" + (stock.isActive ? "ACTIVE" : "SUSPENDED") + "</dd>" +
    "</dl>" +
    '<div class="stock-actions">' +
    '<div class="stepper">' +
    '<button type="button" class="btn btn-ghost btn-icon" data-act="dec" data-id="' + stock.id + '" aria-label="Decrease quantity">[-]</button>' +
    '<span class="qty" data-qty="' + stock.id + '">' + qtyFor(stock.id) + "</span>" +
    '<button type="button" class="btn btn-ghost btn-icon" data-act="inc" data-id="' + stock.id + '" aria-label="Increase quantity">[+]</button>' +
    "</div>" +
    '<button type="button" class="btn btn-buy" data-act="buy" data-id="' + stock.id + '">[BUY]</button>' +
    '<button type="button" class="btn btn-sell" data-act="sell" data-id="' + stock.id + '"' + (held < 1 ? " disabled" : "") + ">[SELL]</button>" +
    "</div></div>"
  );
}

export function renderMarket() {
  const p = state.profile;
  const wrap = document.createElement("div");
  wrap.className = "screen market-screen";

  const all = Object.values(state.market.stocks);
  const unlockedStocks = all.filter((s) => s.isActive && isUnlocked(s))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const locked = lockedPreview();

  let html = "";

  // power-ups -----------------------------------------------------------------
  html += '<section class="section-block"><h2 class="section-title">' + icon("zap", 14) + " POWER-UPS</h2><div class='powerup-list'>";
  for (const key of Object.keys(CONFIG.POWERUPS)) {
    html += powerupCard(CONFIG.POWERUPS[key], !!(p.powerups && p.powerups[key]));
  }
  html += "</div></section>";

  // locked preview --------------------------------------------------------------
  if (locked.length) {
    html += '<section class="section-block"><h2 class="section-title">' + icon("lock", 14) + " LOCKED SIGNALS</h2><div class='locked-list'>";
    for (const s of locked) {
      html +=
        '<div class="locked-row"><span class="sym">' + esc(s.symbol) + "</span>" +
        '<span class="sname">' + esc(s.name) + "</span>" +
        '<span class="req">REQ: ' + fmtNum(s.unlockRequirement || 0) + " TOTAL EARNED</span></div>";
    }
    html += "</div></section>";
  }

  // two-column market --------------------------------------------------------------
  html += '<section class="section-block two-col">';
  html += '<div class="stock-list">';
  html += '<div class="list-head"><span>' + unlockedStocks.length + " ACTIVE STOCKS</span><span>EARNED " + fmtMoney(p.totalEarned || 0) + "</span></div>";
  for (const s of unlockedStocks) html += stockCardHTML(s);
  html += "</div>";

  const sel = state.market.stocks[state.selectedStockId] || null;
  html += '<aside class="detail-panel">' + detailHTML(sel) + "</aside>";
  html += "</section>";

  wrap.innerHTML = html;

  // draw canvases ---------------------------------------------------------------
  for (const cv of wrap.querySelectorAll("canvas[data-spark]")) {
    const stock = state.market.stocks[cv.dataset.spark];
    if (stock) drawSparkline(cv, stock.history.slice(-18));
  }
  const detailCv = wrap.querySelector("canvas[data-detail]");
  if (detailCv && sel) {
    drawChart(detailCv, sel.history.slice(), { width: 300, height: 170, forecast: revealForecast(sel.id) });
  }

  // event delegation -----------------------------------------------------------------
  wrap.addEventListener("click", (e) => {
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.dataset.act;
    const id = actEl.dataset.id;

    if (act === "select") {
      state.selectedStockId = actEl.dataset.id;
      emit();
      return;
    }
    if (act === "chart") {
      e.stopPropagation();
      openChartModal(id);
      return;
    }
    if (act === "inc" || act === "dec") {
      const cap = maxHolding();
      uiQty[id] = clamp(qtyFor(id) + (act === "inc" ? 1 : -1), 1, cap);
      for (const span of wrap.querySelectorAll('[data-qty="' + id + '"]')) span.textContent = uiQty[id];
      return;
    }
    if (act === "buy") { buyStock(id, qtyFor(id)); return; }
    if (act === "sell") { sellStock(id, qtyFor(id)); return; }
    if (act === "buy-powerup") { buyPowerup(id); return; }
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("stock-card")) {
      state.selectedStockId = e.target.dataset.id;
      emit();
    }
  });

  return wrap;
}

export default {
  startLoop, catchup, forceTick, forecast, applyTicks,
  buyStock, sellStock, buyPowerup, isUnlocked, lockedPreview,
  maxHolding, heldQty, avgCost, changePct, openChartModal, renderMarket,
};
