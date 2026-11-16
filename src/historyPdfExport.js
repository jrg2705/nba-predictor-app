// src/historyPdfExport.js — PDF estilo borrador (solo export)

const ABBR = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

function abbr(name) {
  if (!name) return "—";
  if (ABBR[name]) return ABBR[name];
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(ABBR)) {
    if (k.toLowerCase() === n) return v;
  }
  return String(name).slice(0, 3).toUpperCase();
}

function fmtDateShort(iso) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch {
    return "—";
  }
}

function fmtEdge(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}`;
}

function edgeColor(v) {
  if (v == null || Number.isNaN(Number(v))) return "#333";
  const n = Number(v);
  if (n >= 3) return "#0a7a3e";
  if (n <= -3) return "#c2410c";
  if (n > 0) return "#15803d";
  if (n < 0) return "#b45309";
  return "#333";
}

export function rowFromEntry(entry) {
  const a = entry.analysis || {};
  const away = entry.away || "";
  const home = entry.home || "";
  const awayPct = a.away_win_pct != null ? a.away_win_pct : "—";
  const homePct = a.home_win_pct != null ? a.home_win_pct : "—";

  const best = a.best_method || {};
  const alt = a.alternative_method || {};

  // ML: mismo criterio que tarjeta MONEYLINE (mayor %)
  const homePctN = Number(a.home_win_pct);
  const awayPctN = Number(a.away_win_pct);
  let mlTeam = "";
  if (Number.isFinite(homePctN) || Number.isFinite(awayPctN)) {
    const h = Number.isFinite(homePctN) ? homePctN : -1;
    const av = Number.isFinite(awayPctN) ? awayPctN : -1;
    mlTeam = h >= av ? home : away;
  }

  // 1ª mitad: mismo criterio que tarjeta 1ª MITAD
  const fh = a.first_half || {};
  let fhTeam = "";
  if (fh.winner === "home") fhTeam = home;
  else if (fh.winner === "away") fhTeam = away;
  else if (fh.winner) fhTeam = String(fh.winner);

  const sp = a.spread || {};
  let spreadAway = "";
  let spreadHome = "";
  if (sp.line != null) {
    const line = Number(sp.line);
    const abs = Math.abs(line);
    if (sp.favored === "home") {
      spreadHome = line <= 0 ? String(line) : `-${abs}`;
      spreadAway = `+${abs}`;
    } else if (sp.favored === "away") {
      spreadAway = line <= 0 ? String(line) : `-${abs}`;
      spreadHome = `+${abs}`;
    } else {
      spreadHome = String(sp.line);
    }
  }

  const tot = a.total || {};
  const totalLine = tot.line != null ? tot.line : "";
  const totalPick = tot.pick ? String(tot.pick).toUpperCase() : "";

  const meto1 = best.pick_summary || (best.market ? String(best.market) : "—");
  const meto2 = alt.pick_summary || (alt.market ? String(alt.market) : "—");

  const elo =
    entry.gameContext?.elo ||
    entry.realStats?.elo ||
    a.elo ||
    null;
  const edgeAway = elo?.edgeAwayPct ?? elo?.edge_away ?? null;
  const edgeHome = elo?.edgeHomePct ?? elo?.edge_home ?? null;

  return {
    away: abbr(away),
    home: abbr(home),
    awayPct,
    homePct,
    mlTeamShort: mlTeam ? abbr(mlTeam) : "—",
    spreadAway,
    spreadHome,
    totalLine,
    totalPick,
    fhTeamShort: fhTeam ? abbr(fhTeam) : "—",
    meto1,
    meto2,
    edgeAway,
    edgeHome,
    date: entry.date,
  };
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openHistoryPdf({ entries, from, to }) {
  const rows = (entries || []).map(rowFromEntry);

  const fl =
    from && /^\d{4}-\d{2}-\d{2}$/.test(from)
      ? `${from.slice(8, 10)}/${from.slice(5, 7)}/${from.slice(2, 4)}`
      : rows.length
        ? fmtDateShort(rows[rows.length - 1].date)
        : "—";
  const tl =
    to && /^\d{4}-\d{2}-\d{2}$/.test(to)
      ? `${to.slice(8, 10)}/${to.slice(5, 7)}/${to.slice(2, 4)}`
      : rows.length
        ? fmtDateShort(rows[0].date)
        : "—";

  const bodyRows = rows
    .map((r) => {
      const eAway = edgeColor(r.edgeAway);
      const eHome = edgeColor(r.edgeHome);
      return `
      <tr class="game">
        <td class="equ">
          <div class="team">${esc(r.away)} <span class="pct">${esc(r.awayPct)}${r.awayPct !== "—" ? "%" : ""}</span></div>
          <div class="team">${esc(r.home)} <span class="pct">${esc(r.homePct)}${r.homePct !== "—" ? "%" : ""}</span></div>
        </td>
        <td class="c team-pick">${esc(r.mlTeamShort)}</td>
        <td class="c spread">
          <div>${esc(r.spreadAway)}</div>
          <div>${esc(r.spreadHome)}</div>
        </td>
        <td class="c total">
          <div>${esc(r.totalLine)}</div>
          <div class="pick">${esc(r.totalPick)}</div>
        </td>
        <td class="c team-pick">${esc(r.fhTeamShort)}</td>
        <td class="meto">${esc(r.meto1)}</td>
        <td class="meto">${esc(r.meto2)}</td>
        <td class="elo">
          <div style="color:${eAway}">${esc(fmtEdge(r.edgeAway))}</div>
          <div style="color:${eHome}">${esc(fmtEdge(r.edgeHome))}</div>
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>NBA PREDICTOR — Análisis ${esc(fl)} al ${esc(tl)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 16px 20px 24px;
      font-size: 11px;
    }
    .header { text-align: center; margin-bottom: 14px; line-height: 1.35; }
    .header .title { font-size: 18px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .header .sub { font-size: 13px; margin-top: 2px; }
    .header .range { font-size: 12px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead th {
      border: 1.5px solid #222;
      background: #f3f3f3;
      padding: 6px 4px;
      font-size: 10px;
      text-transform: uppercase;
    }
    tbody td { border: 1px solid #333; padding: 5px 4px; vertical-align: middle; }
    tr.game td { height: 42px; }
    .c { text-align: center; }
    .equ { width: 14%; font-weight: 600; }
    .team { line-height: 1.35; }
    .pct { font-weight: 400; font-size: 10px; color: #333; }
    .team-pick { width: 9%; font-size: 11px; font-weight: 700; line-height: 1.2; }
    .spread, .total { width: 10%; }
    .pick { font-size: 10px; }
    .meto { width: 14%; font-size: 10px; text-align: left; padding-left: 6px; }
    .elo { width: 10%; text-align: center; font-weight: 700; }
    .footnote { margin-top: 12px; font-size: 9px; color: #555; text-align: right; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .toolbar {
      display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 12px;
    }
    .toolbar button {
      font-family: system-ui, sans-serif;
      font-size: 13px;
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid #333;
      background: #111;
      color: #fff;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">Imprimir / Guardar PDF</button>
    <button onclick="window.close()" style="background:#fff;color:#111">Cerrar</button>
  </div>
  <div class="header">
    <div class="title">NBA PREDICTOR</div>
    <div class="sub">Análisis Partidos</div>
    <div class="range">del: ${esc(fl)} &nbsp; al: ${esc(tl)}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>EQU. / %</th>
        <th>ML</th>
        <th>SPREAD</th>
        <th>TOTAL</th>
        <th>1ª MITAD</th>
        <th>METO 1</th>
        <th>METO 2</th>
        <th>ELO %</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="8" class="c">Sin análisis en este rango</td></tr>`}
    </tbody>
  </table>
  <div class="footnote">NBA Predictor · ${rows.length} partido(s) · Generado ${esc(new Date().toLocaleString("es-ES"))}</div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Permite ventanas emergentes para exportar el PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
