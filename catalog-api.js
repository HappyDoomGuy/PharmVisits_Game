const crypto = require("crypto");
const game = require("./game.js");

const SCHEMA = `CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

function tursoConfigured() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function httpUrl() {
  return String(process.env.TURSO_DATABASE_URL || "")
    .replace(/^libsql:\/\//, "https://")
    .replace(/\/$/, "");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cellValue(cell) {
  if (cell && typeof cell === "object" && "value" in cell) return cell.value;
  return cell;
}

async function turso(statements) {
  const response = await fetch(`${httpUrl()}/v2/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      requests: statements.map((item) => ({
        type: "execute",
        stmt: {
          sql: item.sql,
          args: (item.args || []).map((value) => ({ type: "text", value: String(value) })),
        },
      })).concat([{ type: "close" }]),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("turso");
  const results = body.results || [];
  results.forEach((result) => {
    if (result.type === "error") throw new Error("turso");
  });
  return results;
}

function storedPayload(results) {
  for (const result of results) {
    const rows = result.response?.result?.rows || result.result?.rows;
    if (!rows || !rows.length) continue;
    const row = rows[0];
    return cellValue(Array.isArray(row) ? row[0] : row);
  }
  return null;
}

async function readStored() {
  const results = await turso([
    { sql: SCHEMA },
    { sql: "SELECT payload FROM catalog WHERE id = 1" },
  ]);
  const raw = storedPayload(results);
  if (!raw) return null;
  return game.normalizeCatalog(JSON.parse(raw));
}

