import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

const KEY = "sanhedrin:history";

function sort(history) {
  return history.sort((a, b) => a.day - b.day);
}

async function getHistory() {
  const data = await redis.get(KEY);
  return Array.isArray(data) ? sort(data) : [];
}

function canEdit(req) {
  return req.headers["x-edit-key"] === process.env.EDIT_KEY;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const history = await getHistory();
    return res.status(200).json({ history });
  }

  if (req.method === "POST") {
    if (!canEdit(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { day, value } = req.body;
    const history = await getHistory();

    const filtered = history.filter((h) => h.day !== day);
    const updated = sort([...filtered, { day, value }]);

    await redis.set(KEY, updated);

    return res.status(200).json({ history: updated });
  }

  if (req.method === "DELETE") {
    if (!canEdit(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await redis.set(KEY, []);
    return res.status(200).json({ history: [] });
  }

  return res.status(405).end();
}

