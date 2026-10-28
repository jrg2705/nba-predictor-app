/** Tarjeta visual Elo + edge vs ML dentro del análisis */
export default function EloPanel({ elo, eloMeta }) {
  if (!elo) return null;

  const edgeColor = (v) => {
    if (v == null) return "#64748B";
    if (v >= 3) return "#10B981";
    if (v <= -3) return "#F97316";
    return "#94A3B8";
  };

  const fmtEdge = (v) => {
    if (v == null) return "—";
    const sign = v > 0 ? "+" : "";
    return `${sign}${v}%`;
  };

  const sourceLabel =
    eloMeta?.source === "priors+season-replay"
      ? `calibrado · ${eloMeta.gamesApplied ?? 0} partidos`
      : eloMeta?.source === "priors-only"
        ? "priors pretemporada"
        : eloMeta?.source || "Elo";

  return (
    <div
      style={{
        background: "#1E293B",
        border: "1px solid #8B5CF6",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: 12,
        color: "#CBD5E1",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 11, color: "#A78BFA", fontWeight: 700, letterSpacing: "0.06em" }}>
          📊 ELO · EDGE VS MERCADO
        </div>
        <div style={{ fontSize: 10, color: "#64748B" }}>{sourceLabel}</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 8,
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "#22D3EE" }}>VISITANTE</div>
          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 13 }}>{elo.away}</div>
          <div style={{ color: "#A78BFA", fontWeight: 700 }}>{elo.eloAway}</div>
        </div>
        <div style={{ textAlign: "center", color: "#64748B", fontSize: 11 }}>
          diff
          <div style={{ color: "#E2E8F0", fontWeight: 700 }}>
            {elo.eloDiff >= 0 ? "+" : ""}
            {elo.eloDiff}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "#F97316" }}>LOCAL</div>
          <div style={{ fontWeight: 700, color: "#F1F5F9", fontSize: 13 }}>{elo.home}</div>
          <div style={{ color: "#A78BFA", fontWeight: 700 }}>{elo.eloHome}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            background: "#0B0F1A",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>
            P(win) Elo · local +{elo.homeAdv}
          </div>
          <div style={{ fontWeight: 700 }}>
            <span style={{ color: "#22D3EE" }}>{elo.pAwayWin}%</span>
            <span style={{ color: "#475569" }}> / </span>
            <span style={{ color: "#F97316" }}>{elo.pHomeWin}%</span>
          </div>
          <div style={{ fontSize: 10, color: "#64748B" }}>visitante / local</div>
        </div>
        <div
          style={{
            background: "#0B0F1A",
            borderRadius: 8,
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: 10, color: "#64748B", marginBottom: 2 }}>Edge vs ML</div>
          {elo.impliedHomePct != null ? (
            <>
              <div style={{ fontWeight: 700 }}>
                <span style={{ color: edgeColor(elo.edgeAwayPct) }}>{fmtEdge(elo.edgeAwayPct)}</span>
                <span style={{ color: "#475569" }}> / </span>
                <span style={{ color: edgeColor(elo.edgeHomePct) }}>{fmtEdge(elo.edgeHomePct)}</span>
              </div>
              <div style={{ fontSize: 10, color: "#64748B" }}>
                ML {elo.mlAway ?? "—"} / {elo.mlHome ?? "—"}
              </div>
            </>
          ) : (
            <div style={{ color: "#64748B", fontSize: 11 }}>Sin líneas ML para edge</div>
          )}
        </div>
      </div>

      {eloMeta?.warning && (
        <div style={{ fontSize: 10, color: "#F97316", marginTop: 4 }}>{eloMeta.warning}</div>
      )}
      <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
        Verde ≥ +3% edge · refuerza ML/spread si las stats no contradicen. Elo no manda en totales.
      </div>
    </div>
  );
}
