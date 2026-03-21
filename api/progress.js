import { Redis } from "@upstash/redis";
import { defineEventHandler, readBody, setHeader } from "h3";

const HISTORY_KEY = "sanhedrin:history";
const isDevelopment = process.env.VERCEL !== "1";
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const devEditKey = "dev-edit-key";
let memoryHistory = [];

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

function getHeader(req, name) {
  const value = req.headers?.[name] || req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function normalizeHeaders(headers) {
  if (!headers) {
    return {};
  }

  if (typeof headers[Symbol.iterator] === "function") {
    return Object.fromEntries(headers);
  }

  return headers;
}

function getExpectedEditKey() {
  return process.env.EDIT_KEY || (isDevelopment ? devEditKey : "");
}

function canEdit(req) {
  return Boolean(getExpectedEditKey()) && getHeader(req, "x-edit-key") === getExpectedEditKey();
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  return {};
}

function sendJson(res, statusCode, payload) {
  if (!res) {
    return { statusCode, payload };
  }

  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function handleRequest(req, res) {
  try {
    if (req.method === "GET") {
      const history = await getHistory();
      return sendJson(res, 200, { history });
    }

    if (req.method === "POST") {
      if (!canEdit(req)) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }

      const body = parseJsonBody(req);
      const entry = { day: Number(body?.day), value: Number(body?.value) };

      if (!isValidEntry(entry)) {
        return sendJson(res, 400, { error: "Invalid payload" });
      }

      const history = await getHistory();
      const filtered = history.filter((item) => item.day !== entry.day);
      const nextHistory = sortHistory([...filtered, entry]);

      await setHistory(nextHistory);
      return sendJson(res, 200, { history: nextHistory });
    }

    if (req.method === "DELETE") {
      if (!canEdit(req)) {
        return sendJson(res, 401, { error: "Unauthorized" });
      }

      await setHistory([]);
      return sendJson(res, 200, { history: [] });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: "Internal server error" });
  }
}

export default defineEventHandler(async (event) => {
  const parsedBody = ["POST", "PUT", "PATCH", "DELETE"].includes(event.method) ? await readBody(event) : undefined;
  const req = event.node?.req
    ? { method: event.node.req.method, headers: event.node.req.headers, body: parsedBody }
    : event.req
      ? { method: event.req.method, headers: event.req.headers, body: parsedBody }
      : {
          method: event.method,
          headers: normalizeHeaders(event.headers),
          body: parsedBody,
        };
  const res = event.node?.res || event.res;
  const result = await handleRequest(req, res);

  if (!res && result) {
    event.node.res.statusCode = result.statusCode;
    setHeader(event, "Content-Type", "application/json; charset=utf-8");
    return result.payload;
  }

  return result;
});
