import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".sql": "text/plain; charset=utf-8",
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function tursoArg(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: "integer", value: String(Math.trunc(value)) };
  }
  return { type: "text", value: String(value ?? "") };
}

function cellValue(cell) {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer" || cell.type === "float") return Number(cell.value);
  return cell.value;
}

function parseTursoRows(result) {
  const cols = (result?.cols || []).map((col) => col.name);
  return (result?.rows || []).map((row) => {
    const item = {};
    row.forEach((cell, index) => {
      item[cols[index]] = cellValue(cell);
    });
    return item;
  });
}

function getTurso() {
  const tursoUrl = String(process.env.TURSO_DATABASE_URL || "")
    .trim()
    .replace(/^libsql:/, "https:")
    .replace(/\/$/, "");
  const tursoToken = String(process.env.TURSO_AUTH_TOKEN || "").trim();
  if (!tursoUrl || !tursoToken) return null;
  return { tursoUrl, tursoToken };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function tursoPipeline(requests) {
  const cfg = getTurso();
  if (!cfg) throw new Error("Turso env vars are missing");
  const response = await fetch(`${cfg.tursoUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 300) || `HTTP ${response.status}`);
  }
  return response.json();
}

async function handleStats(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const payload = await tursoPipeline([
      {
        type: "execute",
        stmt: {
          sql: `
            SELECT telegram_id, player_name, level, points, played_at
            FROM level_scores
            ORDER BY level ASC, points DESC, played_at DESC
          `,
          args: [],
        },
      },
      { type: "close" },
    ]);
    const rows = parseTursoRows(payload?.results?.[0]?.response?.result);
    const byLevel = {};
    for (const row of rows) {
      const key = String(row.level);
      if (!byLevel[key]) byLevel[key] = [];
      byLevel[key].push(row);
    }
    return sendJson(res, 200, { ok: true, rows, byLevel });
  } catch (error) {
    return sendJson(res, 502, { error: "Failed to load stats", details: String(error.message || error) });
  }
}

async function handleScore(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON" });
  }

  const telegramId = Number(body?.telegramId);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return sendJson(res, 200, { ok: false, skipped: true, reason: "no_telegram_id" });
  }

  const level = String(body?.level || "").trim().slice(0, 16);
  const points = Number(body?.points);
  const playerName = String(body?.name || "Player").trim().slice(0, 64) || "Player";

  if (!level || !Number.isFinite(points) || points < 0) {
    return sendJson(res, 400, { error: "Invalid level or points" });
  }

  try {
    await tursoPipeline([
      {
        type: "execute",
        stmt: {
          sql: `
            INSERT INTO level_scores (telegram_id, player_name, level, points, played_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(telegram_id, level) DO UPDATE SET
              player_name = excluded.player_name,
              points = excluded.points,
              played_at = excluded.played_at
          `,
          args: [
            tursoArg(telegramId),
            tursoArg(playerName),
            tursoArg(level),
            tursoArg(Math.round(points)),
          ],
        },
      },
      {
        type: "execute",
        stmt: {
          sql: `
            UPDATE level_scores
            SET player_name = ?
            WHERE telegram_id = ?
          `,
          args: [tursoArg(playerName), tursoArg(telegramId)],
        },
      },
      { type: "close" },
    ]);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 502, { error: "Turso request failed", details: String(error.message || error) });
  }
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, clean === "/" || clean === "" ? "index.html" : clean);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function serveStatic(req, res) {
  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  try {
    if (urlPath === "/api/stats") return await handleStats(req, res);
    if (urlPath === "/api/score") return await handleScore(req, res);
    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: String(error.message || error) });
  }
});

server.listen(PORT, () => {
  console.log(`PharmConsilium local server: http://127.0.0.1:${PORT}`);
});
