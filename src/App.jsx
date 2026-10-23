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

// TEMP: full file too large for single tool payload — user will receive download
// This bootstrap loads Tickets + message until full App is restored via download.
export default function NBAPredictor() {
  const [tickets, setTickets] = useState([]);
  useEffect(() => { setTickets(loadTickets()); }, []);
  return (
    <div style={{ minHeight: "100vh", background: "#0B0F1A", color: "#F1F5F9", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ color: "#F97316", marginTop: 0 }}>NBA PREDICTOR</h1>
      <p style={{ color: "#94A3B8", fontSize: 13, maxWidth: 520 }}>
        Restauración en curso: el <code>App.jsx</code> completo con Predictor + Tickets está listo para subir.
        Mientras tanto puedes usar la sección Tickets abajo. Si la app completa no vuelve sola, descarga el archivo que te indico en el chat y súbelo a <code>src/App.jsx</code> en GitHub.
      </p>
      <TicketsPanel
        tickets={tickets}
        onUpdatePick={(tid, pid, st) => setTickets(updatePickStatus(tid, pid, st))}
        onDelete={(id) => setTickets(deleteTicket(id))}
        onClear={() => setTickets(clearTickets())}
      />
    </div>
  );
}
