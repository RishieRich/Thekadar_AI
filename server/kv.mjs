/**
 * Storage abstraction.
 *   - Local dev:   reads/writes JSON files under data/{...key segments}.json
 *   - Vercel prod: reads/writes to Upstash Redis via REST API
 *     (auto-configured when you connect a Vercel KV store)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "..", "data");

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function upstashCommand(command) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash error ${res.status}: ${text}`);
  }
  return res.json();
}

function keyToFilePath(key) {
  const segments = String(key).split(":");
  return path.join(dataDir, ...segments) + ".json";
}

export async function kvGet(key) {
  if (isKvConfigured()) {
    const result = await upstashCommand(["GET", key]);
    if (result.result == null) return null;
    return JSON.parse(result.result);
  }

  const filePath = keyToFilePath(key);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function kvSet(key, value) {
  const serialized = JSON.stringify(value);

  if (isKvConfigured()) {
    await upstashCommand(["SET", key, serialized]);
    return;
  }

  const filePath = keyToFilePath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2));
}
