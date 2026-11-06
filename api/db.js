// deprecated path — use lib/db.js
export * from "../lib/db.js";
export default async function handler(_req, res) {
  res.status(404).json({ error: "Not a route. Use lib/db.js" });
}
