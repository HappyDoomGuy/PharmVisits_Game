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
  updated_at TEXT NOT NULL,
  best INTEGER NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0
)`;
const META_TABLE = `CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;
const PLAYER_COLUMNS = "player_id, best, days, total, name";
const BOARD_SPECS = [
  {
    id: "points",
    value: (row) => row.best,
    top: `SELECT ${PLAYER_COLUMNS} FROM players WHERE days > 0 ORDER BY best DESC, name ASC, player_id ASC LIMIT 20`,
    ahead: `SELECT COUNT(*) FROM players WHERE days > 0 AND (
      best > CAST(? AS INTEGER)
      OR (best = CAST(? AS INTEGER) AND name < ?)
      OR (best = CAST(? AS INTEGER) AND name = ? AND player_id < ?)
    )`,
    aheadArgs: (row) => [row.best, row.best, row.player, row.best, row.player, row.key],
  },
  {
    id: "days",
    value: (row) => row.days,
    top: `SELECT ${PLAYER_COLUMNS} FROM players WHERE days > 0 ORDER BY days DESC, best DESC, name ASC, player_id ASC LIMIT 20`,
    ahead: `SELECT COUNT(*) FROM players WHERE days > 0 AND (
      days > CAST(? AS INTEGER)
      OR (days = CAST(? AS INTEGER) AND best > CAST(? AS INTEGER))
      OR (days = CAST(? AS INTEGER) AND best = CAST(? AS INTEGER) AND name < ?)
      OR (days = CAST(? AS INTEGER) AND best = CAST(? AS INTEGER) AND name = ? AND player_id < ?)
    )`,
    aheadArgs: (row) => [row.days, row.days, row.best, row.days, row.best, row.player, row.days, row.best, row.player, row.key],
  },
  {
    id: "total",
    value: (row) => row.total,
    top: `SELECT ${PLAYER_COLUMNS} FROM players WHERE days > 0 ORDER BY total DESC, days DESC, name ASC, player_id ASC LIMIT 20`,
    ahead: `SELECT COUNT(*) FROM players WHERE days > 0 AND (
      total > CAST(? AS INTEGER)
      OR (total = CAST(? AS INTEGER) AND days > CAST(? AS INTEGER))
      OR (total = CAST(? AS INTEGER) AND days = CAST(? AS INTEGER) AND name < ?)
      OR (total = CAST(? AS INTEGER) AND days = CAST(? AS INTEGER) AND name = ? AND player_id < ?)
    )`,
    aheadArgs: (row) => [row.total, row.total, row.days, row.total, row.days, row.player, row.total, row.days, row.player, row.key],
  },
];
const BOARD_INDEXES = [
  "CREATE INDEX IF NOT EXISTS players_board_best ON players (best DESC, name, player_id) WHERE days > 0",
  "CREATE INDEX IF NOT EXISTS players_board_days ON players (days DESC, best DESC, name, player_id) WHERE days > 0",
  "CREATE INDEX IF NOT EXISTS players_board_total ON players (total DESC, days DESC, name, player_id) WHERE days > 0",
];
let resultsReady = false;

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
  if (resultsReady) return;
  await turso([{ sql: RESULT_TABLE }, { sql: RESULT_INDEX }]);
  const info = await turso([{ sql: "PRAGMA table_info(day_results)" }]);
  const names = tableRows(info).map((cells) => String(cells[1]));
  if (!names.includes("player_id")) {
    await turso([{ sql: "ALTER TABLE day_results ADD COLUMN player_id TEXT" }]);
  }
  await turso([{ sql: RESULT_PLAYER_INDEX }, { sql: PLAYERS_TABLE }, { sql: META_TABLE }]);
  const players = await turso([{ sql: "PRAGMA table_info(players)" }]);
  const playerColumns = tableRows(players).map((cells) => String(cells[1]));
  if (!playerColumns.includes("name_locked")) {
    await turso([{ sql: "ALTER TABLE players ADD COLUMN name_locked INTEGER NOT NULL DEFAULT 0" }]);
  }
  const addedStats = [];
  if (!playerColumns.includes("best")) addedStats.push("ALTER TABLE players ADD COLUMN best INTEGER NOT NULL DEFAULT 0");
  if (!playerColumns.includes("days")) addedStats.push("ALTER TABLE players ADD COLUMN days INTEGER NOT NULL DEFAULT 0");
  if (!playerColumns.includes("total")) addedStats.push("ALTER TABLE players ADD COLUMN total INTEGER NOT NULL DEFAULT 0");
  if (addedStats.length) await turso(addedStats.map((sql) => ({ sql })));
  const ready = await turso([{ sql: "SELECT value FROM app_meta WHERE key = 'player_stats'" }]);
  if (!tableRows(ready).length) await backfillPlayerStats();
  await turso(BOARD_INDEXES.map((sql) => ({ sql })));
  resultsReady = true;
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

