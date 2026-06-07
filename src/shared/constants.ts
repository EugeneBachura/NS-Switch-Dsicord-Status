import type { AppSettings, Platform } from "./types.js";

export const appName = "NS Switch Discord Status";
export const appVersion = "0.1.5";
export const defaultApplicationId = "1508037310489427978";
export const discordApplicationIds: Record<Platform, string> = {
  "Nintendo Switch": defaultApplicationId,
  "Nintendo Switch 2": "1512445553655676978"
};
export const defaultRemoteDatabaseUrl =
  "https://eugenebachura.github.io/NS-Switch-Discord-Status/data/games.json";
export const fallbackImageKey = "fallback_icon";

export function getDiscordApplicationId(platform: Platform): string {
  return discordApplicationIds[platform];
}

export const defaultSettings: AppSettings = {
  remoteDatabaseUrl: defaultRemoteDatabaseUrl,
  discordApplicationId: "",
  useOnlineDatabase: true,
  databaseUpdateFrequency: "Every day",
  lastDatabaseCheckAt: null,
  useLocalJsonFile: false,
  localJsonFilePath: "",
  rememberLastSelectedGame: true,
  clearPresenceOnExit: true,
  minimizeToTray: false,
  closeToTray: false,
  startWithSystem: false,
  lastSelectedGameId: null,
  favoriteGameIds: [],
  selectedConsole: "Nintendo Switch",
  language: "en",
  theme: "soft",
  closeBehaviorAsked: false
};

export const reportIssueUrl =
  "https://github.com/eugenebachura/NS-Switch-Discord-Status/issues/new?template=missing-game.yml";
