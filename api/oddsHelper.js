// api/oddsHelper.js — The Odds API (NBA) → formato compatible con bookLines
// Env: ODDS_API_KEY
// Docs: https://the-odds-api.com/liveapi/guides/v4/

const ODDS_URL =
  "https://api.the-odds-api.com/v4/sports/basketball_nba/odds";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamsMatch(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const aliases = {
    "la clippers": ["clippers", "los angeles clippers"],
    "los angeles lakers": ["lakers", "la lakers"],
    "philadelphia 76ers": ["76ers", "sixers", "philadelphia"],
    "portland trail blazers": ["blazers", "trail blazers"],
    "golden state warriors": ["warriors", "golden state"],
    "minnesota timberwolves": ["timberwolves", "wolves"],
    "new orleans pelicans": ["pelicans"],
    "oklahoma city thunder": ["thunder", "okc"],
    "new york knicks": ["knicks"],
    "san antonio spurs": ["spurs"],
  };
  for (const [canon, list] of Object.entries(aliases)) {
    const group = [canon, ...list].map(norm);
    if (group.includes(na) && group.includes(nb)) return true;
  }
  return false;
}

function pickBookmaker(bookmakers) {
  if (!Array.isArray(bookmakers) || !bookmakers.length) return null;
  const prefer = ["draftkings", "fanduel", "betmgm", "caesars", "pointsbetus", "bovada"];
  for (const key of prefer) {
    const b = bookmakers.find((x) => x.key === key);
    if (b) return b;
  }
  return bookmakers[0];
}

function extractLines(event, homeName, awayName) {
  const book = pickBookmaker(event.bookmakers || []);
  if (!book) return null;

  const lines = {
    mlAway: null,
    mlHome: null,
    spreadHome: null,
    total: null,
    ttAway: null,
    ttHome: null,
    hTotal: null,
    hSpreadHome: null,
    source: "odds-api",
    bookmaker: book.title || book.key,
    commence_time: event.commence_time || null,
    event_id: event.id || null,
  };

  for (const m of book.markets || []) {
    if (m.key === "h2h") {
      for (const o of m.outcomes || []) {
        if (teamsMatch(o.name, homeName)) lines.mlHome = o.price;
        if (teamsMatch(o.name, awayName)) lines.mlAway = o.price;
      }
    }
    if (m.key === "spreads") {
      for (const o of m.outcomes || []) {
        if (teamsMatch(o.name, homeName) && o.point != null) {
          lines.spreadHome = o.point;
        }
      }
    }
    if (m.key === "totals") {
      const over = (m.outcomes || []).find((o) => /over/i.test(o.name));
      if (over?.point != null) lines.total = over.point;
    }
  }

  if (
    lines.mlHome == null &&
    lines.mlAway == null &&
    lines.spreadHome == null &&
    lines.total == null
  ) {
    return null;
  }
  return lines;
}

export async function fetchOddsForMatchup(home, away, apiKey) {
  if (!apiKey) {
    return { lines: null, warning: "Falta ODDS_API_KEY en Vercel" };
  }

  const url = new URL(ODDS_URL);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), { method: "GET" });
  const remaining = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");

  if (!res.ok) {
    const text = await res.text();
    return {
      lines: null,
      warning: `Odds API ${res.status}: ${text.slice(0, 200)}`,
      remainingRequests: remaining,
      usedRequests: used,
    };
  }

  const events = await res.json();
  if (!Array.isArray(events) || events.length === 0) {
    return {
      lines: null,
      warning: "Odds API: sin partidos NBA próximos/vivos",
      remainingRequests: remaining,
    };
  }

  const match = events.find(
    (e) => teamsMatch(e.home_team, home) && teamsMatch(e.away_team, away)
  );

  const matchFlip = !match
    ? events.find(
        (e) => teamsMatch(e.home_team, away) && teamsMatch(e.away_team, home)
      )
    : null;

  const event = match || matchFlip;
  if (!event) {
    return {
      lines: null,
      warning: `Odds API: no hay evento para ${away} @ ${home}`,
      remainingRequests: remaining,
      available: events.slice(0, 12).map((e) => `${e.away_team} @ ${e.home_team}`),
    };
  }

  let lines = extractLines(event, event.home_team, event.away_team);

  if (lines && matchFlip && !match) {
    if (lines.spreadHome != null) {
      lines.spreadHome = -lines.spreadHome;
    }
    const tmpMl = lines.mlHome;
    lines.mlHome = lines.mlAway;
    lines.mlAway = tmpMl;
  }

  return {
    lines,
    remainingRequests: remaining,
    usedRequests: used,
    matched: `${event.away_team} @ ${event.home_team}`,
  };
}

export async function fetchAllNbaOdds(apiKey) {
  if (!apiKey) {
    return { games: [], warning: "Falta ODDS_API_KEY en Vercel" };
  }

  const url = new URL(ODDS_URL);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString());
  const remaining = res.headers.get("x-requests-remaining");

  if (!res.ok) {
    const text = await res.text();
    return {
      games: [],
      warning: `Odds API ${res.status}: ${text.slice(0, 200)}`,
      remainingRequests: remaining,
    };
  }

  const events = await res.json();
  const games = (events || []).map((e) => {
    const lines = extractLines(e, e.home_team, e.away_team);
    return {
      event_id: e.id,
      commence_time: e.commence_time,
      home: e.home_team,
      away: e.away_team,
      lines,
    };
  });

  return { games, remainingRequests: remaining };
}