function mapPlayerRows(cellsRows) {
  return cellsRows.map((cells) => ({
    key: String(cells[0] || ""),
    best: Number(cells[1]) || 0,
    days: Number(cells[2]) || 0,
    total: Number(cells[3]) || 0,
    player: String(cells[4] || ""),
  })).filter((row) => row.key && row.player);
}

function boardEntries(rows, valueOf, key, extra) {
  const ranked = rows.map((row, index) => ({
    name: row.player,
    value: valueOf(row),
    rank: index + 1,
    you: Boolean(key) && row.key === key,
  }));
  if (extra && !ranked.some((row) => row.you)) ranked.push(extra);
  return ranked;
}

async function backfillPlayerStats() {
  const results = await turso([{
    sql: `SELECT player_id, MAX(score), COUNT(*), SUM(score)
      FROM day_results
      WHERE player_id IS NOT NULL AND player_id != ''
      GROUP BY player_id`,
  }]);
  const updates = tableRows(results).map((cells) => ({
    sql: "UPDATE players SET best = ?, days = ?, total = ? WHERE player_id = ?",
    args: [cells[1], cells[2], cells[3], cells[0]],
  }));
  updates.push({
    sql: "INSERT INTO app_meta (key, value) VALUES ('player_stats', '1') ON CONFLICT(key) DO UPDATE SET value = '1'",
  });
  await turso(updates);
}

async function readBoards(query) {
  await ensureResults();
  const key = cleanPlayerId(query && query.player);
  const statements = BOARD_SPECS.map((board) => ({ sql: board.top }));
  if (key) {
    statements.push({
      sql: `SELECT ${PLAYER_COLUMNS} FROM players WHERE player_id = ? AND days > 0`,
      args: [key],
    });
  }
  const results = await turso(statements);
  const lists = BOARD_SPECS.map((_, index) => mapPlayerRows(tableRows([results[index]])));
  const mine = key ? mapPlayerRows(tableRows([results[BOARD_SPECS.length]]))[0] : null;
  const missing = mine
    ? BOARD_SPECS.map((board, index) => !lists[index].some((row) => row.key === key))
    : BOARD_SPECS.map(() => false);
  let ahead = BOARD_SPECS.map(() => 0);
  if (mine && missing.some(Boolean)) {
    const counted = await turso(BOARD_SPECS.filter((_, index) => missing[index]).map((board) => ({
      sql: board.ahead,
      args: board.aheadArgs(mine),
    })));
    let cursor = 0;
    ahead = missing.map((needsRank) => {
      if (!needsRank) return 0;
      const count = Number(tableRows([counted[cursor]])[0]?.[0]) || 0;
      cursor += 1;
      return count;
    });
  }
  const packed = {};
  BOARD_SPECS.forEach((board, index) => {
    const extra = mine && missing[index]
      ? { name: mine.player, value: board.value(mine), rank: ahead[index] + 1, you: true }
      : null;
    packed[board.id] = boardEntries(lists[index], board.value, key, extra);
  });
  return packed;
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
  const now = new Date().toISOString();
  await turso([
    {
      sql: "INSERT INTO day_results (player, player_key, score, finished_at, player_id) VALUES (?, ?, ?, ?, ?)",
      args: [saved.name, playerKey(saved.name), score, now, playerId],
    },
    {
      sql: `UPDATE players
        SET best = MAX(best, CAST(? AS INTEGER)),
            days = days + 1,
            total = total + CAST(? AS INTEGER),
            updated_at = ?
        WHERE player_id = ?`,
      args: [score, score, now, playerId],
    },
  ]);
  return saved;
}

const PLAYER_LIST = `SELECT
  player_id,
  name,
  COALESCE(name_locked, 0),
  COALESCE(days, 0),
  COALESCE(best, 0),
  COALESCE(total, 0)
FROM players
ORDER BY name COLLATE NOCASE`;

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
      await turso([
        { sql: "DELETE FROM day_results WHERE player_id = ?", args: [playerId] },
        { sql: "UPDATE players SET best = 0, days = 0, total = 0 WHERE player_id = ?", args: [playerId] },
      ]);
      return { status: 200, json: { ok: true } };
    }
    if (action === "delete-all") {
      await ensureResults();
      await turso([
        { sql: "DELETE FROM day_results" },
        { sql: "UPDATE players SET best = 0, days = 0, total = 0" },
      ]);
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
