// ---------------------------------------------------------------------------
// DevWars: Market & Military - item definitions (54 items) + effect logic
//
// Types: booster (12), consumable (12), collectible (12), rare (10),
// currency (8).
//
// Each item: { id, name, type, rarity, cost, description, usable, effect }
//   effect: function (profile, market, ctx) -> { profile, market, toast } | null
//   ctx provides helpers: { now, selectedStockId, addItems, forceTick }
//
// Collectibles and most rares are passive: their bonuses are derived from
// owned quantities by getPassives() below (no effect function needed).
// ---------------------------------------------------------------------------

const MIN = 60 * 1000;

// -- small helper used by timed effects --------------------------------------
function boost(profile, id, ms, now) {
  if (!profile.boosts) profile.boosts = {};
  profile.boosts[id] = { expiresAt: now + ms };
}

// -- reveal future ticks of one stock ----------------------------------------
function reveal(profile, market, ctx, ticks, label) {
  const list = Object.values(market.stocks || {}).filter((s) => s.isActive);
  if (!list.length) return null;
  let target = ctx.selectedStockId && market.stocks[ctx.selectedStockId];
  if (!target || !target.isActive) target = list[0];
  if (!profile.reveals) profile.reveals = {};
  profile.reveals[target.id] = { ticks, expiresAt: ctx.now + 10 * MIN };
  return { profile, market, toast: label + " " + target.symbol + ": next " + ticks + " ticks revealed" };
}

