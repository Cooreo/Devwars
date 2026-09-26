// ---------------------------------------------------------------------------
// DevWars: Market & Military - hand-drawn canvas charts (no libraries)
// ---------------------------------------------------------------------------

function fitCanvas(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function niceLabel(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100) return v.toFixed(1);
  return v.toFixed(2);
}

// Tiny 60x18 sparkline used on stock cards. -----------------------------------
export function drawSparkline(canvas, data, opts) {
  if (!canvas || !Array.isArray(data) || data.length < 2) return;
  const o = opts || {};
  const w = o.width || 60;
  const hgt = o.height || 18;
  const ctx = fitCanvas(canvas, w, hgt);
  ctx.clearRect(0, 0, w, hgt);

  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || max * 0.01 || 1;
  const up = data[data.length - 1] >= data[0];
  ctx.strokeStyle = up ? "#4ade80" : "#f87171";
  ctx.lineWidth = 1.25;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < data.length; i += 1) {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = hgt - 2 - ((data[i] - min) / span) * (hgt - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // last point dot
  const lx = w - 1;
  const ly = hgt - 2 - ((data[data.length - 1] - min) / span) * (hgt - 4);
  ctx.fillStyle = up ? "#4ade80" : "#f87171";
  ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
}

// Full chart for modals / tablet detail panel. --------------------------------
// opts: { forecast: [prices...], title, height }
export function drawChart(canvas, data, opts) {
  if (!canvas || !Array.isArray(data) || data.length < 2) return;
  const o = opts || {};
  const w = o.width || canvas.clientWidth || 360;
  const hgt = o.height || 220;
  const ctx = fitCanvas(canvas, w, hgt);
  ctx.clearRect(0, 0, w, hgt);

  const fc = Array.isArray(o.forecast) ? o.forecast : [];
  const all = data.concat(fc);

  let min = Infinity;
  let max = -Infinity;
  for (const v of all) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;
  const pad = (max - min) * 0.08 || max * 0.02 || 0.5;
  min -= pad;
  max += pad;
  const span = max - min || 1;

  const padL = 8;
  const padR = 52;
  const padT = 14;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = hgt - padT - padB;
  const totalPts = all.length;

  const X = (i) => padL + (totalPts <= 1 ? 0 : (i / (totalPts - 1)) * plotW);
  const Y = (v) => padT + plotH - ((v - min) / span) * plotH;

  // grid: 4 horizontal lines ---------------------------------------------------
  ctx.strokeStyle = "rgba(55, 65, 81, 0.6)";
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "left";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g += 1) {
    const yv = min + (span * g) / 4;
    const y = Y(yv);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR + 6, y);
    ctx.stroke();
    ctx.fillText(niceLabel(yv), w - padR + 10, y + 3);
  }

  // vertical grid every 5 ticks -------------------------------------------------
  ctx.strokeStyle = "rgba(31, 41, 55, 0.7)";
  for (let i = 0; i < totalPts; i += 5) {
    const x = X(i);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
  }

  // forecast segment (dashed amber) ----------------------------------------------
  if (fc.length) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const startIdx = data.length - 1;
    ctx.moveTo(X(startIdx), Y(data[data.length - 1]));
    for (let i = 0; i < fc.length; i += 1) {
      ctx.lineTo(X(startIdx + 1 + i), Y(fc[i]));
    }
    ctx.stroke();
    ctx.restore();
    // forecast label
    ctx.fillStyle = "#fbbf24";
    ctx.fillText("[INTEL]", padL + 4, padT - 3);
  }

  // main line ---------------------------------------------------------------------
  const up = data[data.length - 1] >= data[0];
  ctx.strokeStyle = up ? "#4ade80" : "#f87171";
  ctx.lineWidth = 1.75;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < data.length; i += 1) {
    const x = X(i);
    const y = Y(data[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // subtle fill under the line -------------------------------------------------------
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.lineTo(X(data.length - 1), padT + plotH);
  ctx.lineTo(X(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = up ? "#4ade80" : "#f87171";
  ctx.fill();
  ctx.restore();

  // last price line (dotted) + label ---------------------------------------------------
  const last = data[data.length - 1];
  const ly = Y(last);
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, ly);
  ctx.lineTo(w - padR + 6, ly);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#d1fae5";
  ctx.fillText(niceLabel(last), w - padR + 10, ly - 6);
}

export default { drawSparkline, drawChart };
