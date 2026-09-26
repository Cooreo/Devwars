// ---------------------------------------------------------------------------
// DevWars: Market & Military - army screen + upkeep/income cycles
// Recruitment only (no battles yet). PvP-ready: exposes computePower().
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { UNITS, unitById } from "./units-data.js";
import { state, emit, persist } from "./state.js";
import { fmtMoney, fmtNum, esc } from "./util.js";
import { icon, toast, confirmModal } from "./ui.js";
import { getPassives, getActiveBoostMods } from "./items.js";

const ARMY_KEY = { junior: "juniors", senior: "seniors", devops: "devops", bot: "bots" };

export function unitCount(profile, unitId) {
  return (profile.army && profile.army[ARMY_KEY[unitId]]) || 0;
}

function totalUnits(profile) {
  const a = profile.army || {};
  return (a.juniors || 0) + (a.seniors || 0) + (a.devops || 0) + (a.bots || 0);
}

// ---------------------------------------------------------------------------
// TOTALS (with boosts + collectible passives applied)
// ---------------------------------------------------------------------------
export function getArmyTotals(profile) {
  const p = profile || state.profile;
  if (!p) return { atk: 0, def: 0, upkeep: 0, income: 0, net: 0, units: 0 };
  const mods = getActiveBoostMods(p);
  const pas = getPassives(p.items);

  let atk = 0;
  let def = 0;
  let upkeep = 0;
  let botIncome = 0;
  for (const u of UNITS) {
    const n = unitCount(p, u.id);
    atk += n * u.atk;
    def += n * u.def;
    upkeep += n * u.upkeep;
    botIncome += n * u.income;
  }

  atk = (atk + pas.atkFlat) * mods.atkMult;
  def = (def + pas.defFlat) * mods.defMult;
  upkeep = upkeep * mods.upkeepMult * pas.upkeepMult;
  botIncome = botIncome * (1 + mods.botIncomeBonus + pas.botIncomeBonus);
  const income = (botIncome + pas.incomeFlat) * pas.incomeAllMult;

  return {
    atk: Math.round(atk * 10) / 10,
    def: Math.round(def * 10) / 10,
    upkeep: Math.round(upkeep * 100) / 100,
    income: Math.round(income * 100) / 100,
    net: Math.round((income - upkeep) * 100) / 100,
    units: totalUnits(p),
  };
}

// ---------------------------------------------------------------------------
// RECRUITMENT / DISBAND
// ---------------------------------------------------------------------------
export function recruitCost(unitId, qty) {
  const unit = unitById(unitId);
  const p = state.profile;
  if (!unit || !p) return 0;
  const mods = getActiveBoostMods(p);
  let cost = unit.cost * qty;
  if (qty >= CONFIG.RECRUIT_BULK) cost *= 1 - CONFIG.RECRUIT_BULK_DISCOUNT;
  cost *= 1 - mods.recruitDiscount;
  if (p.flags && p.flags.nextRecruitHalfPrice) cost *= 0.5;
  return Math.ceil(cost);
}

export function recruitUnit(unitId, qty) {
  const unit = unitById(unitId);
  const p = state.profile;
  if (!unit || !p) return;
  const n = Math.max(1, Math.floor(qty));
  const cost = recruitCost(unitId, n);
  if (p.devCoins < cost) { toast("err", "Insufficient funds. Need " + fmtMoney(cost) + "."); return; }

  let granted = n;
  const mods = getActiveBoostMods(p);
  if (unitId === "senior" && mods.seniorBonus) {
    granted = Math.floor(n * (1 + mods.seniorBonus));
  }

  p.devCoins -= cost;
  if (p.flags && p.flags.nextRecruitHalfPrice) delete p.flags.nextRecruitHalfPrice;
  p.army[ARMY_KEY[unitId]] = (p.army[ARMY_KEY[unitId]] || 0) + granted;

  if (!state.armyCycles.lastCollectedAt) state.armyCycles.lastCollectedAt = Date.now();
  state.selectedUnitId = unitId;
  persist();
  emit();
  const extra = granted > n ? " (+" + (granted - n) + " bonus from Code Review)" : "";
  toast("ok", "Recruited " + granted + "x " + unit.name + " for " + fmtMoney(cost) + "." + extra);
}

