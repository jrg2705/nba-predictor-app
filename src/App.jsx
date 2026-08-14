import { useState, useEffect } from "react";
import { HISTORY_KEY, MAX_HISTORY, loadHistory, saveToHistory, clearHistory } from "./historyStorage.js";
import { DEFAULT_MIN_CONFIDENCE, CONFIDENCE_OPTIONS, isStrongPick } from "./strongPicks.js";
import { getCalibrationSummary, rankCalibratedMarkets } from "./calibration.js";
import { buildTopPicks } from "./pickSelection.js";

const TEAMS = [
  "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets",
  "Chicago Bulls", "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets",
  "Detroit Pistons", "Golden State Warriors", "Houston Rockets", "Indiana Pacers",
  "LA Clippers", "Los Angeles Lakers", "Memphis Grizzlies", "Miami Heat",
  "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
  "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns",
  "Portland Trail Blazers", "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors",
  "Utah Jazz", "Washington Wizards",
];

const TRACK_RECORD_KEY = "nba_predictor_track_record";

function loadTrackRecord() {
  try {
    const raw = localStorage.getItem(TRACK_RECORD_KEY);
    return raw ? JSON.parse(raw) : { total: 0, correct: 0, byBand: {}, byMarket: {}, byRank: {} };
  } catch {
    return { total: 0, correct: 0, byBand: {}, byMarket: {}, byRank: {} };
  }
}

const METHOD_LABELS = {
  ML: "Moneyline",
  SP: "Spread",
  OU: "Total",
  TT_H: "Team Total Local",
  TT_A: "Team Total Visitante",
  "1H": "1ª Mitad",
};

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? "#F97316" : "transparent",
      color: active ? "#0B0F1A" : "#94A3B8",
      border: `1px solid ${active ? "#F97316" : "#334155"}`,
      borderRadius: "8px",
      padding: "8px 14px",
      fontSize: "12px",
      fontWeight: 700,
      cursor: "pointer",
      letterSpacing: "0.04em",
    }}
  >
    {children}
  </button>
);

const ConfidenceBadge = ({ pct }) => {
  const color = pct >= 68 ? "#10B981" : pct >= 55 ? "#F97316" : "#EF4444";
  const label = pct >= 68 ? "Fuerte" : pct >= 55 ? "Media" : "Baja";
  return (
    <span
      style={{
        background: color,
        color: "#fff",
        borderRadius: "12px",
        padding: "2px 10px",
        fontSize: "11px",
        fontWeight: 700,
      }}
    >
      {label} {pct}%
    </span>
  );
};

const HoopLoader = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 40 }}>
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "3px solid #334155",
        borderTopColor: "#F97316",
        animation: "spin 0.9s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: "#22D3EE", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
      Analizando con stats + IA…
    </p>
  </div>
);

