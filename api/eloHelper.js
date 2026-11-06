// deprecated path — use lib/eloHelper.js
export * from "../lib/eloHelper.js";
export default async function handler(_req, res) {
  res.status(404).json({ error: "Not a route. Use lib/eloHelper.js" });
}