export function disbandUnit(unitId, qty) {
  const unit = unitById(unitId);
  const p = state.profile;
  if (!unit || !p) return;
  const have = unitCount(p, unitId);
  if (have < 1) { toast("err", "No " + unit.name + " to disband."); return; }
  const n = Math.min(have, Math.max(1, Math.floor(qty || 1)));
  const refund = Math.floor(unit.cost * n * CONFIG.ITEM_SELL_REFUND);
  p.army[ARMY_KEY[unitId]] = have - n;
  p.devCoins += refund;
  persist();
  emit();
  toast("warn", "Disbanded " + n + "x " + unit.name + ". Refund " + fmtMoney(refund) + ".");
}

// ---------------------------------------------------------------------------
// UPKEEP / INCOME CYCLE (every 60s)
// ---------------------------------------------------------------------------
const CHEAPEST_FIRST = ["junior", "devops", "senior", "bot"];

export function collectArmyCycle() {
  const p = state.profile;
  if (!p) return;
  if (!state.armyCycles.lastCollectedAt) {
    state.armyCycles.lastCollectedAt = Date.now();
    return;
  }
  const elapsed = Date.now() - state.armyCycles.lastCollectedAt;
  let cycles = Math.floor(elapsed / CONFIG.ARMY_CYCLE_MS);
  if (cycles < 1) return;
  if (cycles > CONFIG.MAX_CATCHUP_CYCLES) cycles = CONFIG.MAX_CATCHUP_CYCLES;

  let changed = false;
  for (let i = 0; i < cycles; i += 1) {
    const totals = getArmyTotals(p);
    if (totals.units === 0) {
      // nothing to collect: skip the clock forward
      state.armyCycles.lastCollectedAt = Date.now();
      break;
    }
    const net = totals.income - totals.upkeep;

    if (net < 0 && p.devCoins < -net) {
      // cannot pay upkeep
      if (p.flags && p.flags.auditShield) {
        delete p.flags.auditShield;
        p.devCoins += totals.income; // keep income, waive the shortfall
        toast("warn", "Audit Pass consumed: bankruptcy prevented.");
      } else {
        // disband the cheapest unit type we still have
        let disbanded = null;
        for (const uid of CHEAPEST_FIRST) {
          if (unitCount(p, uid) > 0) { disbanded = uid; break; }
        }
        if (disbanded) {
          p.army[ARMY_KEY[disbanded]] -= 1;
          p.devCoins += totals.income;
          toast("warn", "[!] Bankruptcy: 1 " + unitById(disbanded).name + " disbanded.");
        } else {
          break;
        }
      }
    } else {
      p.devCoins = Math.max(0, p.devCoins + net);
    }
    state.armyCycles.lastCollectedAt += CONFIG.ARMY_CYCLE_MS;
    changed = true;
  }

  if (changed) {
    persist();
    emit();
  }
}

// ---------------------------------------------------------------------------
// PVP-READY POWER API
// ---------------------------------------------------------------------------
export function computePower() {
  const totals = getArmyTotals(state.profile);
  return {
    atk: totals.atk,
    def: totals.def,
    units: Object.assign({}, state.profile ? state.profile.army : {}),
  };
}

// ---------------------------------------------------------------------------
// ARMY SCREEN RENDER
// ---------------------------------------------------------------------------
function unitCardHTML(unit, selected) {
  const p = state.profile;
  const count = unitCount(p, unit.id);
  const cost10 = recruitCost(unit.id, CONFIG.RECRUIT_BULK);
  const cost1 = recruitCost(unit.id, 1);
  return (
    '<article class="card unit-card' + (selected ? " selected" : "") + '" data-id="' + unit.id + '" data-act="select-unit" tabindex="0">' +
    '<div class="unit-head"><span class="unit-icon">' + icon(unit.icon, 22) + "</span>" +
    '<div class="unit-id"><span class="uname">' + esc(unit.name) + "</span>" +
    '<span class="ucost">' + fmtMoney(unit.cost) + "</span></div>" +
    '<span class="ucount">x' + count + "</span></div>" +
    '<div class="unit-stats">' +
    '<span class="ustat">[ATK] ' + unit.atk + "</span>" +
    '<span class="ustat">[DEF] ' + unit.def + "</span>" +
    '<span class="ustat">[UPK] ' + unit.upkeep + "/min</span>" +
    (unit.income > 0 ? '<span class="ustat ustat-inc">[INC] ' + unit.income + "/min</span>" : "") +
    "</div>" +
    '<p class="udesc">' + esc(unit.description) + "</p>" +
    '<div class="unit-actions">' +
    '<button type="button" class="btn btn-buy" data-act="recruit1" data-id="' + unit.id + '">[RECRUIT +1] ' + fmtMoney(cost1) + "</button>" +
    '<button type="button" class="btn btn-buy" data-act="recruit10" data-id="' + unit.id + '">[RECRUIT x10] ' + fmtMoney(cost10) + "</button>" +
    '<button type="button" class="btn btn-sell" data-act="disband" data-id="' + unit.id + '"' + (count < 1 ? " disabled" : "") + ">[DISBAND]</button>" +
    "</div></article>"
  );
}

