// ---------------------------------------------------------------------------
// DevWars: Market & Military - shared utilities
// Pure helpers: DOM shortcuts, formatting, PRNG, hashing, misc.
// ---------------------------------------------------------------------------

// -- DOM ---------------------------------------------------------------------
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -- math --------------------------------------------------------------------
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Deterministic seedable PRNG (mulberry32). Same seed => same sequence,
// which is what keeps every open tab simulating identical market ticks.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a string hash, stable across tabs / sessions.
export function hashStr(s) {
  let out = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i += 1) {
    out ^= str.charCodeAt(i);
    out = Math.imul(out, 16777619);
  }
  return out >>> 0;
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// -- formatting ----------------------------------------------------------------
export function fmtMoney(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-$" : "$") + str;
}

export function fmtNum(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

export function fmtPct(n, signed) {
  const v = Number(n) || 0;
  const s = signed && v > 0 ? "+" : "";
  return s + v.toFixed(2) + "%";
}

export function fmtCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// -- time ------------------------------------------------------------------------
export function nowMs() {
  return Date.now();
}

export function tickIndexAt(ts) {
  // shared 3s slot across all tabs
  return Math.floor((ts || Date.now()) / 3000);
}

// -- crypto (Web Crypto, no server) ----------------------------------------------
function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function pbkdf2Hash(password, saltString) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(String(saltString)),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToHex(bits);
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// -- storage -----------------------------------------------------------------------
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* ignore */
  }
}

// -- files ---------------------------------------------------------------------------
export function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function uid(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
}

export default {
  $, $$, h, esc, clamp, mulberry32, hashStr, randInt,
  fmtMoney, fmtNum, fmtPct, fmtCountdown, nowMs, tickIndexAt,
  pbkdf2Hash, timingSafeEqual, readJSON, writeJSON, removeKey, downloadJSON, uid,
};
