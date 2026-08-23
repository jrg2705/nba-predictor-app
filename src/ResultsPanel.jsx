// src/ResultsPanel.jsx — Resultados de jornadas NBA
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

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
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
          Partidos finalizados de la jornada. Cache local en el teléfono. Toca un partido para ver
          marcador, total y margen (ML / Spread / Total).
        </p>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "8px",
          }}
        >
          <label style={{ ...muted, display: "flex", alignItems: "center", gap: "8px" }}>
            Fecha
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #334155",
                background: "#0F172A",
                color: "#F1F5F9",
                fontSize: "14px",
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(yesterdayISO())}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #334155",
              background: "#0F172A",
              color: "#22D3EE",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Ayer
          </button>
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
          <div style={{ ...muted, textAlign: "center", marginTop: "6px" }}>
            {formatDateLabel(data.date)} · {data.totalFinal ?? data.games?.length ?? 0} finalizados
            {data.totalPending ? ` · ${data.totalPending} sin terminar` : ""}
            {fromCache ? " · cache local" : ""}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#3a1a1a",
            border: "1px solid #8b3a3a",
            color: "#f0a0a0",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "12px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <p style={{ textAlign: "center", color: "#94A3B8" }}>Cargando resultados…</p>
      )}

      {!loading && data && (!data.games || data.games.length === 0) && (
        <p style={{ textAlign: "center", color: "#94A3B8" }}>
          No hay partidos finalizados para esta fecha (offseason o sin datos).
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
            style={{ ...cardStyle, borderColor: open ? "#22D3EE" : "#334155" }}
          >
            <div
              onClick={() => setSelectedId(open ? null : g.gameId)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
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
                  value={`${g.away?.name} ${g.away?.score ?? "—"} · ${g.home?.name} ${g.home?.score ?? "—"}`}
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
