function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(data));
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

async function fetchScores(tursoUrl, tursoToken) {
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
              SELECT telegram_id, player_name, level, points, played_at
              FROM level_scores
              ORDER BY level ASC, points DESC, played_at DESC
            `,
            args: [],
          },
        },
        { type: "close" },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 300) || `HTTP ${response.status}`);
  }

  const payload = await response.json();
  const executeResult = payload?.results?.[0]?.response?.result;
  return parseTursoRows(executeResult);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "GET" && req.method !== "POST") {
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

  try {
    const rows = await fetchScores(tursoUrl, tursoToken);
    const byLevel = {};
    for (const row of rows) {
      const key = String(row.level);
      if (!byLevel[key]) byLevel[key] = [];
      byLevel[key].push(row);
    }
    return json(res, 200, { ok: true, rows, byLevel });
  } catch (error) {
    return json(res, 502, { error: "Failed to load stats", details: String(error.message || error) });
  }
}
