import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const HISTORY_KEY = "sanhedrin:history";

function sortHistory(history) {
  return [...history].sort((a, b) => a.day - b.day);
}

function isValidEntry(entry) {
  return (
    entry &&
    Number.isInteger(entry.day) &&
    entry.day >= 0 &&
    Number.isFinite(entry.value) &&
    entry.value >= 0
  );
}

async function getHistory() {
  const history = await redis.get(HISTORY_KEY);
  return Array.isArray(history) ? sortHistory(history) : [];
}

function canEdit(event) {
  const provided = getHeader(event, "x-edit-key");
  console.log("provided:", JSON.stringify(provided));
  console.log("expected:", JSON.stringify(process.env.EDIT_KEY));
  console.log("match:", provided === process.env.EDIT_KEY);
  return Boolean(process.env.EDIT_KEY) && provided === process.env.EDIT_KEY;
}

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    const history = await getHistory();
    return { history };
  }

  if (event.method === "POST") {
    if (!canEdit(event)) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    const body = await readBody(event);
    const entry = { day: Number(body?.day), value: Number(body?.value) };

    if (!isValidEntry(entry)) {
      throw createError({ statusCode: 400, statusMessage: "Invalid payload" });
    }

    const history = await getHistory();
    const filtered = history.filter((item) => item.day !== entry.day);
    const nextHistory = sortHistory([...filtered, entry]);

    await redis.set(HISTORY_KEY, nextHistory);
    return { history: nextHistory };
  }

  if (event.method === "DELETE") {
    if (!canEdit(event)) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    await redis.set(HISTORY_KEY, []);
    return { history: [] };
  }

  throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
});

