// api/nbaStats.js — Helpers balldontlie para contexto de análisis
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
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(TEAM_NAME_TO_ID)) {
    if (k.toLowerCase() === lower) return v;
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase().split(" ").pop())) return v;
  }
  return null;
}

async function bdlFetch(path, apiKey, params = {}) {
  const url = new URL(`${BDL_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else if (v != null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`balldontlie ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

function summarizeTeamGames(games, teamIdNum) {
  const finished = (games || []).filter(
    (g) =>
      g.status === "Final" ||
      g.status === "final" ||
      (g.home_team_score != null && g.visitor_team_score != null && g.period >= 4)
  );

  finished.sort((a, b) => {
    const da = new Date(a.date || a.datetime || 0).getTime();
    const db = new Date(b.date || b.datetime || 0).getTime();
    return db - da;
  });

  const last10 = finished.slice(0, 10);
  let wins = 0;
  let losses = 0;
  let ptsFor = 0;
  let ptsAgainst = 0;
  const results = [];

  for (const g of last10) {
    const isHome = g.home_team?.id === teamIdNum;
    const myScore = isHome ? g.home_team_score : g.visitor_team_score;
    const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
    if (myScore == null || oppScore == null) continue;
    const won = myScore > oppScore;
    if (won) wins++;
    else losses++;
    ptsFor += myScore;
    ptsAgainst += oppScore;
    const opp = isHome
      ? g.visitor_team?.abbreviation || g.visitor_team?.name
      : g.home_team?.abbreviation || g.home_team?.name;
    results.push({
      date: (g.date || g.datetime || "").toString().slice(0, 10),
      opp,
      home: isHome,
      score: `${myScore}-${oppScore}`,
      result: won ? "W" : "L",
    });
  }

  const n = wins + losses;
  const avgPts = n ? +(ptsFor / n).toFixed(1) : null;
  const avgOpp = n ? +(ptsAgainst / n).toFixed(1) : null;
  const avgTotal = n ? +((ptsFor + ptsAgainst) / n).toFixed(1) : null;

  let restDays = null;
  if (last10[0]) {
    const last = new Date(last10[0].date || last10[0].datetime);
    const now = new Date();
    restDays = Math.max(0, Math.floor((now - last) / (1000 * 60 * 60 * 24)));
  }

  return {
    sample: n,
    record_L10: n ? `${wins}-${losses}` : null,
    avg_pts: avgPts,
    avg_pts_allowed: avgOpp,
    avg_game_total: avgTotal,
    rest_days: restDays,
    recent: results.slice(0, 5),
  };
}

export async function buildRealStats(homeName, awayName, apiKey) {
  if (!apiKey) {
    return {
      source: null,
      warning: "Sin BALLDONTLIE_API_KEY — análisis solo con conocimiento general + líneas de banca",
      home: null,
      away: null,
      h2h: null,
    };
  }

  const homeId = teamId(homeName);
  const awayId = teamId(awayName);

  if (!homeId || !awayId) {
    return {
      source: "balldontlie",
      warning: `No se resolvió team id (${homeName}/${awayName})`,
      home: null,
      away: null,
      h2h: null,
    };
  }

  try {
    const season = 2025;
    const [homeGames, awayGames, h2hGames] = await Promise.all([
      bdlFetch("/games", apiKey, {
        "team_ids[]": homeId,
        "seasons[]": season,
        per_page: 50,
      }).catch(() =>
        bdlFetch("/games", apiKey, { "team_ids[]": homeId, per_page: 30 })
      ),
      bdlFetch("/games", apiKey, {
        "team_ids[]": awayId,
        "seasons[]": season,
        per_page: 50,
      }).catch(() =>
        bdlFetch("/games", apiKey, { "team_ids[]": awayId, per_page: 30 })
      ),
      bdlFetch("/games", apiKey, {
        "team_ids[]": [homeId, awayId],
        per_page: 20,
      }).catch(() => ({ data: [] })),
    ]);

    const homeSummary = summarizeTeamGames(homeGames.data || [], homeId);
    const awaySummary = summarizeTeamGames(awayGames.data || [], awayId);

    const both = (h2hGames.data || []).filter((g) => {
      const ids = [g.home_team?.id, g.visitor_team?.id];
      return ids.includes(homeId) && ids.includes(awayId);
    });
    both.sort((a, b) => {
      const da = new Date(a.date || a.datetime || 0).getTime();
      const db = new Date(b.date || b.datetime || 0).getTime();
      return db - da;
    });

    let homeWins = 0;
    let awayWins = 0;
    const h2hList = [];
    for (const g of both.slice(0, 8)) {
      if (g.home_team_score == null || g.visitor_team_score == null) continue;
      const homeIsOurHome = g.home_team?.id === homeId;
      const ourHomeScore = homeIsOurHome ? g.home_team_score : g.visitor_team_score;
      const ourAwayScore = homeIsOurHome ? g.visitor_team_score : g.home_team_score;
      if (ourHomeScore > ourAwayScore) homeWins++;
      else awayWins++;
      h2hList.push({
        date: (g.date || "").toString().slice(0, 10),
        score: `${g.visitor_team?.abbreviation || "V"} ${g.visitor_team_score} @ ${g.home_team?.abbreviation || "L"} ${g.home_team_score}`,
      });
    }

    return {
      source: "balldontlie",
      season,
      warning: null,
      home: { team: homeName, id: homeId, ...homeSummary },
      away: { team: awayName, id: awayId, ...awaySummary },
      h2h: {
        games: h2hList.length,
        homeWins,
        awayWins,
        recent: h2hList.slice(0, 5),
      },
    };
  } catch (err) {
    return {
      source: "balldontlie",
      warning: err.message || "Error al obtener stats",
      home: null,
      away: null,
      h2h: null,
    };
  }
}

export { teamId, TEAM_NAME_TO_ID };
