const ADMIN_TELEGRAM_IDS = new Set([714228956, 6747512147]);

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
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

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }

  const telegramId = Number(body?.telegramId);
  if (!Number.isFinite(telegramId) || !ADMIN_TELEGRAM_IDS.has(telegramId)) {
    return json(res, 403, { error: "Forbidden" });
  }

  const tursoUrl = String(process.env.TURSO_DATABASE_URL || "")
    .trim()
    .replace(/^libsql:/, "https:")
    .replace(/\/$/, "");
  const tursoToken = String(process.env.TURSO_AUTH_TOKEN || "").trim();

  if (!tursoUrl || !tursoToken) {
    return json(res, 500, { error: "Turso env vars are missing" });
  }

  try {
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
              sql: "DELETE FROM level_scores",
              args: [],
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
  } catch (error) {
    return json(res, 502, {
      error: "Failed to clear stats",
      details: String(error.message || error),
    });
  }
}
