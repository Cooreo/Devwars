# Disclamer: i vibecoded this sh%t out of this :3
# DevWars: Market & Military

An offline, browser-only stock-trading + army-building game.
Built with **vanilla HTML5, CSS3 and JavaScript ES modules only** -- no frameworks, no bundlers, no npm, no backend, no SQL. Everything runs from static files served straight from the GitHub Pages root.

## Play

Live on GitHub Pages: **https://cooreo.github.io/Devwars/**

Or run locally:

```sh
python3 -m http.server 8080
# then visit http://localhost:8080
```

A normal web server is recommended (the Web Crypto API used for login needs a secure context: `https://` or `localhost`).

## The game

- **MARKET** -- 52 seeded stocks across 10 categories (basic, language, hardware, ai, security, web, crypto, legacy, exotic, quantum). Prices tick every 3 seconds via a deterministic seeded PRNG, so every open tab agrees on the same price per tick. Buy low, sell high; profitable sells raise your `totalEarned`, which unlocks higher-tier stocks.
- **POWER-UPS** -- `Server Rack` (holding cap 50 -> 100) and `Insider Bot` (trend arrows on cards).
- **ARMY** -- recruit Junior Devs, Senior Devs, DevOps Engineers and Build Bots. Every 60s a cycle collects income and charges upkeep. Go broke and your cheapest unit deserts. PvP-ready: `window.DevWars.army.computePower()` is already exposed; the PVP tab is `[LOCKED]` in this build.
- **ITEMS** -- a 54-item shop: 12 boosters, 12 consumables, 12 collectibles, 10 rares, 8 trade currencies. Timed boosts show live countdowns in the ACTIVE EFFECTS panel. Reveal items (Market Whisper, Stock Tip, Patch Notes, Hot Tip) actually compute the deterministic future ticks and draw them on the chart as `[INTEL]`.
- **ADMIN** -- register with operator id `admin` to unlock the admin panel (gear icon -> `[ADMIN]`): edit stock price/volatility/bias/activity, force manual ticks, add new stocks, edit item costs, add items, grant coins, reset or wipe everything. Admin edits persist in separate `devwars.market.custom` / `devwars.items.custom` slices.

## Controls

| Input | Action |
| --- | --- |
| Bottom nav / keys `1` `2` `3` | Switch MARKET / ARMY / ITEMS tabs |
| Click a sparkline | Large chart modal (grid, min/max labels, last-price line). ESC / backdrop / `[X]` closes |
| `[-]` `[+]` stepper | Trade quantity |
| Gear icon | Settings: scanline toggle, export/import profile JSON, reset, logout |

## Auth

One operator per device. Operator ID is 3-16 chars of `[a-z0-9_]`, password at least 6 chars. The password is hashed with **PBKDF2-SHA256, 100k iterations, 256 bits** (Web Crypto) using a `crypto.randomUUID()` salt and stored in `localStorage["devwars.session"]`. No server, no recovery -- this is a demo.

## Responsive layouts

A single centered `#shell` adapts by viewport width (set via `body[data-layout]` in `js/app.js`):

- **phone** (<= 600px): full-width, `100dvh`, single column, fixed bottom nav, safe-area insets, 44px touch targets.
- **tablet** (601-1024px): 720px shell, two-column MARKET/ARMY (scrollable list + sticky detail panel), 2-column item grid; nav labels sit next to icons above 700px viewport height.
- **desktop** (>= 1025px): the shell becomes a 420px phone frame over a dim terminal-grid "control room", 3-column item grid.

## Technical notes

- All persistent player state lives under the single namespace `localStorage["devwars.v1"]`; cross-tab sync rides the `storage` event.
- Market determinism: `mulberry32` seeded by `Math.floor(Date.now()/3000)` combined with a FNV-1a hash of the stock id -- each tab simulates the identical tick.
- Charts are hand-drawn on `<canvas>` (sparklines + full charts with grid, min/max labels, last-price line and dashed forecast overlay). No chart libraries.
- No emoji anywhere -- ASCII labels only: `[OK]` `[ERR]` `[!]` `[ATK]` `[DEF]` `[BUY]` `[SELL]` `[LOCKED]` `[EQUIP]`. Icons are inline stroke-only SVGs.
- A cache-first service worker (`sw.js`, cache name `devwars-v2`) makes the game fully offline after the first visit.

## File map

```
index.html          app shell + auth screen
manifest.json       PWA manifest (inline SVG icons)
sw.js               offline cache (devwars-v2)
css/main.css        shared styles, tokens, components
css/phone.css       phone layout   (body[data-layout="phone"])
css/tablet.css      tablet layout  (body[data-layout="tablet"])
css/desktop.css     desktop layout (body[data-layout="desktop"])
js/config.js        constants
js/stocks-data.js   52 stock seeds
js/units-data.js    4 army units
js/items-data.js    54 items + effect functions + passive bonuses
js/util.js          DOM/format/PRNG/PBKDF2 helpers
js/state.js         state store, persist/hydrate, cross-tab sync
js/chart.js         hand-drawn canvas charts
js/ui.js            SVG icons, toasts, modal, drawer
js/router.js        screen switching
js/profile.js       auth (PBKDF2) + settings drawer
js/market.js        deterministic market engine + market screen
js/army.js          recruitment, upkeep cycles, computePower()
js/items.js         shop, boosts, ACTIVE EFFECTS
js/admin.js         admin panel (market/items/global controls)
js/app.js           bootstrap, timers, shortcuts, SW register
```

## License

See [LICENSE](./LICENSE).