async function writeStored(catalog) {
  await turso([
    { sql: SCHEMA },
    {
      sql: `INSERT INTO catalog (id, payload, updated_at) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      args: [JSON.stringify(catalog), new Date().toISOString()],
    },
  ]);
}

function presentedPassword(token, body) {
  if (body && typeof body.password === "string") return body.password;
  return token || "";
}

async function handleCatalog(method, token, body) {
  if (method === "GET") {
    if (!tursoConfigured()) {
      return { status: 200, json: { catalog: game.defaultCatalog(), source: "default" } };
    }
    try {
      const stored = await readStored();
      if (!stored) return { status: 200, json: { catalog: game.defaultCatalog(), source: "empty" } };
      return { status: 200, json: { catalog: stored, source: "turso" } };
    } catch (error) {
      return {
        status: 200,
        json: { catalog: game.defaultCatalog(), source: "default", warning: "База недоступна, показан встроенный набор." },
      };
    }
  }

  if (method === "POST" || method === "PUT") {
    if (!process.env.ADMIN_PASS) {
      return { status: 503, json: { error: "Пароль админки не задан." } };
    }
    if (!safeEqual(presentedPassword(token, body), process.env.ADMIN_PASS)) {
      return { status: 401, json: { error: "Неверный пароль." } };
    }
  }

  if (method === "POST") {
    return { status: 200, json: { ok: true } };
  }

  if (method === "PUT") {
    if (!tursoConfigured()) {
      return { status: 503, json: { error: "Не заданы TURSO_DATABASE_URL и TURSO_AUTH_TOKEN." } };
    }
    const catalog = game.normalizeCatalog(body);
    if (!catalog) {
      return { status: 400, json: { error: "Нужны 4 названия и проценты 100, 50, 25 или 0." } };
    }
    try {
      await writeStored(catalog);
      return { status: 200, json: { catalog, source: "turso" } };
    } catch (error) {
      return { status: 502, json: { error: "Не удалось записать в Turso." } };
    }
  }

  return { status: 405, json: { error: "Метод не поддерживается." } };
}

const RESULT_TABLE = `CREATE TABLE IF NOT EXISTS day_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player TEXT NOT NULL,
  player_key TEXT NOT NULL,
  score INTEGER NOT NULL,
  finished_at TEXT NOT NULL
)`;
const RESULT_INDEX = "CREATE INDEX IF NOT EXISTS day_results_key ON day_results (player_key)";
const RESULT_PLAYER_INDEX = "CREATE INDEX IF NOT EXISTS day_results_player ON day_results (player_id)";
const PLAYERS_TABLE = `CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_locked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`;
const RESULT_SELECT = `SELECT
  d.identity,
  d.best,
  d.days,
  d.total,
  COALESCE(
    p.name,
    (
      SELECT player FROM day_results newer
      WHERE COALESCE(NULLIF(newer.player_id, ''), newer.player_key) = d.identity
      ORDER BY finished_at DESC, id DESC
      LIMIT 1
    )
  ) AS player
FROM (
  SELECT
    COALESCE(NULLIF(player_id, ''), player_key) AS identity,
    MAX(score) AS best,
    COUNT(*) AS days,
    SUM(score) AS total,
    MAX(player_id) AS player_id
  FROM day_results
  GROUP BY identity
) d
LEFT JOIN players p ON p.player_id = d.player_id`;

function cleanPlayer(name) {
  return String(name || "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

function playerKey(name) {
  return cleanPlayer(name).toLocaleLowerCase("ru");
}

function cleanPlayerId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) return "";
  return id;
}

async function ensureResults() {
  await turso([{ sql: RESULT_TABLE }, { sql: RESULT_INDEX }]);
  const info = await turso([{ sql: "PRAGMA table_info(day_results)" }]);
  const names = tableRows(info).map((cells) => String(cells[1]));
  if (!names.includes("player_id")) {
    await turso([{ sql: "ALTER TABLE day_results ADD COLUMN player_id TEXT" }]);
  }
  await turso([{ sql: RESULT_PLAYER_INDEX }, { sql: PLAYERS_TABLE }]);
  const players = await turso([{ sql: "PRAGMA table_info(players)" }]);
  const playerColumns = tableRows(players).map((cells) => String(cells[1]));
  if (!playerColumns.includes("name_locked")) {
    await turso([{ sql: "ALTER TABLE players ADD COLUMN name_locked INTEGER NOT NULL DEFAULT 0" }]);
  }
}

function cleanScore(value) {
  const score = Math.round(Number(value));
  if (!Number.isFinite(score) || score < 0 || score > 1800) return null;
  return score;
}

function tableRows(results) {
  const found = [];
  results.forEach((result) => {
    const rows = result.response?.result?.rows || result.result?.rows;
    if (!rows) return;
    rows.forEach((row) => {
      const cells = Array.isArray(row) ? row : Object.values(row);
      found.push(cells.map(cellValue));
    });
  });
  return found;
}

function byName(left, right) {
  return left.player.localeCompare(right.player, "ru");
}

function packBoard(sorted, valueOf, key) {
  const ranked = sorted.map((row, index) => ({
    name: row.player,
    value: valueOf(row),
    rank: index + 1,
    you: Boolean(key) && row.key === key,
  }));
  const top = ranked.slice(0, 20);
  const mine = ranked.find((row) => row.you);
  if (mine && mine.rank > 20) top.push(mine);
  return top;
}

async function readBoards(query) {
  await ensureResults();
  const results = await turso([{ sql: RESULT_SELECT }]);
  const rows = tableRows(results).map((cells) => ({
    key: String(cells[0] || ""),
    best: Number(cells[1]) || 0,
    days: Number(cells[2]) || 0,
    total: Number(cells[3]) || 0,
    player: String(cells[4] || ""),
  })).filter((row) => row.player);
  const key = cleanPlayerId(query && query.player) || playerKey(query && query.name);
  return {
    points: packBoard(rows.slice().sort((a, b) => b.best - a.best || byName(a, b)), (row) => row.best, key),
    days: packBoard(rows.slice().sort((a, b) => b.days - a.days || b.best - a.best || byName(a, b)), (row) => row.days, key),
    total: packBoard(rows.slice().sort((a, b) => b.total - a.total || b.days - a.days || byName(a, b)), (row) => row.total, key),
  };
}

async function readPlayer(playerId) {
  await ensureResults();
  const results = await turso([{
    sql: "SELECT name, name_locked FROM players WHERE player_id = ?",
    args: [playerId],
  }]);
  const rows = tableRows(results);
  if (!rows.length) return null;
  return {
    name: String(rows[0][0] || ""),
    locked: Number(rows[0][1]) === 1,
  };
}

async function savePlayer(playerId, player) {
  const existing = await readPlayer(playerId);
  if (existing && existing.locked) return existing;
  await turso([{
    sql: `INSERT INTO players (player_id, name, name_locked, updated_at) VALUES (?, ?, 0, ?)
      ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    args: [playerId, player, new Date().toISOString()],
  }]);
  return { name: player, locked: false };
}

async function writeResult(player, score, playerId) {
  const saved = await savePlayer(playerId, player);
  await turso([{
    sql: "INSERT INTO day_results (player, player_key, score, finished_at, player_id) VALUES (?, ?, ?, ?, ?)",
    args: [saved.name, playerKey(saved.name), score, new Date().toISOString(), playerId],
  }]);
  return saved;
}

const PLAYER_LIST = `SELECT
  p.player_id,
  p.name,
  COALESCE(p.name_locked, 0),
  COALESCE(s.days, 0),
  COALESCE(s.best, 0),
  COALESCE(s.total, 0)
FROM players p
LEFT JOIN (
  SELECT player_id, COUNT(*) AS days, MAX(score) AS best, SUM(score) AS total
  FROM day_results
  GROUP BY player_id
) s ON s.player_id = p.player_id
ORDER BY p.name COLLATE NOCASE`;

