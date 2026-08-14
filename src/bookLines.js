// src/bookLines.js — Parse líneas de banca NBA (.txt)
// Formato (una línea por partido, campos con |):
// away|home|ml_away|ml_home|spread_home|total|tt_away|tt_home|h_total|h_spread_home
//
// Ejemplo:
// # FECHA: 2026-10-22
// Atlanta Hawks|Brooklyn Nets|+150|-170|-3.5|224.5|110.5|114.5|112.5|-2
//
// También acepta abreviaturas: ATL|BKN|+150|-170|-3.5|224.5|...

const TEAM_ALIASES = {
  atl: "Atlanta Hawks",
  hawks: "Atlanta Hawks",
  atlanta: "Atlanta Hawks",
  "atlanta hawks": "Atlanta Hawks",
  bos: "Boston Celtics",
  celtics: "Boston Celtics",
  boston: "Boston Celtics",
  "boston celtics": "Boston Celtics",
  bkn: "Brooklyn Nets",
  net: "Brooklyn Nets",
  nets: "Brooklyn Nets",
  brooklyn: "Brooklyn Nets",
  "brooklyn nets": "Brooklyn Nets",
  cha: "Charlotte Hornets",
  hornets: "Charlotte Hornets",
  charlotte: "Charlotte Hornets",
  "charlotte hornets": "Charlotte Hornets",
  chi: "Chicago Bulls",
  bulls: "Chicago Bulls",
  chicago: "Chicago Bulls",
  "chicago bulls": "Chicago Bulls",
  cle: "Cleveland Cavaliers",
  cavs: "Cleveland Cavaliers",
  cavaliers: "Cleveland Cavaliers",
  cleveland: "Cleveland Cavaliers",
  "cleveland cavaliers": "Cleveland Cavaliers",
  dal: "Dallas Mavericks",
  mavs: "Dallas Mavericks",
  mavericks: "Dallas Mavericks",
  dallas: "Dallas Mavericks",
  "dallas mavericks": "Dallas Mavericks",
  den: "Denver Nuggets",
  nuggets: "Denver Nuggets",
  denver: "Denver Nuggets",
  "denver nuggets": "Denver Nuggets",
  det: "Detroit Pistons",
  pistons: "Detroit Pistons",
  detroit: "Detroit Pistons",
  "detroit pistons": "Detroit Pistons",
  gsw: "Golden State Warriors",
  warriors: "Golden State Warriors",
  "golden state": "Golden State Warriors",
  "golden state warriors": "Golden State Warriors",
  hou: "Houston Rockets",
  rockets: "Houston Rockets",
  houston: "Houston Rockets",
  "houston rockets": "Houston Rockets",
  ind: "Indiana Pacers",
  pacers: "Indiana Pacers",
  indiana: "Indiana Pacers",
  "indiana pacers": "Indiana Pacers",
  lac: "LA Clippers",
  clippers: "LA Clippers",
  "la clippers": "LA Clippers",
  "los angeles clippers": "LA Clippers",
  lal: "Los Angeles Lakers",
  lakers: "Los Angeles Lakers",
  "la lakers": "Los Angeles Lakers",
  "los angeles lakers": "Los Angeles Lakers",
  mem: "Memphis Grizzlies",
  grizzlies: "Memphis Grizzlies",
  memphis: "Memphis Grizzlies",
  "memphis grizzlies": "Memphis Grizzlies",
  mia: "Miami Heat",
  heat: "Miami Heat",
  miami: "Miami Heat",
  "miami heat": "Miami Heat",
  mil: "Milwaukee Bucks",
  bucks: "Milwaukee Bucks",
  milwaukee: "Milwaukee Bucks",
  "milwaukee bucks": "Milwaukee Bucks",
  min: "Minnesota Timberwolves",
  wolves: "Minnesota Timberwolves",
  timberwolves: "Minnesota Timberwolves",
  minnesota: "Minnesota Timberwolves",
  "minnesota timberwolves": "Minnesota Timberwolves",
  nop: "New Orleans Pelicans",
  no: "New Orleans Pelicans",
  pelicans: "New Orleans Pelicans",
  "new orleans": "New Orleans Pelicans",
  "new orleans pelicans": "New Orleans Pelicans",
  nyk: "New York Knicks",
  knicks: "New York Knicks",
  "new york knicks": "New York Knicks",
  "ny knicks": "New York Knicks",
  okc: "Oklahoma City Thunder",
  thunder: "Oklahoma City Thunder",
  "oklahoma city": "Oklahoma City Thunder",
  "oklahoma city thunder": "Oklahoma City Thunder",
  orl: "Orlando Magic",
  magic: "Orlando Magic",
  orlando: "Orlando Magic",
  "orlando magic": "Orlando Magic",
  phi: "Philadelphia 76ers",
  sixers: "Philadelphia 76ers",
  "76ers": "Philadelphia 76ers",
  philadelphia: "Philadelphia 76ers",
  "philadelphia 76ers": "Philadelphia 76ers",
  phx: "Phoenix Suns",
  suns: "Phoenix Suns",
  phoenix: "Phoenix Suns",
  "phoenix suns": "Phoenix Suns",
  por: "Portland Trail Blazers",
  blazers: "Portland Trail Blazers",
  portland: "Portland Trail Blazers",
  "portland trail blazers": "Portland Trail Blazers",
  "trail blazers": "Portland Trail Blazers",
  sac: "Sacramento Kings",
  kings: "Sacramento Kings",
  sacramento: "Sacramento Kings",
  "sacramento kings": "Sacramento Kings",
  sas: "San Antonio Spurs",
  spurs: "San Antonio Spurs",
  "san antonio": "San Antonio Spurs",
  "san antonio spurs": "San Antonio Spurs",
  tor: "Toronto Raptors",
  raptors: "Toronto Raptors",
  toronto: "Toronto Raptors",
  "toronto raptors": "Toronto Raptors",
  uta: "Utah Jazz",
  jazz: "Utah Jazz",
  utah: "Utah Jazz",
  "utah jazz": "Utah Jazz",
  was: "Washington Wizards",
  wizards: "Washington Wizards",
  washington: "Washington Wizards",
  "washington wizards": "Washington Wizards",
};

