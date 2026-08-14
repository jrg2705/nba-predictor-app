// src/BookLinesPanel.jsx — Subir / pegar líneas de banca NBA
import { useRef, useState } from "react";
import { parseBookLines } from "./bookLines.js";

const panelStyle = {
  background: "#1E293B",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "16px",
};

export default function BookLinesPanel({ bookLines, onBookLinesChange }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [localError, setLocalError] = useState("");
  const [fileName, setFileName] = useState("");

  const games = bookLines?.games || [];
  const loaded = games.length > 0;

  const applyText = (text, name = "") => {
    const parsed = parseBookLines(text);
    if (parsed.games.length === 0 && parsed.errors.length > 0) {
      setLocalError(parsed.errors[0] || "No se pudo leer el archivo");
      return;
    }
    setLocalError("");
    setFileName(name || "texto pegado");
    onBookLinesChange(parsed);
    setOpen(true);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      applyText(text, file.name);
    } catch {
      setLocalError("No se pudo leer el archivo");
    }
    e.target.value = "";
  };

  const handlePasteLoad = () => {
    if (!pasteText.trim()) {
      setLocalError("Pega el contenido del .txt primero");
      return;
    }
    applyText(pasteText, "pegado");
  };

  const handleClear = () => {
    onBookLinesChange({ date: null, games: [], errors: [] });
    setPasteText("");
    setFileName("");
    setLocalError("");
  };

  const fmtOdds = (n) => {
    if (n == null) return "—";
    return n > 0 ? `+${n}` : String(n);
  };

  return (
    <div style={panelStyle}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          width: "100%",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#F1F5F9" }}>
          📋 Líneas de la banca{" "}
          {loaded ? (
            <span style={{ color: "#10B981", fontWeight: 600 }}>
              · {games.length} partido{games.length !== 1 ? "s" : ""}
              {bookLines.date ? ` · ${bookLines.date}` : ""}
            </span>
          ) : (
            <span style={{ color: "#64748B", fontWeight: 400 }}>· opcional</span>
          )}
        </span>
        <span style={{ color: "#22D3EE", fontSize: "12px" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: "14px" }}>
          <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 12px", lineHeight: 1.45 }}>
            Sube o pega el .txt de la pizarra. Sin líneas la app funciona igual; con ellas el análisis
            usa <strong style={{ color: "#F97316" }}>tus números</strong> (spread, total, TT, 1H).
            <br />
            Formato:{" "}
            <code style={{ color: "#22D3EE", fontSize: 10 }}>
              away|home|mlA|mlH|spreadLocal|total|ttAway|ttHome|hTotal|hSpread
            </code>
          </p>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                border: "none",
                color: "#0B0F1A",
                borderRadius: "8px",
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📁 Subir .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            {loaded && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  background: "transparent",
                  border: "1px solid #EF4444",
                  color: "#EF4444",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                🗑️ Quitar
              </button>
            )}
          </div>

          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "10px", color: "#22D3EE", letterSpacing: "0.1em", marginBottom: "6px" }}>
              O PEGAR TEXTO
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"# FECHA: 2026-10-22\nATL|BKN|+150|-170|-3.5|224.5|110.5|114.5|112.5|-2"}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0F172A",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#F1F5F9",
                padding: "10px",
                fontSize: "11px",
                fontFamily: "ui-monospace, monospace",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={handlePasteLoad}
              style={{
                marginTop: "8px",
                background: "#0F172A",
                border: "1px solid #22D3EE",
                color: "#22D3EE",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cargar texto pegado
            </button>
          </div>

          {localError && (
            <p style={{ color: "#EF4444", fontSize: "12px", margin: "0 0 8px" }}>{localError}</p>
          )}

          {bookLines?.errors?.length > 0 && (
            <p style={{ color: "#F97316", fontSize: "11px", margin: "0 0 8px" }}>
              Avisos: {bookLines.errors.slice(0, 3).join(" · ")}
              {bookLines.errors.length > 3 ? "…" : ""}
            </p>
          )}

          {loaded && (
            <div style={{ marginTop: "8px" }}>
              <div style={{ fontSize: "11px", color: "#10B981", marginBottom: "6px" }}>
                ✅ Cargado desde {fileName}
                {bookLines.date ? ` · Fecha: ${bookLines.date}` : ""}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  maxHeight: "180px",
                  overflowY: "auto",
                }}
              >
                {games.map((g, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "11px",
                      color: "#CBD5E1",
                      background: "#0F172A",
                      borderRadius: "6px",
                      padding: "6px 10px",
                    }}
                  >
                    <strong style={{ color: "#F1F5F9" }}>
                      {g.away} @ {g.home}
                    </strong>
                    {" · "}
                    ML {fmtOdds(g.mlAway)}/{fmtOdds(g.mlHome)}
                    {g.spreadHome != null && ` · SP ${g.home.split(" ").slice(-1)[0]} ${g.spreadHome}`}
                    {g.total != null && ` · OU ${g.total}`}
                    {g.ttHome != null && ` · TT L ${g.ttHome}`}
                    {g.ttAway != null && ` · TT V ${g.ttAway}`}
                    {g.hTotal != null && ` · 1H ${g.hTotal}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
