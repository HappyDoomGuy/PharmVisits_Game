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

module.exports = { handleCatalog };
