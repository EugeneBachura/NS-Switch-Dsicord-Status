import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultRemoteDatabaseUrl, defaultSettings } from "../shared/constants.js";
import type { AppLanguage, AppSettings, AppTheme, GameEntry, Platform } from "../shared/types.js";
import { validateGameDatabase } from "../shared/validation.js";

const settingsFile = "settings.json";
const customGamesFile = "custom-games.json";
const databaseCacheFile = "games-cache.json";
const installerLanguageFile = "installer-language.txt";
const userOwnedFiles = new Set([settingsFile, customGamesFile, installerLanguageFile]);

function isPlatform(value: unknown): value is Platform {
  return value === "Nintendo Switch" || value === "Nintendo Switch 2";
}

function isLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "pl" || value === "ru";
}

function isTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark" || value === "soft";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function detectLanguage(): AppLanguage {
  const locale = app.getLocale().toLowerCase();
  if (locale.startsWith("ru")) {
    return "ru";
  }
  if (locale.startsWith("pl")) {
    return "pl";
  }
  return "en";
}

async function readInstallerLanguage(): Promise<AppLanguage | null> {
  try {
    const language = await fs.readFile(
      path.join(app.getPath("userData"), installerLanguageFile),
      "utf8"
    );
    const normalizedLanguage = language.trim();
    return isLanguage(normalizedLanguage) ? normalizedLanguage : null;
  } catch {
    return null;
  }
}

function normalizeSettings(settings: Partial<AppSettings> & Record<string, unknown>): AppSettings {
  const cleanSettings = { ...settings };
  delete cleanSettings.launchMinimized;
  const candidate = cleanSettings as Partial<AppSettings>;
  const shouldUseDefaultDatabaseUrl =
    !candidate.remoteDatabaseUrl ||
    candidate.remoteDatabaseUrl.includes("raw.githubusercontent.com");

  return {
    ...defaultSettings,
    ...candidate,
    discordApplicationId: "",
    useOnlineDatabase: candidate.useOnlineDatabase ?? defaultSettings.useOnlineDatabase,
    databaseUpdateFrequency:
      candidate.databaseUpdateFrequency ?? defaultSettings.databaseUpdateFrequency,
    lastDatabaseCheckAt: candidate.lastDatabaseCheckAt ?? null,
    useLocalJsonFile: candidate.useLocalJsonFile ?? false,
    localJsonFilePath: candidate.localJsonFilePath ?? "",
    minimizeToTray: candidate.minimizeToTray ?? false,
    closeToTray: candidate.closeToTray ?? false,
    favoriteGameIds: stringArray(candidate.favoriteGameIds),
    selectedConsole: isPlatform(candidate.selectedConsole)
      ? candidate.selectedConsole
      : defaultSettings.selectedConsole,
    language: isLanguage(candidate.language) ? candidate.language : defaultSettings.language,
    theme: isTheme(candidate.theme) ? candidate.theme : defaultSettings.theme,
    closeBehaviorAsked: candidate.closeBehaviorAsked ?? false,
    remoteDatabaseUrl: shouldUseDefaultDatabaseUrl
      ? defaultRemoteDatabaseUrl
      : candidate.remoteDatabaseUrl ?? defaultRemoteDatabaseUrl
  };
}

async function ensureUserData(): Promise<void> {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
}

export async function cleanupRuntimeUserData(): Promise<void> {
  const userDataPath = app.getPath("userData");
  await ensureUserData();
  const entries = await fs.readdir(userDataPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.isFile() && userOwnedFiles.has(entry.name)) {
        return;
      }

      await fs.rm(path.join(userDataPath, entry.name), { force: true, recursive: true });
    })
  );
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureUserData();
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readSettings(): Promise<AppSettings> {
  const filePath = path.join(app.getPath("userData"), settingsFile);
  const stored = await readJsonFile<Partial<AppSettings>>(filePath, {});
  const installerLanguage = await readInstallerLanguage();
  const settings = normalizeSettings({
    ...defaultSettings,
    ...stored,
    language: stored.language ?? installerLanguage ?? detectLanguage()
  });
  const needsMigration =
    stored.discordApplicationId ||
    stored.remoteDatabaseUrl === undefined ||
    stored.remoteDatabaseUrl?.includes("raw.githubusercontent.com") ||
    stored.useOnlineDatabase === undefined ||
    stored.databaseUpdateFrequency === undefined ||
    stored.lastDatabaseCheckAt === undefined ||
    stored.useLocalJsonFile === undefined ||
    stored.localJsonFilePath === undefined ||
    stored.minimizeToTray === undefined ||
    stored.closeToTray === undefined ||
    stored.favoriteGameIds === undefined ||
    stored.selectedConsole === undefined ||
    stored.language === undefined ||
    stored.theme === undefined ||
    stored.closeBehaviorAsked === undefined;

  if (needsMigration) {
    await writeJsonFile(filePath, settings);
  }
  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const nextSettings = normalizeSettings({ ...defaultSettings, ...settings });
  await writeJsonFile(path.join(app.getPath("userData"), settingsFile), nextSettings);
  app.setLoginItemSettings({ openAtLogin: nextSettings.startWithSystem });
  return nextSettings;
}

export async function readCustomGames(): Promise<GameEntry[]> {
  const games = await readJsonFile<unknown[]>(path.join(app.getPath("userData"), customGamesFile), []);
  return validateGameDatabase({
    version: 1,
    updatedAt: new Date().toISOString(),
    games
  }).games;
}

export async function saveCustomGames(games: GameEntry[]): Promise<GameEntry[]> {
  const validatedGames = validateGameDatabase({
    version: 1,
    updatedAt: new Date().toISOString(),
    games
  }).games;
  await writeJsonFile(path.join(app.getPath("userData"), customGamesFile), validatedGames);
  return validatedGames;
}

export async function readDatabaseCache(): Promise<unknown | null> {
  return readJsonFile<unknown | null>(path.join(app.getPath("userData"), databaseCacheFile), null);
}

export async function saveDatabaseCache(value: unknown): Promise<void> {
  validateGameDatabase(value);
  await writeJsonFile(path.join(app.getPath("userData"), databaseCacheFile), value);
}
