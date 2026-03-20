import { createError, defineEventHandler, readBody } from "h3";
import { Redis } from "@upstash/redis";

const HISTORY_KEY = "sanhedrin:history";
const isDevelopment = process.env.NODE_ENV !== "production";
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const hasRedisEnv = Boolean(redisUrl) && Boolean(redisToken);
const redis = hasRedisEnv ? new Redis({ url: redisUrl, token: redisToken }) : null;
const devEditKey = "dev-edit-key";
let memoryHistory = [];

function readHeaderValue(event, name) {
  const normalized = name.toLowerCase();

  if (typeof event?.headers?.get === "function") {
    return event.headers.get(name) || event.headers.get(normalized) || "";
  }

  const headers = event?.node?.req?.headers || event?.req?.headers || event?.headers;
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(normalized) || "";
  }

  return headers[name] || headers[normalized] || "";
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
    return sortHistory(memoryHistory);
  }

  const history = await redis.get(HISTORY_KEY);
  return Array.isArray(history) ? sortHistory(history) : [];
}

async function setHistory(history) {
  if (!redis) {
    memoryHistory = sortHistory(history);
    return;
  }

  await redis.set(HISTORY_KEY, history);
}

function canEdit(event) {
  const provided = readHeaderValue(event, "x-edit-key");
  const expected = process.env.EDIT_KEY || (isDevelopment ? devEditKey : "");
  return Boolean(expected) && provided === expected;
}

function getAuthDebug(event) {
  const provided = readHeaderValue(event, "x-edit-key") || "";
  const expected = process.env.EDIT_KEY || (isDevelopment ? devEditKey : "");

  return {
    hasEditKeyEnv: Boolean(process.env.EDIT_KEY),
    nodeEnv: process.env.NODE_ENV || "",
    vercelEnv: process.env.VERCEL_ENV || "",
    providedLength: provided.length,
    expectedLength: expected.length,
    exactMatch: Boolean(expected) && provided === expected,
    trimmedMatch: Boolean(expected) && provided.trim() === expected.trim(),
  };
}

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    const history = await getHistory();
    return { history };
  }

  if (event.method === "POST") {
    if (!canEdit(event)) {
      if (readHeaderValue(event, "x-debug-auth") === "1") {
        return { error: "Unauthorized", debug: getAuthDebug(event) };
      }
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
      if (readHeaderValue(event, "x-debug-auth") === "1") {
        return { error: "Unauthorized", debug: getAuthDebug(event) };
      }
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    }

    await setHistory([]);
    return { history: [] };
  }

  throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
});