export const ITEMS = [
  // =========================================================================
  // BOOSTERS (12) - temporary bonuses, triggered with [USE]
  // =========================================================================
  {
    id: "lucky_penny", name: "Lucky Penny", type: "booster", rarity: "COMMON", cost: 120,
    description: "+5% sell profit for 5 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "lucky_penny", 5 * MIN, ctx.now);
      return { profile, market, toast: "Lucky Penny active: +5% sell profit for 5 min" };
    },
  },
  {
    id: "market_whisper", name: "Market Whisper", type: "booster", rarity: "COMMON", cost: 200,
    description: "Reveals the next 2 ticks of one stock.", usable: true,
    effect(profile, market, ctx) { return reveal(profile, market, ctx, 2, "Market Whisper on"); },
  },
  {
    id: "coffee_shot", name: "Coffee Shot", type: "booster", rarity: "COMMON", cost: 150,
    description: "+10% bot income for 10 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "coffee_shot", 10 * MIN, ctx.now);
      return { profile, market, toast: "Coffee Shot: +10% bot income for 10 min" };
    },
  },
  {
    id: "spreadsheet_pro", name: "Spreadsheet Pro", type: "booster", rarity: "COMMON", cost: 180,
    description: "-10% recruit cost for 5 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "spreadsheet_pro", 5 * MIN, ctx.now);
      return { profile, market, toast: "Spreadsheet Pro: -10% recruit cost for 5 min" };
    },
  },
  {
    id: "hot_tip", name: "Hot Tip", type: "booster", rarity: "COMMON", cost: 260,
    description: "Insider intel: reveals the next 3 ticks of one stock.", usable: true,
    effect(profile, market, ctx) { return reveal(profile, market, ctx, 3, "Hot Tip on"); },
  },
  {
    id: "bug_bounty", name: "Bug Bounty", type: "booster", rarity: "COMMON", cost: 400,
    description: "Instantly pays out 500 DevCoins when used.", usable: true,
    effect(profile, market, ctx) {
      profile.devCoins += 500;
      return { profile, market, toast: "Bug Bounty claimed: +500 DevCoins" };
    },
  },
  {
    id: "coffee_beans", name: "Coffee Beans x5", type: "booster", rarity: "COMMON", cost: 420,
    description: "Sell the stash: instantly grants 500 DevCoins when used.", usable: true,
    effect(profile, market, ctx) {
      profile.devCoins += 500;
      return { profile, market, toast: "Coffee stash sold: +500 DevCoins" };
    },
  },
  {
    id: "refactor_elixir", name: "Refactor Elixir", type: "booster", rarity: "COMMON", cost: 240,
    description: "-20% army upkeep for 10 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "refactor_elixir", 10 * MIN, ctx.now);
      return { profile, market, toast: "Refactor Elixir: -20% upkeep for 10 min" };
    },
  },
  {
    id: "legacy_crate", name: "Legacy Crate", type: "booster", rarity: "RARE", cost: 600,
    description: "Crack it open: contains 3 random items.", usable: true,
    effect(profile, market, ctx) {
      const gained = ctx.addItems(3, ["legacy_crate"]);
      return { profile, market, toast: "Legacy Crate opened: got " + (gained.join(", ") || "nothing") };
    },
  },
  {
    id: "gpu_rental", name: "GPU Rental", type: "booster", rarity: "COMMON", cost: 380,
    description: "+25% bot income for 15 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "gpu_rental", 15 * MIN, ctx.now);
      return { profile, market, toast: "GPU Rental: +25% bot income for 15 min" };
    },
  },
  {
    id: "beta_key", name: "Beta Key", type: "booster", rarity: "COMMON", cost: 300,
    description: "+15% sell profit for 10 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "beta_key", 10 * MIN, ctx.now);
      return { profile, market, toast: "Beta Key: +15% sell profit for 10 min" };
    },
  },
  {
    id: "server_uptime", name: "Server Uptime", type: "booster", rarity: "RARE", cost: 450,
    description: "-50% army upkeep for 10 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "server_uptime", 10 * MIN, ctx.now);
      return { profile, market, toast: "Server Uptime: -50% upkeep for 10 min" };
    },
  },

  // =========================================================================
  // CONSUMABLES (12) - one-shot effects, triggered with [USE]
  // =========================================================================
  {
    id: "instant_dividend", name: "Instant Dividend", type: "consumable", rarity: "COMMON", cost: 800,
    description: "A fat envelope: instantly grants 1000 DevCoins.", usable: true,
    effect(profile, market, ctx) {
      profile.devCoins += 1000;
      return { profile, market, toast: "Instant Dividend: +1000 DevCoins" };
    },
  },
  {
    id: "stock_tip", name: "Stock Tip", type: "consumable", rarity: "COMMON", cost: 350,
    description: "Reveals the next 4 ticks of one stock.", usable: true,
    effect(profile, market, ctx) { return reveal(profile, market, ctx, 4, "Stock Tip on"); },
  },
  {
    id: "hire_voucher", name: "Hire Voucher", type: "consumable", rarity: "COMMON", cost: 45,
    description: "Free recruit of one Junior Dev.", usable: true,
    effect(profile, market, ctx) {
      profile.army.juniors += 1;
      return { profile, market, toast: "Hire Voucher redeemed: +1 Junior Dev" };
    },
  },
  {
    id: "power_surge", name: "Power Surge", type: "consumable", rarity: "RARE", cost: 500,
    description: "+20% to all ATK for 5 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "power_surge", 5 * MIN, ctx.now);
      return { profile, market, toast: "Power Surge: +20% ATK for 5 min" };
    },
  },
  {
    id: "firewall_token", name: "Firewall Token", type: "consumable", rarity: "RARE", cost: 500,
    description: "+25% DEF for 10 minutes.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "firewall_token", 10 * MIN, ctx.now);
      return { profile, market, toast: "Firewall Token: +25% DEF for 10 min" };
    },
  },
  {
    id: "hacker_toolkit", name: "Hacker Toolkit", type: "consumable", rarity: "RARE", cost: 400,
    description: "One time: your next recruit order costs 50% less.", usable: true,
    effect(profile, market, ctx) {
      if (!profile.flags) profile.flags = {};
      profile.flags.nextRecruitHalfPrice = true;
      return { profile, market, toast: "Hacker Toolkit armed: next recruit order -50%" };
    },
  },
  {
    id: "dividend_check", name: "Dividend Check", type: "consumable", rarity: "COMMON", cost: 420,
    description: "Cash it in: instantly grants 500 DevCoins.", usable: true,
    effect(profile, market, ctx) {
      profile.devCoins += 500;
      return { profile, market, toast: "Dividend Check cashed: +500 DevCoins" };
    },
  },
  {
    id: "energy_drink", name: "Energy Drink", type: "consumable", rarity: "COMMON", cost: 90,
    description: "Jitters the market: forces +1 tick instantly.", usable: true,
    effect(profile, market, ctx) {
      ctx.forceTick();
      return { profile, market, toast: "Energy Drink: market tick forced" };
    },
  },
  {
    id: "whale_friend", name: "Whale Friend", type: "consumable", rarity: "RARE", cost: 700,
    description: "One time: your next sell gets +25% profit.", usable: true,
    effect(profile, market, ctx) {
      if (!profile.flags) profile.flags = {};
      profile.flags.nextSellBonus = 0.25;
      return { profile, market, toast: "Whale Friend ready: next sell +25% profit" };
    },
  },
  {
    id: "audit_pass", name: "Audit Pass", type: "consumable", rarity: "RARE", cost: 650,
    description: "Prevents your next bankruptcy (keeps your cheapest unit).", usable: true,
    effect(profile, market, ctx) {
      if (!profile.flags) profile.flags = {};
      profile.flags.auditShield = true;
      return { profile, market, toast: "Audit Pass armed: next bankruptcy prevented" };
    },
  },
  {
    id: "code_review", name: "Code Review", type: "consumable", rarity: "RARE", cost: 550,
    description: "For 10 minutes, every Senior Dev recruit ships +50% extra effectiveness.", usable: true,
    effect(profile, market, ctx) {
      boost(profile, "code_review", 10 * MIN, ctx.now);
      return { profile, market, toast: "Code Review: +50% senior recruit effectiveness for 10 min" };
    },
  },
  {
    id: "patch_notes", name: "Patch Notes", type: "consumable", rarity: "RARE", cost: 800,
    description: "Reveals the next 10 ticks of one stock.", usable: true,
    effect(profile, market, ctx) { return reveal(profile, market, ctx, 10, "Patch Notes on"); },
  },

  // =========================================================================
  // COLLECTIBLES (12) - permanent passive bonuses while owned
  // =========================================================================
  {
    id: "vintage_386", name: "Vintage 386", type: "collectible", rarity: "COMMON", cost: 300,
    description: "A museum piece that still mines. +1 income/min.", usable: false, effect: null,
  },
  {
    id: "y2k_trophy", name: "Y2K Bug Trophy", type: "collectible", rarity: "COMMON", cost: 260,
    description: "A relic of the great panic. +2 ATK.", usable: false, effect: null,
  },
  {
    id: "oss_medal", name: "Open Source Medal", type: "collectible", rarity: "COMMON", cost: 400,
    description: "Community goodwill cuts costs. -5% upkeep.", usable: false, effect: null,
  },
  {
    id: "bug_stash", name: "Bug Stash", type: "collectible", rarity: "COMMON", cost: 500,
    description: "Jar of rare bugs. +50 max holding per stock.", usable: false, effect: null,
  },
  {
    id: "rack_collectible", name: "Server Rack", type: "collectible", rarity: "RARE", cost: 1200,
    description: "Floor-to-ceiling storage. +100 max holding per stock.", usable: false, effect: null,
  },
  {
    id: "crypto_wallet_item", name: "Crypto Wallet", type: "collectible", rarity: "COMMON", cost: 700,
    description: "Cold storage, warm profits. +5% sell profit, permanent.", usable: false, effect: null,
  },
  {
    id: "quantum_chip", name: "Quantum Chip", type: "collectible", rarity: "RARE", cost: 2000,
    description: "Superposition of profit. +10 income/min.", usable: false, effect: null,
  },
  {
    id: "coffee_mug", name: "Coffee Mug", type: "collectible", rarity: "COMMON", cost: 220,
    description: "The fuel of empires. +5% total income.", usable: false, effect: null,
  },
  {
    id: "old_mouse", name: "Old Mouse", type: "collectible", rarity: "COMMON", cost: 120,
    description: "It has seen things. +1 ATK.", usable: false, effect: null,
  },
  {
    id: "mech_keyboard", name: "Mechanical Keyboard", type: "collectible", rarity: "COMMON", cost: 350,
    description: "Clicky intimidation. +2 ATK.", usable: false, effect: null,
  },
  {
    id: "crt_monitor", name: "CRT Monitor", type: "collectible", rarity: "COMMON", cost: 380,
    description: "Radiates pure defense. +5 DEF.", usable: false, effect: null,
  },
  {
    id: "hacker_hoodie", name: "Hacker Hoodie", type: "collectible", rarity: "RARE", cost: 900,
    description: "Anonymous and profitable. +10% income from bots.", usable: false, effect: null,
  },

  // =========================================================================
  // RARE (10) - expensive, powerful
  // =========================================================================
  {
    id: "ai_copilot", name: "AI Copilot", type: "rare", rarity: "LEGENDARY", cost: 5000,
    description: "Autocomplete for your bank account. +50% bot income, permanent.", usable: false, effect: null,
  },
  {
    id: "zero_day", name: "Zero-Day Exploit", type: "rare", rarity: "LEGENDARY", cost: 6000,
    description: "[LOCKED] Future PvP: one-time -50% enemy DEF. Reserved for the arena.", usable: false, effect: null,
  },
  {
    id: "stock_oracle", name: "Stock Oracle", type: "rare", rarity: "LEGENDARY", cost: 7500,
    description: "You always see the next tick of every stock chart.", usable: false, effect: null,
  },
  {
    id: "server_farm", name: "Server Farm", type: "rare", rarity: "LEGENDARY", cost: 9000,
    description: "Rows of humming profit. +100 income/min.", usable: false, effect: null,
  },
  {
    id: "quantum_server", name: "Quantum Server", type: "rare", rarity: "LEGENDARY", cost: 25000,
    description: "Entangled with the money printer. +500 income/min.", usable: false, effect: null,
  },
  {
    id: "beta_pin", name: "DevWars Beta Pin", type: "rare", rarity: "LEGENDARY", cost: 4000,
    description: "Cosmetic flex. +5% all income, permanent.", usable: false, effect: null,
  },
  {
    id: "hackerman_badge", name: "Hackerman Badge", type: "rare", rarity: "LEGENDARY", cost: 8000,
    description: "I am in. +20% all sell profit, permanent.", usable: false, effect: null,
  },
  {
    id: "quantum_wallet", name: "Quantum Wallet", type: "rare", rarity: "LEGENDARY", cost: 6500,
    description: "Holds coins in every timeline. +10% sell profit, permanent.", usable: false, effect: null,
  },
  {
    id: "neural_net", name: "Neural Net", type: "rare", rarity: "LEGENDARY", cost: 12000,
    description: "It dreams of coins. +100% bot income, permanent.", usable: false, effect: null,
  },
  {
    id: "mainframe_core", name: "Mainframe Core", type: "rare", rarity: "LEGENDARY", cost: 50000,
    description: "The heart of the machine. +1000 income/min.", usable: false, effect: null,
  },

  // =========================================================================
  // CURRENCIES (8) - trade-only chips, buy/sell at face value
  // =========================================================================
  {
    id: "blue_chip", name: "Blue Chip", type: "currency", rarity: "COMMON", cost: 10,
    description: "Trade chip, face value 10. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "red_chip", name: "Red Chip", type: "currency", rarity: "COMMON", cost: 25,
    description: "Trade chip, face value 25. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "green_chip", name: "Green Chip", type: "currency", rarity: "COMMON", cost: 50,
    description: "Trade chip, face value 50. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "silver_coin", name: "Silver Coin", type: "currency", rarity: "COMMON", cost: 150,
    description: "Trade coin, face value 150. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "black_chip", name: "Black Chip", type: "currency", rarity: "COMMON", cost: 100,
    description: "Trade chip, face value 100. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "gold_bar", name: "Gold Bar", type: "currency", rarity: "RARE", cost: 500,
    description: "Trade bar, face value 500. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "platinum_bar", name: "Platinum Bar", type: "currency", rarity: "RARE", cost: 1000,
    description: "Trade bar, face value 1000. Used for player trading later.", usable: false, effect: null,
  },
  {
    id: "quantum_token", name: "Quantum Token", type: "currency", rarity: "LEGENDARY", cost: 2500,
    description: "Trade token, face value 2500. Used for player trading later.", usable: false, effect: null,
  },
];

