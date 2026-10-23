export const TICKETS_KEY = "nba_predictor_tickets";
export const MAX_TICKETS = 80;

export function loadTickets() {
  try {
    const raw = localStorage.getItem(TICKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(list) {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(list.slice(0, MAX_TICKETS)));
  return list.slice(0, MAX_TICKETS);
}

function dayKeyFromIso(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Estado del ticket: pendiente si alguno pendiente; win solo si todos win; loss si alguno loss. */
export function computeTicketStatus(picks) {
  if (!picks?.length) return "pending";
  if (picks.some((p) => p.status === "pending")) return "pending";
  if (picks.every((p) => p.status === "win")) return "win";
  return "loss";
}

/**
 * Crea un ticket desde los Top Picks generados.
 * Todos los picks y el ticket arrancan en "pending".
 */
export function createTicketFromPicks(generatedPicks) {
  if (!generatedPicks?.length) {
    return { list: loadTickets(), ticket: null, error: "No hay picks para crear ticket" };
  }

  const now = new Date().toISOString();
  const dayKey = dayKeyFromIso(now);
  const list = loadTickets();
  const sameDay = list.filter((t) => t.dayKey === dayKey);
  const sequence = sameDay.length + 1;

  const picks = generatedPicks.map((p, idx) => ({
    id: `p-${Date.now()}-${idx}`,
    index: idx + 1,
    home: p.entry?.home || p.home || "",
    away: p.entry?.away || p.away || "",
    market: p.market || "",
    marketLabel: p.marketLabel || p.market || "",
    pickSummary: p.pickSummary || "",
    confidence: p.confidence ?? null,
    usedAlternative: !!p.usedAlternative,
    status: "pending",
  }));

  const ticket = {
    id: `t-${Date.now()}`,
    name: "Tickets",
    createdAt: now,
    dayKey,
    sequence,
    status: "pending",
    picks,
  };

  const next = [ticket, ...list];
  return { list: saveAll(next), ticket, error: null };
}

export function updatePickStatus(ticketId, pickId, status) {
  const list = loadTickets();
  const next = list.map((t) => {
    if (t.id !== ticketId) return t;
    const picks = (t.picks || []).map((p) =>
      p.id === pickId ? { ...p, status } : p
    );
    return {
      ...t,
      picks,
      status: computeTicketStatus(picks),
    };
  });
  return saveAll(next);
}

export function deleteTicket(ticketId) {
  const list = loadTickets().filter((t) => t.id !== ticketId);
  return saveAll(list);
}

export function clearTickets() {
  localStorage.removeItem(TICKETS_KEY);
  return [];
}
