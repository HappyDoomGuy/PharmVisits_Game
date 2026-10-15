const { handleResults } = require("../catalog-api");

function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body) return Promise.resolve(JSON.parse(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  let body = null;
  if (req.method === "POST") {
    try {
      body = await readBody(req);
    } catch (error) {
      res.status(400).json({ error: "Некорректный JSON." });
      return;
    }
  }
  const query = {
    name: typeof req.query?.name === "string" ? req.query.name : "",
    player: typeof req.query?.player === "string" ? req.query.player : "",
  };
  const result = await handleResults(req.method, query, body);
  res.setHeader("cache-control", "no-store");
  res.status(result.status).json(result.json);
};
