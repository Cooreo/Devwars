// ---------------------------------------------------------------------------
// DevWars: Market & Military - stock seed data (52 stocks)
// Categories: basic, language, hardware, ai, security, web, crypto, legacy,
// exotic, quantum. Prices range from ~$1 to ~$5000.
// unlockRequirement is a totalEarned threshold; null means always unlocked.
// ---------------------------------------------------------------------------

function mk(id, symbol, name, basePrice, volatility, trendBias, category, unlockRequirement) {
  return {
    id,
    symbol,
    name,
    basePrice,
    currentPrice: basePrice,
    volatility,
    trendBias,
    category,
    unlockRequirement,
    history: [basePrice, basePrice, basePrice],
    isActive: true,
    lastTick: 0,
  };
}

export const STOCKS = [
  // --- basic ---------------------------------------------------------------
  mk("basic_001", "HTMLCO", "HTML & Co.", 4.2, 0.020, 0.004, "basic", null),
  mk("basic_002", "CSSL", "CSS Labs", 7.85, 0.022, 0.002, "basic", 0),
  mk("basic_003", "GITX", "GitWorks", 12.4, 0.025, 0.003, "basic", 0),
  mk("basic_004", "DOCK", "DockerDock Inc.", 22.1, 0.028, 0.001, "basic", 100),
  mk("basic_005", "LINT", "Lint Industries", 9.6, 0.024, -0.002, "basic", 100),
  mk("basic_006", "REGX", "Regex Corp.", 5.55, 0.030, 0.000, "basic", 100),

  // --- language ------------------------------------------------------------
  mk("lang_001", "PYTH", "Pythonic Systems", 88.2, 0.030, 0.004, "language", 500),
  mk("lang_002", "JSPT", "JScriptum", 145.0, 0.032, 0.005, "language", 500),
  mk("lang_003", "RBYE", "RubyMine Co.", 31.7, 0.028, -0.003, "language", 500),
  mk("lang_004", "RUST", "RustForge", 96.3, 0.035, 0.006, "language", 1500),
  mk("lang_005", "GOFR", "Go Foundry", 74.9, 0.031, 0.003, "language", 1500),
  mk("lang_006", "HSKL", "Haskellaire", 18.4, 0.026, 0.000, "language", 1500),

  // --- hardware ------------------------------------------------------------
  mk("hard_001", "KEYB", "KeebWorks", 19.9, 0.024, 0.001, "hardware", 500),
  mk("hard_002", "RAMR", "RAM Ranch", 54.3, 0.033, 0.002, "hardware", 1500),
  mk("hard_003", "SSDO", "SSD Dynamics", 47.8, 0.030, 0.001, "hardware", 1500),
  mk("hard_004", "GPUX", "GPU Galactic", 412.0, 0.042, 0.007, "hardware", 3000),
  mk("hard_005", "CPUS", "CPU Syndicate", 260.5, 0.036, 0.004, "hardware", 3000),
  mk("hard_006", "MONI", "Monitora", 89.0, 0.027, -0.001, "hardware", 3000),

  // --- ai ------------------------------------------------------------------
  mk("ai_001", "PROM", "PromptPress", 66.6, 0.040, 0.006, "ai", 3000),
  mk("ai_002", "NEUR", "NeuralNet Inc.", 520.75, 0.045, 0.008, "ai", 6000),
  mk("ai_003", "VISI", "VisionVector", 305.2, 0.041, 0.005, "ai", 6000),
  mk("ai_004", "ROBQ", "RoboQueue", 129.4, 0.038, 0.004, "ai", 6000),
  mk("ai_005", "LLMA", "LlamaLogic", 777.0, 0.048, 0.009, "ai", 12000),
  mk("ai_006", "AGNT", "AgentAxis", 199.9, 0.044, 0.007, "ai", 12000),

  // --- security ------------------------------------------------------------
  mk("sec_001", "BUGZ", "BugZappers", 23.4, 0.029, 0.001, "security", 1500),
  mk("sec_002", "FIRE", "Firewall First", 84.1, 0.032, 0.003, "security", 3000),
  mk("sec_003", "PENT", "Pentest Pros", 152.6, 0.037, 0.004, "security", 6000),
  mk("sec_004", "CRYO", "CryptoGuard", 98.8, 0.035, 0.002, "security", 6000),
  mk("sec_005", "ZDAY", "ZeroDay Zen", 888.0, 0.052, 0.010, "security", 25000),

  // --- web -----------------------------------------------------------------
  mk("web_001", "APIA", "API Alley", 28.9, 0.026, 0.001, "web", 500),
  mk("web_002", "VUEV", "Vue Ventures", 95.5, 0.033, 0.003, "web", 1500),
  mk("web_003", "SVGK", "SvelteKit Corp.", 61.2, 0.031, 0.002, "web", 1500),
  mk("web_004", "CDNQ", "CDN Quantum", 43.6, 0.028, 0.001, "web", 1500),
  mk("web_005", "REAC", "Reactron", 210.3, 0.036, 0.005, "web", 3000),
  mk("web_006", "NODE", "Nodeworks", 132.8, 0.034, 0.003, "web", 3000),

  // --- crypto ---------------------------------------------------------------
  mk("cry_001", "DOGM", "Dogmatic", 1.25, 0.060, 0.000, "crypto", 500),
  mk("cry_002", "STBL", "StableStonks", 1.0, 0.008, 0.000, "crypto", 1500),
  mk("cry_003", "HASH", "HashRate Co.", 77.7, 0.042, 0.004, "crypto", 6000),
  mk("cry_004", "BTCX", "BitCore X", 2450.0, 0.055, 0.008, "crypto", 25000),
  mk("cry_005", "ETHA", "EtherAxis", 1580.0, 0.050, 0.006, "crypto", 25000),

  // --- legacy ---------------------------------------------------------------
  mk("leg_001", "FLAS", "FlashForward", 2.1, 0.045, -0.006, "legacy", 500),
  mk("leg_002", "IE6X", "Legacy Browser Co.", 1.1, 0.040, -0.008, "legacy", 500),
  mk("leg_003", "COBL", "COBOL Classics", 34.5, 0.022, 0.001, "legacy", 1500),
  mk("leg_004", "Y2KK", "Y2K Kontingency", 66.0, 0.034, 0.002, "legacy", 3000),

  // --- exotic ----------------------------------------------------------------
  mk("exo_001", "NFTA", "NFT Asteroid", 12.3, 0.070, 0.000, "exotic", 6000),
  mk("exo_002", "VRSE", "VerseVerse", 340.9, 0.055, 0.006, "exotic", 25000),
  mk("exo_003", "META", "MetaMachine", 450.0, 0.050, 0.005, "exotic", 50000),
  mk("exo_004", "SPCE", "SpaceStack", 980.0, 0.058, 0.007, "exotic", 50000),

  // --- quantum ----------------------------------------------------------------
  mk("qnt_001", "QBUB", "Qubit Brew", 1250.0, 0.060, 0.008, "quantum", 50000),
  mk("qnt_002", "QENT", "QEntangle Inc.", 2200.0, 0.062, 0.009, "quantum", 100000),
  mk("qnt_003", "QFRO", "QFrost", 3400.0, 0.064, 0.010, "quantum", 100000),
  mk("qnt_004", "QSUP", "QSupremacy", 4999.0, 0.066, 0.012, "quantum", 100000),
];

export default STOCKS;
