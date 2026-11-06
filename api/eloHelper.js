// api/eloHelper.js — reexport desde lib + default para Vercel
export {
  ELO_K,
  ELO_HOME_ADV,
  ELO_BASE,
  ELO_PRIORS,
  expectedScore,
  updateElo,
  americanToImpliedProb,
  homeWinProb,
  replaySeason,
  buildCurrentElo,
  eloMatchupContext,
  formatEloBlock,
} from "../lib/eloHelper.js";

export default async function handler(_req, res) {
  res.status(404).json({ error: "Helper module, not a route" });
}
