// Shared logic for the live session: one presenter, many phones.
// `query(text, params)` runs SQL and resolves to an array of rows.
import { timingSafeEqual } from "node:crypto";

const PID = /^[a-z0-9]{4,16}$/;
const ONLINE_MS = 90_000;
const MAX_PRESENCE_BYTES = 1024;
const MAX_STATE_BYTES = 8192;

export function createLive(query, presenterKey) {
  let ready = null;
  function init() {
    ready ??= (async () => {
      await query(`create table if not exists live_state (
        id int primary key, state jsonb not null, set_at bigint not null, reset_at bigint not null default 0)`);
      await query(`create table if not exists live_presence (
        pid text primary key, data jsonb not null, updated_at bigint not null)`);
      await query(`insert into live_state (id, state, set_at) values (1, '{}', 0) on conflict (id) do nothing`);
    })().catch((e) => { ready = null; throw e; });
    return ready;
  }

  function isPresenter(header) {
    if (!presenterKey || typeof header !== "string") return false;
    const a = Buffer.from(header), b = Buffer.from(presenterKey);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Returns [status, body]. body null means 204.
  async function handle({ method, op, body, key }) {
    await init();
    const now = Date.now();

    if (op === "state" && method === "GET") {
      const [row] = await query(`select state, set_at from live_state where id = 1`);
      return [200, { state: row.state, setAt: Number(row.set_at), now }];
    }

    if (op === "presence" && method === "POST") {
      const pid = body?.pid, data = body?.data;
      if (typeof pid !== "string" || !PID.test(pid)) return [400, { error: "bad_pid" }];
      if (!data || typeof data !== "object" || Array.isArray(data)) return [400, { error: "bad_data" }];
      const json = JSON.stringify(data);
      if (Buffer.byteLength(json) > MAX_PRESENCE_BYTES) return [413, { error: "too_large" }];
      await query(
        `insert into live_presence (pid, data, updated_at) values ($1, $2::jsonb, $3)
         on conflict (pid) do update set data = excluded.data, updated_at = excluded.updated_at`,
        [pid, json, now]);
      return [204, null];
    }

    if (!isPresenter(key)) return [401, { error: "presenter_key" }];

    if (op === "check" && method === "GET") return [200, { ok: true }];

    if (op === "state" && method === "POST") {
      const state = body?.state;
      if (!state || typeof state !== "object") return [400, { error: "bad_state" }];
      const json = JSON.stringify(state);
      if (Buffer.byteLength(json) > MAX_STATE_BYTES) return [413, { error: "too_large" }];
      await query(`update live_state set state = $1::jsonb, set_at = $2 where id = 1`, [json, now]);
      return [204, null];
    }

    if (op === "peers" && method === "GET") {
      const rows = await query(
        `select p.pid, p.data from live_presence p, live_state s
         where s.id = 1 and p.updated_at > greatest(s.reset_at, $1)`,
        [now - ONLINE_MS]);
      return [200, { peers: rows, now }];
    }

    if (op === "reset" && method === "POST") {
      await query(`delete from live_presence`);
      await query(`update live_state set state = '{}', set_at = $1, reset_at = $1 where id = 1`, [now]);
      return [204, null];
    }

    return [404, { error: "unknown_op" }];
  }

  return { handle };
}