async function listPlayers() {
  await ensureResults();
  const results = await turso([{ sql: PLAYER_LIST }]);
  return tableRows(results).map((cells) => ({
    id: String(cells[0] || ""),
    name: String(cells[1] || ""),
    locked: Number(cells[2]) === 1,
    days: Number(cells[3]) || 0,
    best: Number(cells[4]) || 0,
    total: Number(cells[5]) || 0,
  })).filter((row) => row.id && row.name);
}

async function handlePlayers(method, token, body) {
  if (!process.env.ADMIN_PASS) {
    return { status: 503, json: { error: "Пароль админки не задан." } };
  }
  if (!safeEqual(presentedPassword(token, body), process.env.ADMIN_PASS)) {
    return { status: 401, json: { error: "Неверный пароль." } };
  }
  if (!tursoConfigured()) {
    return { status: 503, json: { error: "База результатов не настроена." } };
  }
  if (method === "GET") {
    try {
      return { status: 200, json: { players: await listPlayers() } };
    } catch (error) {
      return { status: 502, json: { error: "Не удалось прочитать участников." } };
    }
  }
  if (method !== "POST") return { status: 405, json: { error: "Метод не поддерживается." } };
  const action = String(body && body.action || "");
  const playerId = cleanPlayerId(body && body.playerId);
  try {
    if (action === "rename") {
      const name = cleanPlayer(body && body.name);
      if (!playerId || !name) return { status: 400, json: { error: "Нужны участник и имя." } };
      const existing = await readPlayer(playerId);
      if (!existing) return { status: 404, json: { error: "Участник не найден." } };
      await turso([{
        sql: "UPDATE players SET name = ?, updated_at = ? WHERE player_id = ?",
        args: [name, new Date().toISOString(), playerId],
      }]);
      return { status: 200, json: { ok: true } };
    }
    if (action === "lock") {
      if (!playerId || typeof (body && body.locked) !== "boolean") {
        return { status: 400, json: { error: "Нужны участник и запрет." } };
      }
      const existing = await readPlayer(playerId);
      if (!existing) return { status: 404, json: { error: "Участник не найден." } };
      await turso([{
        sql: "UPDATE players SET name_locked = ? WHERE player_id = ?",
        args: [body.locked ? "1" : "0", playerId],
      }]);
      return { status: 200, json: { ok: true } };
    }
    if (action === "delete") {
      if (!playerId) return { status: 400, json: { error: "Нужен участник." } };
      const existing = await readPlayer(playerId);
      if (!existing) return { status: 404, json: { error: "Участник не найден." } };
      await turso([{ sql: "DELETE FROM day_results WHERE player_id = ?", args: [playerId] }]);
      return { status: 200, json: { ok: true } };
    }
    if (action === "delete-all") {
      await ensureResults();
      await turso([{ sql: "DELETE FROM day_results" }]);
      return { status: 200, json: { ok: true } };
    }
    return { status: 400, json: { error: "Неизвестное действие." } };
  } catch (error) {
    return { status: 502, json: { error: "Не удалось изменить участников." } };
  }
}

async function handleResults(method, query, body) {
  if (!tursoConfigured()) {
    return { status: 503, json: { error: "База результатов не настроена." } };
  }
  if (method === "GET") {
    try {
      return { status: 200, json: await readBoards(query || {}) };
    } catch (error) {
      return { status: 502, json: { error: "Не удалось прочитать результаты." } };
    }
  }
  if (method === "POST") {
    const player = cleanPlayer(body && body.name);
    const playerId = cleanPlayerId(body && body.playerId);
    if (!player || !playerId) {
      return { status: 400, json: { error: "Нужны имя и идентификатор игрока." } };
    }
    const hasScore = body && Object.prototype.hasOwnProperty.call(body, "score");
    try {
      if (!hasScore) {
        const saved = await savePlayer(playerId, player);
        return { status: 200, json: { ok: true, name: saved.name, locked: saved.locked } };
      }
      const score = cleanScore(body.score);
      if (score == null) {
        return { status: 400, json: { error: "Нужны имя, баллы дня и идентификатор игрока." } };
      }
      const saved = await writeResult(player, score, playerId);
      return { status: 200, json: { ok: true, name: saved.name, locked: saved.locked } };
    } catch (error) {
      return { status: 502, json: { error: "Не удалось записать результат." } };
    }
  }
  return { status: 405, json: { error: "Метод не поддерживается." } };
}

module.exports = { handleCatalog, handleResults, handlePlayers };
