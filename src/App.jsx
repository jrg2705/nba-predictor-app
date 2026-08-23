import { useState, useEffect } from "react";
import { HISTORY_KEY, MAX_HISTORY, loadHistory, saveToHistory, clearHistory } from "./historyStorage.js";
import { DEFAULT_MIN_CONFIDENCE, CONFIDENCE_OPTIONS, isStrongPick } from "./strongPicks.js";
import { getCalibrationSummary, rankCalibratedMarkets } from "./calibration.js";
import { buildTopPicks } from "./pickSelection.js";
import BookLinesPanel from "./BookLinesPanel.jsx";
import { findBookLinesForMatchup } from "./bookLines.js";
import StatsPanel from "./StatsPanel.jsx";
import ResultsPanel from "./ResultsPanel.jsx";

// Temporary thin shell — full App restored via download if needed
export default function NBAPredictor() {
  const [tab, setTab] = useState("predictor");
  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", color: "#F1F5F9", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ color: "#F97316", marginTop: 0 }}>NBA Predictor</h1>
      <p style={{ color: "#94A3B8", fontSize: 14 }}>
        App.jsx se está restaurando. Si ves esta pantalla, sustituye <code>src/App.jsx</code> por el archivo
        completo del chat (App-with-results.jsx) o restaura el commit fd7a356 en GitHub.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <button type="button" onClick={() => setTab("predictor")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: tab === "predictor" ? "#F97316" : "#1E293B", color: tab === "predictor" ? "#0B0F1A" : "#F1F5F9" }}>Predictor</button>
        <button type="button" onClick={() => setTab("results")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: tab === "results" ? "#F97316" : "#1E293B", color: tab === "results" ? "#0B0F1A" : "#F1F5F9" }}>Resultados</button>
      </div>
      {tab === "results" && <ResultsPanel />}
      {tab === "predictor" && (
        <p style={{ color: "#64748B" }}>Pega el App completo para recuperar selector de equipos, banca y análisis.</p>
      )}
    </div>
  );
}
