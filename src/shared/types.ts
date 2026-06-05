export const platforms = ["Nintendo Switch", "Nintendo Switch 2"] as const;

export type Platform = (typeof platforms)[number];
export type DatabaseUpdateFrequency =
  | "Every launch"
  | "Every 3 hours"
  | "Every day"
  | "Every week"
  | "Never";
export type DatabaseSource = "online" | "cache" | "bundled" | "local file";
export type ExclusiveStatus = "exclusive" | "console_exclusive" | "unknown";
export type AppLanguage = "en" | "pl" | "ru";
export type AppTheme = "light" | "dark" | "soft";

export interface GameSource {
  name: string;
  url: string;
}

export interface GameEntry {
  id: string;
  title: string;
  platform: Platform;
  playableOn: Platform[];
  aliases: string[];
  coverUrl: string | null;
  coverDataUri: string | null;
  image: string | null;
  imageKey: string | null;
  imageUrl: string | null;
  smallImage: string | null;
  smallImageKey: string | null;
  year: number | null;
  developer: string | null;
  publisher: string | null;
  exclusiveStatus: ExclusiveStatus;
  source: GameSource | null;
}

export interface GameDatabase {
  version: number;
  updatedAt: string;
  games: GameEntry[];
}

export interface PresenceInput {
  applicationId: string;
  game: GameEntry;
  details: string;
  state: string;
  largeImage: string;
  smallImage: string;
  useStartTimestamp: boolean;
}

export interface PresenceStatus {
  discordDetected: boolean;
  presenceActive: boolean;
  message: string;
}

export interface AppSettings {
  remoteDatabaseUrl: string;
  discordApplicationId: string;
  useOnlineDatabase: boolean;
  databaseUpdateFrequency: DatabaseUpdateFrequency;
  lastDatabaseCheckAt: string | null;
  useLocalJsonFile: boolean;
  localJsonFilePath: string;
  rememberLastSelectedGame: boolean;
  clearPresenceOnExit: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  startWithSystem: boolean;
  lastSelectedGameId: string | null;
  favoriteGameIds: string[];
  selectedConsole: Platform;
  language: AppLanguage;
  theme: AppTheme;
  closeBehaviorAsked: boolean;
}

export interface DatabaseLoadResult {
  database: GameDatabase;
  source: DatabaseSource;
  error: string | null;
  checkedAt: string | null;
}
