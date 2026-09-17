function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
}

function tursoArg(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: "integer", value: String(Math.trunc(value)) };
  }
  return { type: "text", value: String(value ?? "") };
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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const tursoUrl = String(process.env.TURSO_DATABASE_URL || "")
    .trim()
    .replace(/^libsql:/, "https:")
    .replace(/\/$/, "");
  const tursoToken = String(process.env.TURSO_AUTH_TOKEN || "").trim();

  if (!tursoUrl || !tursoToken) {
    return json(res, 500, { error: "Turso env vars are missing" });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  const telegramId = Number(body?.telegramId);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return json(res, 200, { ok: false, skipped: true, reason: "no_telegram_id" });
  }

  const level = String(body?.level || "").trim().slice(0, 16);
  const points = Number(body?.points);
  const playerName = String(body?.name || "Player").trim().slice(0, 64) || "Player";

  if (!level || !Number.isFinite(points) || points < 0) {
    return json(res, 400, { error: "Invalid level or points" });
  }

  const response = await fetch(`${tursoUrl}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tursoToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
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
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return json(res, 502, { error: "Turso request failed", details: text.slice(0, 300) });
  }

  return json(res, 200, { ok: true });
}
