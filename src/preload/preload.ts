import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type {
  AppSettings,
  DatabaseLoadResult,
  GameEntry,
  PresenceInput,
  PresenceStatus
} from "../shared/types.js";

const api = {
  readSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:read"),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke("settings:save", settings),
  loadGameDatabase: (
    settings: AppSettings,
    forceRefresh = false
  ): Promise<DatabaseLoadResult> => ipcRenderer.invoke("database:load", settings, forceRefresh),
  readCustomGames: (): Promise<GameEntry[]> => ipcRenderer.invoke("customGames:read"),
  saveCustomGames: (games: GameEntry[]): Promise<GameEntry[]> =>
    ipcRenderer.invoke("customGames:save", games),
  exportCustomGames: (games: GameEntry[]): Promise<boolean> =>
    ipcRenderer.invoke("customGames:export", games),
  importCustomGames: (): Promise<GameEntry[] | null> => ipcRenderer.invoke("customGames:import"),
  startPresence: (input: PresenceInput): Promise<PresenceStatus> =>
    ipcRenderer.invoke("presence:start", input),
  clearPresence: (): Promise<PresenceStatus> => ipcRenderer.invoke("presence:clear"),
  stopPresence: (): Promise<PresenceStatus> => ipcRenderer.invoke("presence:stop"),
  getPresenceStatus: (): Promise<PresenceStatus> => ipcRenderer.invoke("presence:status"),
  checkDiscord: (): Promise<PresenceStatus> => ipcRenderer.invoke("presence:check"),
  chooseLocalJsonFile: (): Promise<string | null> => ipcRenderer.invoke("localJson:choose"),
  openMissingGameIssue: (values: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke("issue:open", values),
  onSettingsUpdated: (callback: (settings: AppSettings) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on("settings:updated", listener);
    return () => ipcRenderer.removeListener("settings:updated", listener);
  },
  onDatabaseUpdated: (callback: (result: DatabaseLoadResult) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, result: DatabaseLoadResult) => callback(result);
    ipcRenderer.on("database:updated", listener);
    return () => ipcRenderer.removeListener("database:updated", listener);
  }
};

contextBridge.exposeInMainWorld("nsSwitchDiscordStatus", api);

export type DesktopApi = typeof api;
