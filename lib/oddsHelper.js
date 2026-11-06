// lib/oddsHelper.js — The Odds API (NBA)
const ODDS_BASE = "https://api.the-odds-api.com/v4";

const TEAM_ALIASES = {
  "atlanta hawks": "Atlanta Hawks",
  "boston celtics": "Boston Celtics",
  "brooklyn nets": "Brooklyn Nets",
  "charlotte hornets": "Charlotte Hornets",
  "chicago bulls": "Chicago Bulls",
  "cleveland cavaliers": "Cleveland Cavaliers",
  "dallas mavericks": "Dallas Mavericks",
  "denver nuggets": "Denver Nuggets",
  "detroit pistons": "Detroit Pistons",
  "golden state warriors": "Golden State Warriors",
  "houston rockets": "Houston Rockets",
  "indiana pacers": "Indiana Pacers",
  "la clippers": "LA Clippers",
  "los angeles clippers": "LA Clippers",
  "los angeles lakers": "Los Angeles Lakers",
  "memphis grizzlies": "Memphis Grizzlies",
  "miami heat": "Miami Heat",
  "milwaukee bucks": "Milwaukee Bucks",
  "minnesota timberwolves": "Minnesota Timberwolves",
  "new orleans pelicans": "New Orleans Pelicans",
  "new york knicks": "New York Knicks",
  "oklahoma city thunder": "Oklahoma City Thunder",
  "orlando magic": "Orlando Magic",
  "philadelphia 76ers": "Philadelphia 76ers",
  "phoenix suns": "Phoenix Suns",
  "portland trail blazers": "Portland Trail Blazers",
  "sacramento kings": "Sacramento Kings",
  "san antonio spurs": "San Antonio Spurs",
  "toronto raptors": "Toronto Raptors",
  "utah jazz": "Utah Jazz",
  "washington wizards": "Washington Wizards",
};

function norm(name) {
  if (!name) return "";
  const k = name.toLowerCase().trim();
  return TEAM_ALIASES[k] || name;
}

function sameTeam(a, b) {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function extractLines(event, bookmaker) {
  const bm = bookmaker || event.bookmakers?.[0];
  if (!bm) return null;
  const markets = {};
  for (const m of bm.markets || []) markets[m.key] = m;

  const home = event.home_team;
  const away = event.away_team;
  const lines = { source: "odds-api", bookmaker: bm.key || bm.title || null };

  const h2h = markets.h2h;
  if (h2h?.outcomes) {
    for (const o of h2h.outcomes) {
      if (sameTeam(o.name, home)) lines.mlHome = o.price;
      if (sameTeam(o.name, away)) lines.mlAway = o.price;
    }
  }
  const spreads = markets.spreads;
  if (spreads?.outcomes) {
    for (const o of spreads.outcomes) {
      if (sameTeam(o.name, home)) lines.spreadHome = o.point;
      if (sameTeam(o.name, away)) lines.spreadAway = o.point;
    }
  }
  const totals = markets.totals;
  if (totals?.outcomes?.length) {
    const t = totals.outcomes.find((o) => /over/i.test(o.name)) || totals.outcomes[0];
    if (t?.point != null) lines.total = t.point;
  }
  return lines;
}

export async function fetchAllNbaOdds(apiKey) {
  const url = new URL(`${ODDS_BASE}/sports/basketball_nba/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  const res = await fetch(url.toString());
  const remaining = res.headers.get("x-requests-remaining");
  if (!res.ok) {
    const t = await res.text();
    return { events: [], warning: `Odds API ${res.status}: ${t.slice(0, 150)}`, remainingRequests: remaining };
  }
  const events = await res.json();
  return { events: Array.isArray(events) ? events : [], remainingRequests: remaining };
}

export async function fetchOddsForMatchup(home, away, apiKey) {
  if (!apiKey) return { lines: null, warning: "Sin ODDS_API_KEY" };
  try {
    const { events, warning, remainingRequests } = await fetchAllNbaOdds(apiKey);
    if (warning && !events.length) return { lines: null, warning, remainingRequests };
    const match = events.find(
      (e) =>
        (sameTeam(e.home_team, home) && sameTeam(e.away_team, away)) ||
        (sameTeam(e.home_team, away) && sameTeam(e.away_team, home))
    );
    if (!match) {
      return { lines: null, warning: "Partido no encontrado en Odds API", remainingRequests, matched: null };
    }
    const lines = extractLines(match);
    if (!lines) return { lines: null, warning: "Sin bookmaker", remainingRequests, matched: match.id };
    // si el home/away de la API está invertido respecto a nuestra app, ajustar
    if (sameTeam(match.home_team, away) && sameTeam(match.away_team, home)) {
      const swap = {
        ...lines,
        mlHome: lines.mlAway,
        mlAway: lines.mlHome,
        spreadHome: lines.spreadAway,
        spreadAway: lines.spreadHome,
      };
      return { lines: swap, remainingRequests, matched: match.id };
    }
    return { lines, remainingRequests, matched: match.id };
  } catch (e) {
    return { lines: null, warning: e.message };
  }
}