function resolveTeam(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  if (TEAM_ALIASES[lower]) return TEAM_ALIASES[lower];
  for (const [alias, full] of Object.entries(TEAM_ALIASES)) {
    if (lower === alias) return full;
  }
  // partial match only for longer aliases
  for (const [alias, full] of Object.entries(TEAM_ALIASES)) {
    if (alias.length >= 4 && (lower.includes(alias) || alias.includes(lower))) return full;
  }
  return cleaned;
}

function parseNum(s) {
  if (s == null || s === "") return null;
  const n = parseFloat(String(s).replace(",", ".").replace("½", ".5").replace("1/2", ".5"));
  return isNaN(n) ? null : n;
}

function parseOdds(s) {
  if (s == null || s === "") return null;
  const cleaned = String(s).trim().replace("+", "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : (String(s).trim().startsWith("+") ? n : n);
}

/**
 * @returns {{ date: string|null, games: Array<object>, errors: string[] }}
 */
export function parseBookLines(text) {
  const errors = [];
  const games = [];
  let date = null;

  if (!text || typeof text !== "string") {
    return { date: null, games: [], errors: ["Texto vacío"] };
  }

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    if (raw.startsWith("#")) {
      const dateMatch = raw.match(/FECHA\s*:\s*(\d{4}-\d{2}-\d{2})/i);
      if (dateMatch) date = dateMatch[1];
      continue;
    }

    const parts = raw.split("|").map((x) => (x == null ? "" : x.trim()));
    // Mínimo: away|home|ml_away|ml_home|spread|total
    if (parts.length < 6) {
      errors.push(`Línea ${i + 1}: esperados ≥6 campos (away|home|mlA|mlH|spread|total), hay ${parts.length}`);
      continue;
    }

    const away = resolveTeam(parts[0]);
    const home = resolveTeam(parts[1]);
    if (!away || !home) {
      errors.push(`Línea ${i + 1}: equipos inválidos (${parts[0]}/${parts[1]})`);
      continue;
    }

    // spread_home: negativo = local favorito (ej -3.5)
    const spreadHome = parseNum(parts[4]);

    games.push({
      away,
      home,
      mlAway: parseOdds(parts[2]),
      mlHome: parseOdds(parts[3]),
      spreadHome, // línea del local (ej -3.5)
      spreadAway: spreadHome != null ? -spreadHome : null,
      total: parseNum(parts[5]),
      ttAway: parseNum(parts[6]),
      ttHome: parseNum(parts[7]),
      hTotal: parseNum(parts[8]), // total 1ª mitad
      hSpreadHome: parseNum(parts[9]), // spread 1H del local
      rawLine: raw,
    });
  }

  return { date, games, errors };
}

export function findBookLinesForMatchup(games, home, away) {
  if (!Array.isArray(games)) return null;
  return (
    games.find(
      (g) =>
        (g.home === home && g.away === away) ||
        (g.home === away && g.away === home)
    ) || null
  );
}

export { resolveTeam, TEAM_ALIASES };
