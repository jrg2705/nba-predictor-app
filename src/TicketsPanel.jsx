import { useState } from "react";

const STATUS_STYLE = {
  pending: { bg: "#475569", color: "#E2E8F0", label: "Pendiente" },
  win: { bg: "#10B981", color: "#fff", label: "Win" },
  loss: { bg: "#EF4444", color: "#fff", label: "Loss" },
};

function StatusBadge({ status, small }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: 8,
        padding: small ? "2px 8px" : "4px 10px",
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {s.label}
    </span>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TicketsPanel({ tickets, onUpdatePick, onDelete, onClear }) {
  const [openId, setOpenId] = useState(null);
  const open = tickets.find((t) => t.id === openId) || null;

  if (open) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => setOpenId(null)}
          style={{
            background: "transparent",
            border: "1px solid #334155",
            color: "#94A3B8",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          ← Volver a tickets
        </button>

        <div
          style={{
            background: "#1E293B",
            border: "1px solid #334155",
            borderRadius: 12,
            padding: 16,
            marginBottom: 14,
            position: "relative",
            paddingBottom: 44,
          }}
        >
          <div style={{ fontSize: 11, color: "#22D3EE", letterSpacing: "0.1em", marginBottom: 4 }}>
            TICKET #{open.sequence}
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{open.name}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>{formatDate(open.createdAt)}</div>
          <div style={{ position: "absolute", right: 14, bottom: 14 }}>
            <StatusBadge status={open.status} />
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 10 }}>
            {open.picks?.length || 0} picks · marca cada uno Win o Loss
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(open.picks || []).map((p) => (
            <div
              key={p.id}
              style={{
                background: "#1E293B",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: "14px 14px 40px",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#0B0F1A",
                    border: "1px solid #F97316",
                    color: "#F97316",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {p.index}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: "#64748B" }}>
                    {p.away} @ {p.home} · {p.marketLabel}
                    {p.usedAlternative ? " · alt" : ""}
                    {p.confidence != null ? ` · ${p.confidence}%` : ""}
                  </div>
                  <div style={{ fontWeight: 700, color: "#F97316", marginTop: 2 }}>{p.pickSummary}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    {["pending", "win", "loss"].map((st) => {
                      const active = p.status === st;
                      const col =
                        st === "win" ? "#10B981" : st === "loss" ? "#EF4444" : "#64748B";
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onUpdatePick(open.id, p.id, st)}
                          style={{
                            background: active ? col : "transparent",
                            color: active ? "#fff" : col,
                            border: `1px solid ${col}`,
                            borderRadius: 8,
                            padding: "5px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {st === "pending" ? "Pendiente" : st === "win" ? "Win" : "Loss"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ position: "absolute", right: 12, bottom: 10 }}>
                <StatusBadge status={p.status} small />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm("¿Borrar este ticket?")) {
              onDelete(open.id);
              setOpenId(null);
            }
          }}
          style={{
            marginTop: 16,
            background: "transparent",
            border: "1px solid #EF4444",
            color: "#EF4444",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            cursor: "pointer",
            width: "100%",
          }}
        >
          🗑 Borrar este ticket
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🎟 Tickets</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Creados desde Top Picks · Win solo si todos los picks ganan
          </div>
        </div>
        {tickets.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Borrar todos los tickets?")) onClear();
            }}
            style={{
              background: "transparent",
              border: "1px solid #EF4444",
              color: "#EF4444",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Borrar todos
          </button>
        )}
      </div>

      {tickets.length === 0 ? (
        <p style={{ color: "#64748B", textAlign: "center", fontSize: 13, marginTop: 40 }}>
          Aún no hay tickets.
          <br />
          Ve a <strong style={{ color: "#F97316" }}>Top Picks</strong>, genera picks y pulsa{" "}
          <strong style={{ color: "#F97316" }}>Crear ticket</strong>.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenId(t.id)}
              style={{
                background: "#1E293B",
                border: "1px solid #334155",
                borderRadius: 12,
                padding: "14px 14px 36px",
                textAlign: "left",
                cursor: "pointer",
                color: "#F1F5F9",
                position: "relative",
                width: "100%",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {t.name} · #{t.sequence}
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                {formatDate(t.createdAt)} · {t.picks?.length || 0} picks
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8 }}>
                {(t.picks || [])
                  .slice(0, 3)
                  .map((p) => p.pickSummary)
                  .join(" · ")}
                {(t.picks || []).length > 3 ? "…" : ""}
              </div>
              <div style={{ position: "absolute", right: 12, bottom: 10 }}>
                <StatusBadge status={t.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
