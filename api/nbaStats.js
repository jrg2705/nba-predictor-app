// api/nbaStats.js — reexport desde lib + default para Vercel
export {
  buildRealStats,
} from "../lib/nbaStats.js";

export default async function handler(_req, res) {
  res.status(404).json({ error: "Helper module, not a route" });
}
