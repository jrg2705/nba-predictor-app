// src/ResultsPanel.jsx — Resultados por día + sync Neon + CSV por rango
import { useCallback, useEffect, useState } from "react";

const CACHE_PREFIX = "nba-day-results-";

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(iso) {
  if (!iso) return "";
  try {
    const [y, m, day] = iso.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return d.toLocaleDateString("es", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function winnerName(game) {
  if (game.winner === "home") return game.home?.name;
  if (game.winner === "away") return game.away?.name;
  if (game.winner === "tie") return "Empate";
  return "—";
}

function loadCache(date) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + date);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date === date && Array.isArray(parsed.games)) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function saveCache(payload) {
  try {
    localStorage.setItem(CACHE_PREFIX + payload.date, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

function daysInRange(from, to) {
  const out = [];
  let d = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cardStyle = {
  background: "#1E293B",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "14px 16px",
  marginBottom: "10px",
  cursor: "pointer",
};

const muted = { color: "#94A3B8", fontSize: "12px" };

export default function ResultsPanel() {
  const [date, setDate] = useState(yesterdayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("2026-10-31");
  const [rangeTo, setRangeTo] = useState("2026-11-17");
  const [syncMsg, setSyncMsg] = useState("");
  const [syncing, setSyncing] = useState(false);

  const fetchResults = useCallback(async (targetDate, { force = false } = {}) => {
    setError("");
    if (!force) {
      const cached = loadCache(targetDate);
      if (cached) {
        setData(cached);
        setFromCache(true);
        setSelectedId(null);
        return;
      }
    }

    setLoading(true);
    setFromCache(false);
    try {
      const res = await fetch(
        `/api/today-games?date=${encodeURIComponent(targetDate)}&results=1`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar resultados");
      if (json.warning && (!json.games || json.games.length === 0)) {
        setError(json.warning);
        setData(json);
      } else {
        saveCache(json);
        setData(json);
      }
      setSelectedId(null);
    } catch (e) {
      setError(e.message || "No se pudieron cargar los resultados");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(date);
  }, [date, fetchResults]);

  const syncRangeToNeon = async () => {
    if (!rangeFrom || !rangeTo) {
      setSyncMsg("Elige desde y hasta");
      return;
    }
    if (rangeFrom > rangeTo) {
      setSyncMsg("La fecha desde debe ser ≤ hasta");
      return;
    }
    const days = daysInRange(rangeFrom, rangeTo);
    setSyncing(true);
    setSyncMsg(`Sincronizando 0/${days.length}…`);
    let ok = 0;
    let fail = 0;
    let totalGames = 0;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      setSyncMsg(`Sincronizando ${i + 1}/${days.length}: ${day}…`);
      try {
        let res = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: day }),
        });
        let json = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setSyncMsg(`429 en ${day}. Esperando 8s…`);
          await sleep(8000);
          res = await fetch("/api/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: day }),
          });
          json = await res.json().catch(() => ({}));
        }
        if (!res.ok) fail += 1;
        else {
          ok += 1;
          totalGames += json.totalFinal || 0;
        }
      } catch {
        fail += 1;
      }
      await sleep(800);
    }
    setSyncing(false);
    setSyncMsg(`Listo: ${ok} días ok · ${fail} fallos · ${totalGames} finales en Neon`);
  };

  const exportRangeCsv = () => {
    if (!rangeFrom || !rangeTo) {
      setSyncMsg("Elige desde y hasta");
      return;
    }
    const url = `/api/results?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(
      rangeTo
    )}&format=csv`;
    window.open(url, "_blank");
    setSyncMsg("CSV desde Neon (solo días ya sincronizados)");
  };

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
      {/* Rango → Neon + CSV */}
      <div
        style={{
          background: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "18px 20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#A78BFA",
            letterSpacing: "0.12em",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          EXPORTAR / SINCRONIZAR RANGO
        </div>
        <p style={{ ...muted, margin: "0 0 12px", textAlign: "center", lineHeight: 1.45 }}>
          Guarda finales en Neon (como el historial) y descarga CSV. Sincroniza con pausas para evitar
          429 de balldontlie.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            alignItems: "flex-end",
            justifyContent: "center",
            marginBottom: "12px",
          }}
        >
          <label style={{ fontSize: 11, color: "#94A3B8" }}>
            Desde
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                background: "#0B0F1A",
                border: "1px solid #334155",
                color: "#F1F5F9",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          </label>
          <label style={{ fontSize: 11, color: "#94A3B8" }}>
            Hasta
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                background: "#0B0F1A",
                border: "1px solid #334155",
                color: "#F1F5F9",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            onClick={syncRangeToNeon}
            disabled={syncing}
            style={{
              background: syncing ? "#334155" : "#8B5CF6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: syncing ? "wait" : "pointer",
            }}
          >
            {syncing ? "Sincronizando…" : "☁️ Sync → Neon"}
          </button>
          <button
            type="button"
            onClick={exportRangeCsv}
            disabled={syncing}
            style={{
              background: "#1E293B",
              color: "#A78BFA",
              border: "1px solid #A78BFA",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📊 Export CSV
          </button>
        </div>
        {syncMsg && (
          <p style={{ ...muted, margin: "12px 0 0", textAlign: "center", color: "#CBD5E1" }}>
            {syncMsg}
          </p>
        )}
      </div>

      {/* Día a día (como antes) */}
      <div
        style={{
          background: "#1E293B",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "18px 20px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#22D3EE",
            letterSpacing: "0.12em",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          RESULTADOS DEL DÍA
        </div>
        <p style={{ ...muted, margin: "0 0 14px", textAlign: "center", lineHeight: 1.45 }}>
          Partidos finalizados de la jornada. Al cargar un día también se guardan en Neon. Cache local
          en el teléfono.
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "#0B0F1A",
              border: "1px solid #334155",
              color: "#F1F5F9",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "14px",
            }}
          />
          <button
            type="button"
            onClick={() => fetchResults(date, { force: true })}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              background: loading ? "#334155" : "#F97316",
              color: loading ? "#94A3B8" : "#0B0F1A",
              fontSize: "13px",
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>

        {data && (
          <p style={{ ...muted, margin: "12px 0 0", textAlign: "center" }}>
            {formatDateLabel(date)}
            {fromCache ? " · cache local" : ""}
            {data.totalFinal != null ? ` · ${data.totalFinal} finales` : ""}
          </p>
        )}
      </div>

      {error && (
        <p style={{ color: "#F97316", textAlign: "center", fontSize: 13, marginBottom: 12 }}>
          {error}
        </p>
      )}

      {loading && !data && (
        <p style={{ textAlign: "center", color: "#64748B", padding: 24 }}>Cargando resultados…</p>
      )}

      {!loading && data?.games?.length === 0 && !error && (
        <p style={{ textAlign: "center", color: "#64748B", padding: 24 }}>
          No hay partidos finalizados en esta fecha.
        </p>
      )}

      {data?.games?.map((g) => {
        const open = selectedId === g.gameId;
        const score =
          g.away?.score != null && g.home?.score != null
            ? `${g.away.score} – ${g.home.score}`
            : "—";
        return (
          <div
            key={g.gameId}
            style={cardStyle}
            onClick={() => setSelectedId(open ? null : g.gameId)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#F1F5F9",
                    fontSize: "14px",
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  {g.away?.name} <span style={{ color: "#22D3EE" }}>@</span> {g.home?.name}
                </div>
                <div style={{ ...muted, marginTop: "4px" }}>{g.status}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ color: "#F97316", fontSize: "18px", fontWeight: 700 }}>{score}</div>
                <div style={{ ...muted, marginTop: "2px" }}>Gana: {winnerName(g)}</div>
              </div>
            </div>

            {open && (
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "14px",
                  borderTop: "1px solid #334155",
                  display: "grid",
                  gap: "10px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <DetailRow
                  label="Marcador"
                  value={`${g.away?.name} ${g.away?.score ?? "—"} · ${g.home?.name} ${
                    g.home?.score ?? "—"
                  }`}
                />
                <DetailRow
                  label="Total puntos"
                  value={g.totalPoints != null ? String(g.totalPoints) : "—"}
                />
                <DetailRow
                  label="Margen"
                  value={g.margin != null ? `${g.margin} pts` : "—"}
                />
                <DetailRow label="Ganador" value={winnerName(g)} />
              </div>
            )}
          </div>
        );
      })}

      {data?.pending?.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <div style={{ ...muted, marginBottom: "8px" }}>Aún no finalizados</div>
          {data.pending.map((g) => (
            <div key={g.gameId} style={{ ...cardStyle, cursor: "default", opacity: 0.75 }}>
              <div style={{ color: "#F1F5F9", fontSize: "14px" }}>
                {g.away?.name} @ {g.home?.name}
              </div>
              <div style={{ ...muted, marginTop: "4px" }}>{g.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: "8px",
        fontSize: "13px",
      }}
    >
      <div style={{ color: "#22D3EE" }}>{label}</div>
      <div style={{ color: "#F1F5F9" }}>{value}</div>
    </div>
  );
}
