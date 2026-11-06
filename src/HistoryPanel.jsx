// src/HistoryPanel.jsx — Historial con filtro por fecha + export CSV (Neon) · panel-v2
import { useState, useEffect } from "react";
import {
  MAX_HISTORY,
  loadHistory,
  clearHistory,
  fetchHistoryFromApi,
  migrateLocalToNeon,
  historyExportUrl,
} from "./historyStorage.js";

export default function HistoryPanel({
  history,
  setHistory,
  onOpenEntry,
  todayCount = 0,
  onExportToday,
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbTotal, setDbTotal] = useState(null);
  const [dbConfigured, setDbConfigured] = useState(null);
  const [msg, setMsg] = useState("");
  const [source, setSource] = useState("local");

  const load = async (opts = {}) => {
    setLoading(true);
    setMsg("");
    try {
      const result = await fetchHistoryFromApi({
        limit: 40,
        from: opts.from ?? (from || null),
        to: opts.to ?? (to || null),
      });
      if (result.ok && result.configured !== false) {
        setDbConfigured(true);
        setDbTotal(result.total);
        setHistory(result.entries);
        setSource("neon");
        if (result.entries.length === 0) {
          setMsg(from || to ? "No hay entradas en ese rango de fechas." : "Historial Neon vacío.");
        }
      } else if (result.configured === false) {
        setDbConfigured(false);
        setHistory(loadHistory());
        setSource("local");
        setMsg("Neon no configurado: usando historial local (máx 40). Añade DATABASE_URL en Vercel.");
      } else {
        setHistory(loadHistory());
        setSource("local");
        setMsg(result.error || "No se pudo leer Neon; mostrando local.");
      }
    } catch (e) {
      setHistory(loadHistory());
      setSource("local");
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = (e) => {
    e?.preventDefault?.();
    load({ from: from || null, to: to || null });
  };

  const handleClearFilter = () => {
    setFrom("");
    setTo("");
    load({ from: null, to: null });
  };

  const handleMigrate = async () => {
    setMsg("Subiendo historial local a Neon…");
    const r = await migrateLocalToNeon(loadHistory());
    setMsg(`Migración: ${r.ok} ok · ${r.fail} fallos de ${r.total}`);
    await load();
  };

  const handleExportCsv = () => {
    const url = historyExportUrl({ from: from || null, to: to || null });
    window.open(url, "_blank");
  };

  const handleClearLocal = () => {
    clearHistory();
    if (source === "local") setHistory([]);
    setMsg("Historial local borrado (Neon no se tocó).");
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>🕓 Historial</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {todayCount > 0 && onExportToday && (
            <button
              onClick={onExportToday}
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
              📄 Exportar hoy (.txt)
            </button>
          )}
          <button
            onClick={handleExportCsv}
            style={{
              background: "#1E293B",
              border: "1px solid #A78BFA",
              color: "#A78BFA",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Requiere DATABASE_URL (Neon)"
          >
            📊 Export CSV
          </button>
          <button
            onClick={handleClearLocal}
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
            🗑️ Local
          </button>
        </div>
      </div>

      <p style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
        {source === "neon" ? (
          <>
            Neon · mostrando {history.length} de {dbTotal ?? "?"} · vista máx {MAX_HISTORY}
          </>
        ) : (
          <>Solo local en este dispositivo · Máx {MAX_HISTORY}</>
        )}
      </p>

      <form
        onSubmit={handleFilter}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "flex-end",
          marginBottom: 12,
          background: "#1E293B",
          border: "1px solid #334155",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <label style={{ fontSize: 11, color: "#94A3B8" }}>
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{
              display: "block",
              marginTop: 4,
              background: "#0B0F1A",
              border: "1px solid #334155",
              color: "#F1F5F9",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
            }}
          />
        </label>
        <label style={{ fontSize: 11, color: "#94A3B8" }}>
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{
              display: "block",
              marginTop: 4,
              background: "#0B0F1A",
              border: "1px solid #334155",
              color: "#F1F5F9",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            background: "#F97316",
            color: "#0B0F1A",
            border: "none",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Filtrar
        </button>
        <button
          type="button"
          onClick={handleClearFilter}
          style={{
            background: "transparent",
            border: "1px solid #64748B",
            color: "#94A3B8",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => load()}
          style={{
            background: "transparent",
            border: "1px solid #22D3EE",
            color: "#22D3EE",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          🔄
        </button>
      </form>

      {dbConfigured === false && (
        <div
          style={{
            fontSize: 12,
            color: "#F97316",
            marginBottom: 12,
            padding: 10,
            background: "#1E293B",
            borderRadius: 8,
            border: "1px solid #F97316",
          }}
        >
          Para historial ilimitado: crea proyecto en{" "}
          <a href="https://neon.tech" target="_blank" rel="noreferrer" style={{ color: "#22D3EE" }}>
            neon.tech
          </a>
          , copia la connection string y ponla en Vercel como <code>DATABASE_URL</code>.
        </div>
      )}

      {dbConfigured && loadHistory().length > 0 && (
        <button
          onClick={handleMigrate}
          style={{
            marginBottom: 12,
            background: "#1E293B",
            border: "1px solid #334155",
            color: "#CBD5E1",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ☁️ Subir historial local a Neon
        </button>
      )}

      {msg && <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 10 }}>{msg}</p>}
      {loading && <p style={{ textAlign: "center", color: "#64748B", padding: 20 }}>Cargando…</p>}

      {!loading && history.length === 0 && (
        <p style={{ textAlign: "center", color: "#64748B", padding: 40 }}>Aún no hay predicciones.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((entry) => (
          <div
            key={entry.id || entry.dbId || `${entry.home}-${entry.away}-${entry.date}`}
            onClick={() => onOpenEntry?.(entry)}
            style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 12,
                color: "#64748B",
              }}
            >
              <span>
                {entry.date
                  ? new Date(entry.date).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
              {entry.verified && <span style={{ color: "#10B981" }}>✓ verificado</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {entry.away} <span style={{ color: "#F97316" }}>@</span> {entry.home}
            </div>
            {entry.analysis?.best_method && (
              <div style={{ fontSize: 12, color: "#22D3EE", marginTop: 4 }}>
                🏆 {entry.analysis.best_method.pick_summary}{" "}
                <span style={{ color: "#94A3B8" }}>
                  ({entry.analysis.best_method.confidence_pct}%)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
