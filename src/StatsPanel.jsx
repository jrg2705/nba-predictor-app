// src/StatsPanel.jsx — Panel de stats reales (balldontlie)
export default function StatsPanel({ realStats }) {
  if (!realStats || (!realStats.home && !realStats.away && !realStats.warning)) {
    return null;
  }

  return (
    <div
      style={{
        background: "#1E293B",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: 12,
        color: "#CBD5E1",
      }}
    >
      <div style={{ fontSize: 11, color: "#22D3EE", fontWeight: 700, marginBottom: 6 }}>
        📊 STATS REALES {realStats.source ? `(${realStats.source})` : ""}
        {realStats.season != null && (
          <span style={{ color: "#64748B", fontWeight: 500 }}> · temp. {realStats.season}</span>
        )}
      </div>
      {realStats.warning && (
        <div style={{ color: "#F97316", marginBottom: 6 }}>{realStats.warning}</div>
      )}
      {realStats.home && (
        <div style={{ marginBottom: 4 }}>
          <strong style={{ color: "#F97316" }}>{realStats.home.team}</strong>
          {realStats.home.record_L10 && ` · L10 ${realStats.home.record_L10}`}
          {realStats.home.avg_pts != null && ` · ${realStats.home.avg_pts} pts`}
          {realStats.home.avg_pts_allowed != null && ` · def ${realStats.home.avg_pts_allowed}`}
          {realStats.home.avg_game_total != null && ` · tot ${realStats.home.avg_game_total}`}
          {realStats.home.rest_days != null && ` · rest ${realStats.home.rest_days}d`}
        </div>
      )}
      {realStats.away && (
        <div style={{ marginBottom: 4 }}>
          <strong style={{ color: "#22D3EE" }}>{realStats.away.team}</strong>
          {realStats.away.record_L10 && ` · L10 ${realStats.away.record_L10}`}
          {realStats.away.avg_pts != null && ` · ${realStats.away.avg_pts} pts`}
          {realStats.away.avg_pts_allowed != null && ` · def ${realStats.away.avg_pts_allowed}`}
          {realStats.away.avg_game_total != null && ` · tot ${realStats.away.avg_game_total}`}
          {realStats.away.rest_days != null && ` · rest ${realStats.away.rest_days}d`}
        </div>
      )}
      {realStats.h2h && realStats.h2h.games > 0 && (
        <div style={{ color: "#94A3B8", marginTop: 4 }}>
          H2H: {realStats.h2h.homeWins}-{realStats.h2h.awayWins} ({realStats.h2h.games} juegos)
          {realStats.h2h.recent?.length > 0 && (
            <span style={{ display: "block", fontSize: 11, marginTop: 2 }}>
              {realStats.h2h.recent.slice(0, 3).map((g) => g.score).join(" · ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
