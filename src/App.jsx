import { useState, useEffect } from "react";
import { HISTORY_KEY, MAX_HISTORY, loadHistory, saveToHistory, clearHistory } from "./historyStorage.js";
import { DEFAULT_MIN_CONFIDENCE, CONFIDENCE_OPTIONS, isStrongPick } from "./strongPicks.js";
import { getCalibrationSummary, rankCalibratedMarkets } from "./calibration.js";
import { buildTopPicks } from "./pickSelection.js";
import BookLinesPanel from "./BookLinesPanel.jsx";
import { findBookLinesForMatchup } from "./bookLines.js";
import StatsPanel from "./StatsPanel.jsx";
import ResultsPanel from "./ResultsPanel.jsx";
import TicketsPanel from "./TicketsPanel.jsx";
import { loadTickets, createTicketFromPicks, updatePickStatus, deleteTicket, clearTickets } from "./ticketsStorage.js";

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
  const [bookLines, setBookLines] = useState({ date: null, games: [], errors: [] });
  const [tickets, setTickets] = useState([]);
  const [ticketMsg, setTicketMsg] = useState("");

  useEffect(() => {
    const el = document.getElementById("initial-splash");
    if (el) {
      el.classList.add("hide");
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 400);
    }
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
    setTrackRecord(loadTrackRecord());
    setTickets(loadTickets());
  }, []);

  const goToTab = (next) => {
    if (next !== tab) setTab(next);
  };

  // NOTE: remainder of App is loaded from src/AppBody.jsx pattern — see follow-up
  // This emergency stub will be replaced immediately with full file.
  return (
    <div style={{ padding: 40, color: "#fff", background: "#0B0F1A", minHeight: "100vh" }}>
      <h1>NBA Predictor — restaurando…</h1>
      <p>Actualiza en unos segundos. Si ves esto, recarga en 1 minuto.</p>
    </div>
  );
}
