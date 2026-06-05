import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { validateGameDatabase, isHttpsUrl } from "../shared/validation.js";
import type { AppSettings, DatabaseLoadResult, GameDatabase, GameEntry } from "../shared/types.js";
import { readDatabaseCache, saveDatabaseCache } from "./config.js";

function bundledDatabasePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "data", "games.json");
  }

  return path.join(process.cwd(), "data", "games.json");
}

async function readBundledDatabase(): Promise<GameDatabase> {
  const content = await fs.readFile(bundledDatabasePath(), "utf8");
  return validateGameDatabase(JSON.parse(content));
}

function validateLocalJson(value: unknown): GameDatabase {
  if (Array.isArray(value)) {
    return validateGameDatabase({
      version: 1,
      updatedAt: new Date().toISOString(),
      games: value as GameEntry[]
    });
  }

  return validateGameDatabase(value);
}

async function readLocalDatabase(filePath: string): Promise<GameDatabase> {
  const content = await fs.readFile(filePath, "utf8");
  return validateLocalJson(JSON.parse(content));
}

async function fetchRemoteDatabase(url: string): Promise<GameDatabase> {
  if (!isHttpsUrl(url)) {
    throw new Error("Remote database URL must use HTTPS");
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Remote database request failed with ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
    throw new Error("Remote database must return JSON");
  }

  const json = (await response.json()) as unknown;
  const database = validateGameDatabase(json);
  await saveDatabaseCache(json);
  return database;
}

function isUpdateDue(settings: AppSettings): boolean {
  if (settings.databaseUpdateFrequency === "Every launch") {
    return true;
  }
  if (settings.databaseUpdateFrequency === "Never") {
    return false;
  }
  if (!settings.lastDatabaseCheckAt) {
    return true;
  }

  const lastCheck = Date.parse(settings.lastDatabaseCheckAt);
  if (Number.isNaN(lastCheck)) {
    return true;
  }

  const age = Date.now() - lastCheck;
  const day = 24 * 60 * 60 * 1000;
  if (settings.databaseUpdateFrequency === "Every 3 hours") {
    return age >= 3 * 60 * 60 * 1000;
  }

  return settings.databaseUpdateFrequency === "Every day" ? age >= day : age >= 7 * day;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Game database failed";
}

async function loadCacheOrBundled(error: string | null, checkedAt: string | null): Promise<DatabaseLoadResult> {
  const cache = await readDatabaseCache();
  if (cache) {
    try {
      return {
        database: validateGameDatabase(cache),
        source: "cache",
        error,
        checkedAt
      };
    } catch (cacheError) {
      console.warn("Cached database is invalid", cacheError);
    }
  }

  return {
    database: await readBundledDatabase(),
    source: "bundled",
    error,
    checkedAt
  };
}

export async function loadGameDatabase(
  settings: AppSettings,
  forceRefresh = false
): Promise<DatabaseLoadResult> {
  if (settings.useLocalJsonFile && settings.localJsonFilePath.trim()) {
    try {
      return {
        database: await readLocalDatabase(settings.localJsonFilePath),
        source: "local file",
        error: null,
        checkedAt: null
      };
    } catch (localError) {
      return loadCacheOrBundled(errorMessage(localError), null);
    }
  }

  const shouldFetchRemote =
    settings.useOnlineDatabase && (forceRefresh || isUpdateDue(settings));
  if (!shouldFetchRemote) {
    return loadCacheOrBundled(null, null);
  }

  const checkedAt = new Date().toISOString();
  try {
    return {
      database: await fetchRemoteDatabase(settings.remoteDatabaseUrl),
      source: "online",
      error: null,
      checkedAt
    };
  } catch (remoteError) {
    return loadCacheOrBundled(errorMessage(remoteError), checkedAt);
  }
}
