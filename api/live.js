import { neon } from "@neondatabase/serverless";
import { createLive } from "../lib/live.js";

let live = null;
function getLive() {
  if (live) return live;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);
  live = createLive((text, params = []) => sql.query(text, params), process.env.PRESENTER_KEY);
  return live;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const l = getLive();
  if (!l) return res.status(503).json({ error: "no_database" });
  try {
    const [status, body] = await l.handle({
      method: req.method,
      op: String(req.query.op || ""),
      body: typeof req.body === "string" ? safeParse(req.body) : req.body,
      key: req.headers["x-presenter-key"],
    });
    if (body === null) return res.status(status).end();
    return res.status(status).json(body);
  } catch (err) {
    console.error("live api error", err);
    return res.status(500).json({ error: "server" });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