// ---------------------------------------------------------------------------
// Passive bonuses derived from owned collectibles / rares.
// Returns an aggregate object used by market.js and army.js.
// ---------------------------------------------------------------------------
export function getPassives(itemsOwned) {
  const q = (id) => (itemsOwned && itemsOwned[id]) || 0;
  return {
    incomeFlat: q("vintage_386") * 1 + q("quantum_chip") * 10 + q("server_farm") * 100 + q("quantum_server") * 500 + q("mainframe_core") * 1000,
    atkFlat: q("y2k_trophy") * 2 + q("old_mouse") * 1 + q("mech_keyboard") * 2,
    defFlat: q("crt_monitor") * 5,
    upkeepMult: Math.pow(0.95, q("oss_medal")),
    holdingAdd: q("bug_stash") * 50 + q("rack_collectible") * 100,
    sellProfitBonus: q("crypto_wallet_item") * 0.05 + q("quantum_wallet") * 0.10 + q("hackerman_badge") * 0.20,
    botIncomeBonus: q("hacker_hoodie") * 0.10 + q("ai_copilot") * 0.50 + q("neural_net") * 1.0,
    incomeAllMult: 1 + q("coffee_mug") * 0.05 + q("beta_pin") * 0.05,
    oracle: q("stock_oracle") > 0,
    zeroDayCharges: q("zero_day"),
  };
}

export function itemById(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

export default ITEMS;
