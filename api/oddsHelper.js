// api/oddsHelper.js — reexport desde lib + default para Vercel
export {
  fetchOddsForMatchup,
  fetchAllNbaOdds,
} from "../lib/oddsHelper.js";

export default async function handler(_req, res) {
  res.status(404).json({ error: "Helper module, not a route" });
}
