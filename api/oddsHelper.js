// deprecated path — use lib/oddsHelper.js
export * from "../lib/oddsHelper.js";
export default async function handler(_req, res) {
  res.status(404).json({ error: "Not a route. Use lib/oddsHelper.js" });
}