function detailUnitHTML(unit) {
  const p = state.profile;
  if (!unit) return '<div class="detail-empty">' + icon("shield", 28) + "<p>Select a unit.</p></div>";
  const count = unitCount(p, unit.id);
  const totals = getArmyTotals(p);
  return (
    '<div class="detail-inner">' +
    '<div class="detail-head"><span class="unit-icon big">' + icon(unit.icon, 40) + "</span></div>" +
    '<div class="detail-price"><span class="sym">' + esc(unit.name.toUpperCase()) + "</span></div>" +
    '<dl class="detail-stats">' +
    "<dt>OWNED</dt><dd>" + count + "</dd>" +
    "<dt>ATK EACH</dt><dd>" + unit.atk + "</dd>" +
    "<dt>DEF EACH</dt><dd>" + unit.def + "</dd>" +
    "<dt>UPKEEP</dt><dd>" + unit.upkeep + "/min</dd>" +
    "<dt>INCOME</dt><dd>" + unit.income + "/min</dd>" +
    "<dt>TOTAL COST</dt><dd>" + fmtMoney(unit.cost * count) + "</dd>" +
    "</dl>" +
    '<p class="udesc">' + esc(unit.description) + "</p>" +
    '<div class="detail-note">ARMY NET ' + (totals.net >= 0 ? '<span class="up">+' : '<span class="down">') + fmtMoney(totals.net) + "/min</span></div>" +
    "</div>"
  );
}

export function renderArmy() {
  const p = state.profile;
  const totals = getArmyTotals(p);
  const wrap = document.createElement("div");
  wrap.className = "screen army-screen";

  let html = '<section class="totals-bar" aria-label="Army totals">';
  html += '<div class="total-chip"><span class="tk">[ATK]</span><span class="tv">' + fmtNum(totals.atk) + "</span></div>";
  html += '<div class="total-chip"><span class="tk">[DEF]</span><span class="tv">' + fmtNum(totals.def) + "</span></div>";
  html += '<div class="total-chip"><span class="tk">UPKEEP/min</span><span class="tv down">' + fmtMoney(totals.upkeep) + "</span></div>";
  html += '<div class="total-chip"><span class="tk">INCOME/min</span><span class="tv up">' + fmtMoney(totals.income) + "</span></div>";
  html += '<div class="total-chip total-net"><span class="tk">NET</span><span class="tv ' + (totals.net >= 0 ? "up" : "down") + '">' + fmtMoney(totals.net) + "</span></div>";
  html += "</section>";

  html += '<section class="section-block two-col">';
  html += '<div class="unit-list">';
  for (const u of UNITS) html += unitCardHTML(u, state.selectedUnitId === u.id);
  html += "</div>";
  html += '<aside class="detail-panel">' + detailUnitHTML(unitById(state.selectedUnitId) || UNITS[0]) + "</aside>";
  html += "</section>";

  html += '<section class="section-block"><div class="card pvp-teaser">' + icon("sword", 18) +
    '<div><strong>PVP ARENA</strong><p>[LOCKED] PVP arena disabled in this build. Your army stats are saved and ready.</p></div>' +
    "</div></section>";

  wrap.innerHTML = html;

  wrap.addEventListener("click", (e) => {
    const actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    const act = actEl.dataset.act;
    const id = actEl.dataset.id;
    if (act === "select-unit") { state.selectedUnitId = actEl.dataset.id; emit(); return; }
    if (act === "recruit1") { recruitUnit(id, 1); return; }
    if (act === "recruit10") { recruitUnit(id, CONFIG.RECRUIT_BULK); return; }
    if (act === "disband") {
      const unit = unitById(id);
      const count = unitCount(state.profile, id);
      confirmModal("[!] Disband 1 " + unit.name + "? You get a 50% refund.", (yes) => {
        if (yes) disbandUnit(id, 1);
      });
      return;
    }
  });

  return wrap;
}

export default {
  getArmyTotals, recruitUnit, disbandUnit, recruitCost, collectArmyCycle,
  computePower, unitCount, renderArmy,
};
