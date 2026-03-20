import { createError, defineEventHandler, getHeader, readBody } from "h3";
import { Redis } from "@upstash/redis";

const HISTORY_KEY = "sanhedrin:history";
const isDevelopment = process.env.NODE_ENV !== "production";
const hasRedisEnv = Boolean(process.env.UPSTASH_REDIS_REST_URL) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasRedisEnv ? Redis.fromEnv() : null;
const devEditKey = "dev-edit-key";

if (!globalThis.__sanhedrinTrackerHistory) {
  globalThis.__sanhedrinTrackerHistory = [];
}

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
  if (!redis) {
    return sortHistory(globalThis.__sanhedrinTrackerHistory);
  }

  const history = await redis.get(HISTORY_KEY);
  return Array.isArray(history) ? sortHistory(history) : [];
}

async function setHistory(history) {
  if (!redis) {
    globalThis.__sanhedrinTrackerHistory = sortHistory(history);
    return;
  }

  await redis.set(HISTORY_KEY, history);
}

function canEdit(event) {
  const provided = getHeader(event, "x-edit-key");
  const expected = process.env.EDIT_KEY || (isDevelopment ? devEditKey : "");
  return Boolean(expected) && provided === expected;
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

    await setHistory(nextHistory);
    return { history: nextHistory };
  }

  if (event.method === "DELETE") {
    if (!canEdit(event)) {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    await setHistory([]);
    return { history: [] };
  }

  throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
});