export default function NBAPredictor() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState("predictor");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [realStats, setRealStats] = useState(null);
  const [gameContext, setGameContext] = useState(null);
  const [error, setError] = useState("");
  const [todayGames, setTodayGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesError, setGamesError] = useState("");
  const [gamesWarning, setGamesWarning] = useState("");
  const [history, setHistory] = useState([]);
  const [trackRecord, setTrackRecord] = useState({ total: 0, correct: 0, byBand: {} });
  const [picksCount, setPicksCount] = useState(3);
  const [minConfidence, setMinConfidence] = useState(DEFAULT_MIN_CONFIDENCE);
  const [generatedPicks, setGeneratedPicks] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);

  useEffect(() => {
    const el = document.getElementById("initial-splash");
    if (el) el.remove();
    const t = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
    setTrackRecord(loadTrackRecord());
  }, []);

  const goToTab = (next) => {
    if (next !== tab) setTab(next);
  };

  const analyze = async (homeTeam = home, awayTeam = away, gameId = null) => {
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
      setError("Selecciona dos equipos diferentes.");
      return;
    }
    setError("");
    setResult(null);
    setRealStats(null);
    setGameContext(null);
    setLoading(true);
    setTab("predictor");
    setHome(homeTeam);
    setAway(awayTeam);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home: homeTeam, away: awayTeam, gameId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del servidor");
      setResult(data.analysis);
      setRealStats(data.realStats || null);
      setGameContext(data.gameContext || null);

      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        home: homeTeam,
        away: awayTeam,
        analysis: data.analysis,
        realStats: data.realStats || null,
        gameContext: data.gameContext || null,
        gameId: data.gameContext?.gameId || gameId,
        verified: false,
      };
      setHistory(saveToHistory(entry));
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayGames = async () => {
    setLoadingGames(true);
    setGamesError("");
    setGamesWarning("");
    try {
      const res = await fetch("/api/today-games");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar partidos");
      setTodayGames(data.games || []);
      if (data.warning) setGamesWarning(data.warning);
    } catch (e) {
      setGamesError(e.message);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    if (tab === "today" && todayGames.length === 0 && !loadingGames) loadTodayGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadStandings = async () => {
    setLoadingStandings(true);
    try {
      const res = await fetch("/api/standings");
      const data = await res.json();
      setStandings(data);
    } catch (e) {
      setStandings({ error: e.message });
    } finally {
      setLoadingStandings(false);
    }
  };

  useEffect(() => {
    if (tab === "standings" && !standings && !loadingStandings) loadStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const todayAnalyzed = (() => {
    const todayStr = new Date().toDateString();
    const seen = new Map();
    history.forEach((entry) => {
      if (new Date(entry.date).toDateString() !== todayStr) return;
      const key = [entry.home, entry.away].sort().join("|");
      if (!seen.has(key)) seen.set(key, entry);
    });
    return Array.from(seen.values());
  })();

  const handleGeneratePicks = () => {
    setGeneratedPicks(
      buildTopPicks(todayAnalyzed, picksCount, trackRecord, minConfidence, rankCalibratedMarkets, METHOD_LABELS)
    );
  };

  const handleExportToday = () => {
    if (todayAnalyzed.length === 0) return;
    const lines = [
      "==================================================",
      "NBA PREDICTOR — ANÁLISIS DEL DÍA",
      new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      "==================================================",
      "",
    ];
    todayAnalyzed.forEach((entry, idx) => {
      const a = entry.analysis;
      lines.push(`--- PARTIDO ${idx + 1}: ${entry.away} @ ${entry.home} ---`);
      lines.push(`ML: ${entry.away} ${a?.away_win_pct}% | ${entry.home} ${a?.home_win_pct}%`);
      if (a?.best_method) {
        lines.push(`🏆 MEJOR MÉTODO: ${a.best_method.pick_summary} (${a.best_method.confidence_pct}%)`);
        lines.push(`   ${a.best_method.reasoning}`);
      }
      if (a?.alternative_method) {
        lines.push(`🥈 ALTERNATIVA: ${a.alternative_method.pick_summary} (${a.alternative_method.confidence_pct}%)`);
      }
      lines.push(`Total: ${a?.total?.pick} ${a?.total?.line} | Spread: ${a?.spread?.favored} ${a?.spread?.line}`);
      lines.push(`Análisis: ${a?.analyst_take || ""}`);
      lines.push("");
      lines.push("-".repeat(50));
      lines.push("");
    });
    lines.push("Generado por NBA Predictor · Groq AI");
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nba-predictor-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectStyle = {
    width: "100%",
    background: "#1E293B",
    border: "1px solid #334155",
    color: "#F1F5F9",
    borderRadius: "8px",
    padding: "12px",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none",
  };

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <>
      {showSplash && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0B0F1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "splashFade 0.5s ease 1.2s forwards",
          }}
        >
          <style>{`
            @keyframes splashFade { to { opacity: 0; visibility: hidden; } }
          `}</style>
          <img
            src="/splash.png"
            alt="NBA Predictor"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      <div
        style={{
          minHeight: "100vh",
          background: "#0B0F1A",
          color: "#F1F5F9",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          padding: "24px 16px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#22D3EE",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            🏀 Stats reales · Groq AI · NBA
          </div>
          <h1
            style={{
              fontSize: "clamp(26px, 6vw, 42px)",
              fontWeight: 900,
              margin: "0 0 6px",
              background: "linear-gradient(135deg, #F1F5F9 30%, #F97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NBA PREDICTOR
          </h1>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>
            Análisis estadístico · Temporada 2026-27
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <TabButton active={tab === "predictor"} onClick={() => goToTab("predictor")}>
            🏀 Predictor
          </TabButton>
          <TabButton active={tab === "today"} onClick={() => goToTab("today")}>
            📅 Hoy
          </TabButton>
          <TabButton active={tab === "history"} onClick={() => goToTab("history")}>
            🕓 Historial ({history.length})
          </TabButton>
          <TabButton active={tab === "track"} onClick={() => goToTab("track")}>
            🎯 Track Record
          </TabButton>
          <TabButton active={tab === "picks"} onClick={() => goToTab("picks")}>
            🍀 Top Picks
          </TabButton>
          <TabButton active={tab === "standings"} onClick={() => goToTab("standings")}>
            🏆 Posiciones
          </TabButton>
          <TabButton active={tab === "h2h"} onClick={() => goToTab("h2h")}>
            🔁 H2H
          </TabButton>
        </div>

        {/* —— PREDICTOR —— */}
        {tab === "predictor" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                gap: 14,
                alignItems: "center",
                maxWidth: 680,
                margin: "0 auto 20px",
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#22D3EE", letterSpacing: "0.12em", marginBottom: 7, textAlign: "center" }}>
                  VISITANTE
                </div>
                <select value={away} onChange={(e) => setAway(e.target.value)} style={selectStyle}>
                  <option value="">Seleccionar…</option>
                  {TEAMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#1E293B",
                  border: "1px solid #F97316",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#F97316",
                }}
              >
                VS
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#F97316", letterSpacing: "0.12em", marginBottom: 7, textAlign: "center" }}>
                  LOCAL
                </div>
                <select value={home} onChange={(e) => setHome(e.target.value)} style={selectStyle}>
                  <option value="">Seleccionar…</option>
                  {TEAMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p style={{ color: "#EF4444", textAlign: "center", fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}

            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <button
                onClick={() => analyze()}
                disabled={loading}
                style={{
                  background: loading ? "#334155" : "linear-gradient(135deg, #F97316, #EA580C)",
                  color: loading ? "#64748B" : "#0B0F1A",
                  border: "none",
                  borderRadius: 8,
                  padding: "14px 36px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(249,115,22,0.35)",
                }}
              >
                {loading ? "Analizando…" : "🏀 ANALIZAR PARTIDO"}
              </button>
            </div>

            {loading && <HoopLoader />}

            {result && !loading && (
              <div style={{ maxWidth: 680, margin: "0 auto" }}>
                <div
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#22D3EE", letterSpacing: "0.12em", marginBottom: 12 }}>
                    PROBABILIDADES (MONEYLINE)
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
                    <span style={{ color: "#22D3EE" }}>
                      {away}{" "}
                      <strong style={{ color: "#F1F5F9", fontSize: 18 }}>{result.away_win_pct}%</strong>
                    </span>
                    <span style={{ color: "#F97316" }}>
                      {home}{" "}
                      <strong style={{ color: "#F1F5F9", fontSize: 18 }}>{result.home_win_pct}%</strong>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, height: 8 }}>
                    <div
                      style={{
                        flex: result.away_win_pct || 1,
                        background: "#22D3EE",
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        flex: result.home_win_pct || 1,
                        background: "#F97316",
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>

                {result.best_method && (
                  <div
                    style={{
                      background: "linear-gradient(135deg, #14532D, #166534)",
                      border: "1px solid #22C55E",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#BBF7D0", letterSpacing: "0.12em", marginBottom: 8 }}>
                      🏆 MEJOR MÉTODO
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>
                      {result.best_method.pick_summary}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "rgba(255,255,255,0.15)",
                          borderRadius: 10,
                          padding: "2px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {METHOD_LABELS[result.best_method.market] || result.best_method.market}
                      </span>
                      <ConfidenceBadge pct={result.best_method.confidence_pct} />
                    </div>
                    <p style={{ fontSize: 13, color: "#DCFCE7", margin: 0, fontStyle: "italic" }}>
                      {result.best_method.reasoning}
                    </p>
                  </div>
                )}

                {result.alternative_method && (
                  <div
                    style={{
                      background: "#1E293B",
                      border: "1px solid #22D3EE",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#67E8F9", letterSpacing: "0.12em", marginBottom: 8 }}>
                      🥈 ALTERNATIVA (2.º mejor mercado)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>
                      {result.alternative_method.pick_summary}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: "rgba(34,211,238,0.2)",
                          border: "1px solid #22D3EE",
                          color: "#67E8F9",
                          borderRadius: 10,
                          padding: "2px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {METHOD_LABELS[result.alternative_method.market] || result.alternative_method.market}
                      </span>
                      {result.alternative_method.line != null && (
                        <span style={{ fontSize: 12, color: "#94A3B8" }}>
                          línea: <strong style={{ color: "#F1F5F9" }}>{result.alternative_method.line}</strong>
                        </span>
                      )}
                      <ConfidenceBadge pct={result.alternative_method.confidence_pct} />
                    </div>
                    <p style={{ fontSize: 13, color: "#94A3B8", margin: 0, fontStyle: "italic" }}>
                      {result.alternative_method.reasoning}
                    </p>
                  </div>
                )}

                <div style={{ fontSize: 11, color: "#64748B", letterSpacing: "0.1em", marginBottom: 10 }}>
                  TODOS LOS MERCADOS
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>💰 MONEYLINE</div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {(result.home_win_pct ?? 0) >= (result.away_win_pct ?? 0) ? home : away}
                    </div>
                    <ConfidenceBadge
                      pct={Math.max(result.home_win_pct ?? 0, result.away_win_pct ?? 0)}
                    />
                    <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>
                      {away} {result.away_win_pct}% · {home} {result.home_win_pct}%
                    </p>
                  </div>
                  {result.spread && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>📏 SPREAD</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {result.spread.favored === "home" ? home : away} {result.spread.line} →{" "}
                        {result.spread.covers === "SI" ? "CUBRE" : "NO CUBRE"}
                      </div>
                      <ConfidenceBadge pct={result.spread.confidence_pct} />
                      <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.spread.reasoning}</p>
                    </div>
                  )}
                  {result.total && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>📊 TOTAL</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {result.total.pick} {result.total.line}
                      </div>
                      <ConfidenceBadge pct={result.total.confidence_pct} />
                      <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.total.reasoning}</p>
                    </div>
                  )}
                  {result.team_total_home && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#F97316", marginBottom: 8 }}>🟠 TT {home}</div>
                      <div style={{ fontWeight: 700 }}>
                        {result.team_total_home.pick} {result.team_total_home.line}
                      </div>
                      <ConfidenceBadge pct={result.team_total_home.confidence_pct} />
                      {result.team_total_home.reasoning && (
                        <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.team_total_home.reasoning}</p>
                      )}
                    </div>
                  )}
                  {result.team_total_away && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>🔵 TT {away}</div>
                      <div style={{ fontWeight: 700 }}>
                        {result.team_total_away.pick} {result.team_total_away.line}
                      </div>
                      <ConfidenceBadge pct={result.team_total_away.confidence_pct} />
                      {result.team_total_away.reasoning && (
                        <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.team_total_away.reasoning}</p>
                      )}
                    </div>
                  )}
                  {result.first_half && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>⏱️ 1ª MITAD (ganador)</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {result.first_half.winner === "home" ? home : away}
                      </div>
                      <ConfidenceBadge pct={result.first_half.confidence_pct} />
                      <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.first_half.reasoning}</p>
                    </div>
                  )}
                  {result.first_half_total && (
                    <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>⏱️ 1H TOTAL</div>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {result.first_half_total.pick} {result.first_half_total.line}
                      </div>
                      <ConfidenceBadge pct={result.first_half_total.confidence_pct} />
                      <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0 0" }}>{result.first_half_total.reasoning}</p>
                    </div>
                  )}
                </div>

                {result.analyst_take && (
                  <div
                    style={{
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "#F97316", letterSpacing: "0.12em", marginBottom: 8 }}>
                      🎙️ ANÁLISIS FINAL
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "#CBD5E1", lineHeight: 1.6, fontStyle: "italic" }}>
                      "{result.analyst_take}"
                    </p>
                    {result.pace_note && (
                      <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748B" }}>Pace: {result.pace_note}</p>
                    )}
                    {result.h2h_note && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748B" }}>H2H: {result.h2h_note}</p>
                    )}
                  </div>
                )}

                <p style={{ textAlign: "center", fontSize: 11, color: "#475569", marginTop: 16 }}>
                  Solo uso estadístico y de referencia · Groq AI
                </p>
              </div>
            )}
          </>
        )}

        {/* —— HOY —— */}
        {tab === "today" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>
                📅 Partidos de hoy —{" "}
                {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              <button
                onClick={loadTodayGames}
                disabled={loadingGames}
                style={{
                  background: "#1E293B",
                  border: "1px solid #334155",
                  color: "#22D3EE",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {loadingGames ? "…" : "🔄"}
              </button>
            </div>
            {gamesWarning && (
              <p style={{ fontSize: 12, color: "#F97316", marginBottom: 12 }}>{gamesWarning}</p>
            )}
            {loadingGames && <HoopLoader />}
            {gamesError && <p style={{ color: "#EF4444", textAlign: "center" }}>{gamesError}</p>}
            {!loadingGames && !gamesError && todayGames.length === 0 && (
              <p style={{ textAlign: "center", color: "#64748B", fontSize: 13 }}>
                No hay partidos programados o falta configurar BALLDONTLIE_API_KEY.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayGames.map((g) => (
                <div
                  key={g.gameId}
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {g.away.name} <span style={{ color: "#64748B" }}>@</span> {g.home.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      {g.status === "Final"
                        ? `Final ${g.away.score} – ${g.home.score}`
                        : `${formatTime(g.gameDate)} · ${g.status}`}
                    </div>
                  </div>
                  <button
                    onClick={() => analyze(g.home.name, g.away.name, g.gameId)}
                    style={{
                      background: "linear-gradient(135deg, #F97316, #EA580C)",
                      border: "none",
                      color: "#0B0F1A",
                      borderRadius: 6,
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Analizar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* —— HISTORIAL —— */}
        {tab === "history" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>🕓 Historial</h2>
              <div style={{ display: "flex", gap: 8 }}>
                {todayAnalyzed.length > 0 && (
                  <button
                    onClick={handleExportToday}
                    style={{
                      background: "#1E293B",
                      border: "1px solid #10B981",
                      color: "#10B981",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    📄 Exportar hoy
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid #EF4444",
                      color: "#EF4444",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    🗑️ Borrar
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>
              Solo en este dispositivo · Máx {MAX_HISTORY} entradas
            </p>
            {history.length === 0 && (
              <p style={{ textAlign: "center", color: "#64748B", padding: 40 }}>Aún no hay predicciones.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => {
                    setHome(entry.home);
                    setAway(entry.away);
                    setResult(entry.analysis);
                    setRealStats(entry.realStats || null);
                    setGameContext(entry.gameContext || null);
                    setTab("predictor");
                  }}
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {entry.away} @ {entry.home}
                    </span>
                    <span style={{ fontSize: 10, color: "#64748B" }}>
                      {new Date(entry.date).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    ML {entry.analysis?.home_win_pct}% / {entry.analysis?.away_win_pct}%
                    {entry.analysis?.best_method && (
                      <> · 🏆 {entry.analysis.best_method.pick_summary}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* —— TRACK RECORD —— */}
        {tab === "track" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>🎯 Track Record</h2>
            <p style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>
              Se rellenará automáticamente cuando verifiquemos resultados (game-result API). Independiente del historial.
            </p>
            {trackRecord.total === 0 ? (
              <p style={{ textAlign: "center", color: "#64748B", padding: 40 }}>
                Aún no hay partidos verificados. Cuando arranque la temporada y verifiques resultados, verás precisión por mercado y best vs alternative.
              </p>
            ) : (
              <div
                style={{
                  background: "#1E293B",
                  border: "1px solid #10B981",
                  borderRadius: 12,
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 11, color: "#22D3EE", marginBottom: 8 }}>PRECISIÓN GENERAL</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: "#F97316" }}>
                  {Math.round((trackRecord.correct / trackRecord.total) * 100)}%
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8" }}>
                  {trackRecord.correct} de {trackRecord.total}
                </div>
              </div>
            )}
          </div>
        )}

        {/* —— TOP PICKS —— */}
        {tab === "picks" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>🍀 Top Picks del día</h2>
            <p style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>
              Usa best_method / alternative según calibración. Umbral de confianza + diversificación por mercado.
            </p>
            {todayAnalyzed.length === 0 ? (
              <p style={{ textAlign: "center", color: "#64748B", padding: 40 }}>
                Analiza partidos hoy (tab Hoy o Predictor) para generar picks.
              </p>
            ) : (
              <>
                <div
                  style={{
                    background: "#1E293B",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <select
                    value={picksCount}
                    onChange={(e) => setPicksCount(Number(e.target.value))}
                    style={{ ...selectStyle, width: "auto" }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} picks
                      </option>
                    ))}
                  </select>
                  <select
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    style={{ ...selectStyle, width: "auto" }}
                  >
                    {CONFIDENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGeneratePicks}
                    style={{
                      background: "linear-gradient(135deg, #F97316, #EA580C)",
                      border: "none",
                      color: "#0B0F1A",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🍀 Generar
                  </button>
                </div>
                {generatedPicks?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {generatedPicks.map((p, idx) => (
                      <div
                        key={`${p.entry.id}-${p.market}`}
                        style={{
                          background: "#1E293B",
                          border: "1px solid #10B981",
                          borderRadius: 12,
                          padding: 16,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#F97316",
                            color: "#0B0F1A",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "#64748B" }}>
                            {p.entry.away} @ {p.entry.home} · {p.marketLabel}
                            {p.usedAlternative && " · alternativa"}
                          </div>
                          <div style={{ fontWeight: 700, color: "#F97316" }}>🍀 {p.pickSummary}</div>
                        </div>
                        <ConfidenceBadge pct={p.confidence} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* —— STANDINGS —— */}
        {tab === "standings" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>🏆 Posiciones</h2>
              <button
                onClick={loadStandings}
                style={{
                  background: "#1E293B",
                  border: "1px solid #334155",
                  color: "#22D3EE",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                🔄
              </button>
            </div>
            {loadingStandings && <HoopLoader />}
            {standings?.warning && (
              <p style={{ fontSize: 12, color: "#F97316" }}>{standings.warning}</p>
            )}
            {standings?.conferences &&
              Object.entries(standings.conferences).map(([conf, teams]) =>
                teams?.length > 0 ? (
                  <div key={conf} style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: conf === "East" ? "#22D3EE" : "#F97316",
                        marginBottom: 8,
                      }}
                    >
                      {conf === "East" ? "Eastern Conference" : "Western Conference"}
                    </div>
                    <div
                      style={{
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      {teams.map((t, i) => (
                        <div
                          key={t.teamId || t.name}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 40px 40px 50px",
                            padding: "10px 14px",
                            borderTop: i > 0 ? "1px solid #334155" : "none",
                            fontSize: 13,
                          }}
                        >
                          <span>{t.name}</span>
                          <span style={{ textAlign: "center", color: "#10B981" }}>{t.wins}</span>
                          <span style={{ textAlign: "center", color: "#EF4444" }}>{t.losses}</span>
                          <span style={{ textAlign: "center", color: "#94A3B8" }}>{t.winPct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            {!loadingStandings &&
              (!standings?.conferences ||
                (standings.conferences.East?.length === 0 && standings.conferences.West?.length === 0)) && (
                <p style={{ textAlign: "center", color: "#64748B" }}>
                  Sin datos de clasificación. Configura BALLDONTLIE_API_KEY (tier con standings).
                </p>
              )}
          </div>
        )}

        {/* —— H2H —— */}
        {tab === "h2h" && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>🔁 Head to Head</h2>
            <p style={{ fontSize: 13, color: "#64748B" }}>
              Panel H2H completo en la siguiente iteración (elige dos equipos y carga la serie de temporada vía{" "}
              <code style={{ color: "#22D3EE" }}>/api/h2h</code>). Por ahora usa el análisis del Predictor, que ya
              incluye nota H2H cuando hay contexto.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
