// deprecated path — use lib/nbaStats.js
export * from "../lib/nbaStats.js";
export default async function handler(_req, res) {
  res.status(404).json({ error: "Not a route. Use lib/nbaStats.js" });
}
