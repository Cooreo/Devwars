// ---------------------------------------------------------------------------
// DevWars: Market & Military - global configuration constants
// Pure ES module. No DOM access. Safe to import everywhere.
// ---------------------------------------------------------------------------

export const CONFIG = {
  APP_NAME: "DevWars",
  APP_SUBTITLE: "Market & Military",
  VERSION: "1.0.0",

  // localStorage namespaces -------------------------------------------------
  STORAGE_KEY: "devwars.v1",            // single namespace for player state
  SESSION_KEY: "devwars.session",       // auth record (operatorId/salt/hash)
  MARKET_CUSTOM_KEY: "devwars.market.custom", // admin-added / edited stocks
  ITEMS_CUSTOM_KEY: "devwars.items.custom",   // admin-added / edited items

  // service worker -----------------------------------------------------------
  SW_CACHE: "devwars-v2",

  // market simulation ----------------------------------------------------------
  TICK_MS: 3000,          // one market tick every 3 seconds
  HISTORY_LEN: 30,        // keep last 30 price points per stock
  MAX_CATCHUP_TICKS: 600, // cap fast-forward after being away

  // army ----------------------------------------------------------------------
  ARMY_CYCLE_MS: 60000,   // upkeep/income cycle every 60 seconds
  MAX_CATCHUP_CYCLES: 240,

  // economy -------------------------------------------------------------------
  STARTING_COINS: 1000,
  HOLDING_CAP_BASE: 50,
  HOLDING_CAP_RACK: 100,  // with the "Server Rack" market power-up
  ITEM_SELL_REFUND: 0.5,  // selling items refunds 50%
  RECRUIT_BULK: 10,       // recruit x10
  RECRUIT_BULK_DISCOUNT: 0.10,

  // power-ups sold in the market section --------------------------------------
  POWERUPS: {
    serverRack: { id: "serverRack", name: "Server Rack", cost: 1500, description: "Raises the per-stock holding cap from 50 to 100." },
    insiderBot: { id: "insiderBot", name: "Insider Bot", cost: 800, description: "Shows trend arrows on every stock card." },
  },

  // auth -----------------------------------------------------------------------
  PBKDF2_ITERATIONS: 100000,
  OPERATOR_RE: /^[a-z0-9_]{3,16}$/,
  MIN_PASSWORD_LEN: 6,
  ADMIN_OPERATOR: "admin",

  // unlock tiers (by totalEarned) ----------------------------------------------
  UNLOCK_TIERS: [0, 100, 500, 1500, 3000, 6000, 12000, 25000, 50000, 100000],

  // misc ------------------------------------------------------------------------
  LOCKED_PREVIEW_COUNT: 3,
  BOOST_TICK_MS: 1000,
};

export default CONFIG;
