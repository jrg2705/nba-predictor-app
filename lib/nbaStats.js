// lib/nbaStats.js — Helpers balldontlie para contexto de análisis
const BDL_BASE = "https://api.balldontlie.io/nba/v1";

const TEAM_NAME_TO_ID = {
  "Atlanta Hawks": 1,
  "Boston Celtics": 2,
  "Brooklyn Nets": 3,
  "Charlotte Hornets": 4,
  "Chicago Bulls": 5,
  "Cleveland Cavaliers": 6,
  "Dallas Mavericks": 7,
  "Denver Nuggets": 8,
  "Detroit Pistons": 9,
  "Golden State Warriors": 10,
  "Houston Rockets": 11,
  "Indiana Pacers": 12,
  "LA Clippers": 13,
  "Los Angeles Clippers": 13,
  "Los Angeles Lakers": 14,
  "Memphis Grizzlies": 15,
  "Miami Heat": 16,
  "Milwaukee Bucks": 17,
  "Minnesota Timberwolves": 18,
  "New Orleans Pelicans": 19,
  "New York Knicks": 20,
  "Oklahoma City Thunder": 21,
  "Orlando Magic": 22,
  "Philadelphia 76ers": 23,
  "Phoenix Suns": 24,
  "Portland Trail Blazers": 25,
  "Sacramento Kings": 26,
  "San Antonio Spurs": 27,
  "Toronto Raptors": 28,
  "Utah Jazz": 29,
  "Washington Wizards": 30,
};

function teamId(name) {
  if (!name) return null;
  if (TEAM_NAME_TO_ID[name]) return TEAM_NAME_TO_ID[name];
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(TEAM_NAME_TO_ID)) {
    if (k.toLowerCase() === n) return v;
  }
  return null;
}

async function fetchTeamGames(teamId, apiKey, season, perPage = 15) {
  const url = new URL(`${BDL_BASE}/games`);
  url.searchParams.set("team_ids[]", String(teamId));
  url.searchParams.set("seasons[]", String(season));
  url.searchParams.set("per_page", String(perPage));
  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`balldontlie ${res.status}: ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  return data.data || [];
}

function summarizeTeam(games, teamId, teamName) {
  if (!games?.length) return null;
  const sorted = [...games].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let wins = 0, losses = 0;
  const recent = [];
  let pts = 0, ptsAllowed = 0, n = 0;
  let lastDate = null;

  for (const g of sorted.slice(0, 10)) {
    const isHome = g.home_team?.id === teamId;
    const my = isHome ? g.home_team_score : g.visitor_team_score;
    const opp = isHome ? g.visitor_team_score : g.home_team_score;
    if (my == null || opp == null) continue;
    n += 1;
    pts += my;
    ptsAllowed += opp;
    if (my > opp) wins += 1;
    else if (my < opp) losses += 1;
    const oppName = isHome
      ? g.visitor_team?.full_name || g.visitor_team?.name
      : g.home_team?.full_name || g.home_team?.name;
    recent.push({
      result: my > opp ? "W" : my < opp ? "L" : "T",
      opp: oppName,
      score: `${my}-${opp}`,
      date: g.date,
    });
    if (!lastDate && g.date) lastDate = g.date;
  }

  let rest_days = null;
  if (lastDate) {
    const d = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
    rest_days = Math.max(0, Math.round(d));
  }

  return {
    team: teamName,
    record_L10: n ? `${wins}-${losses}` : null,
    avg_pts: n ? Math.round((pts / n) * 10) / 10 : null,
    avg_pts_allowed: n ? Math.round((ptsAllowed / n) * 10) / 10 : null,
    avg_game_total: n ? Math.round(((pts + ptsAllowed) / n) * 10) / 10 : null,
    rest_days,
    recent: recent.slice(0, 5),
  };
}

function buildH2h(gamesHome, gamesAway, homeId, awayId) {
  const map = new Map();
  for (const g of [...(gamesHome || []), ...(gamesAway || [])]) {
    if (!g.id) continue;
    map.set(g.id, g);
  }
  const h2h = [];
  for (const g of map.values()) {
    const ids = [g.home_team?.id, g.visitor_team?.id].filter(Boolean);
    if (ids.includes(homeId) && ids.includes(awayId)) {
      h2h.push(g);
    }
  }
  h2h.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const sample = h2h.slice(0, 5);
  let homeWins = 0, awayWins = 0;
  const recent = [];
  for (const g of sample) {
    if (g.home_team_score == null || g.visitor_team_score == null) continue;
    const homeIsOurHome = g.home_team?.id === homeId;
    const ourHomeScore = homeIsOurHome ? g.home_team_score : g.visitor_team_score;
    const ourAwayScore = homeIsOurHome ? g.visitor_team_score : g.home_team_score;
    if (ourHomeScore > ourAwayScore) homeWins += 1;
    else if (ourAwayScore > ourHomeScore) awayWins += 1;
    recent.push({
      score: `${g.visitor_team?.abbreviation || "?"} ${g.visitor_team_score}-${g.home_team_score} ${g.home_team?.abbreviation || "?"}`,
      date: g.date,
    });
  }
  return { games: sample.length, homeWins, awayWins, recent };
}

export async function buildRealStats(homeName, awayName, apiKey) {
  if (!apiKey) {
    return { source: "none", warning: "Sin BALLDONTLIE_API_KEY" };
  }
  const homeId = teamId(homeName);
  const awayId = teamId(awayName);
  if (!homeId || !awayId) {
    return { source: "balldontlie", warning: "Equipo no mapeado a ID" };
  }
  const season =
    new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  try {
    const [homeGames, awayGames] = await Promise.all([
      fetchTeamGames(homeId, apiKey, season),
      fetchTeamGames(awayId, apiKey, season),
    ]);
    return {
      source: "balldontlie",
      season,
      home: summarizeTeam(homeGames, homeId, homeName),
      away: summarizeTeam(awayGames, awayId, awayName),
      h2h: buildH2h(homeGames, awayGames, homeId, awayId),
    };
  } catch (e) {
    return { source: "balldontlie", warning: e.message };
  }
}
