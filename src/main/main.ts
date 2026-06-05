import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type Event as ElectronEvent,
  type MessageBoxOptions
} from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appName, reportIssueUrl } from "../shared/constants.js";
import { getTranslations } from "../shared/locales/index.js";
import type { AppSettings, GameEntry, PresenceInput } from "../shared/types.js";
import { validateGameDatabase } from "../shared/validation.js";
import {
  cleanupRuntimeUserData,
  readCustomGames,
  readSettings,
  saveCustomGames,
  saveSettings
} from "./config.js";
import { loadGameDatabase } from "./database.js";
import { checkDiscord, clearPresence, getPresenceStatus, startPresence, stopPresence } from "./presence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appSystemId = "com.nsswitchdiscordstatus.app";
const appSystemName = "NS Switch Discord Status";
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let cachedSettings: AppSettings | null = null;
let isQuitting = false;
let isHandlingWindowClose = false;
let trayPresenceActive = false;
let lastPresenceInput: PresenceInput | null = null;

function getAssetPath(fileName: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", fileName);
  }

  return path.join(process.cwd(), "assets", fileName);
}

function showMainWindow(): void {
  if (!mainWindow) {
    void createWindow();
    return;
  }

  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
}

function publishSettings(settings: AppSettings): void {
  mainWindow?.webContents.send("settings:updated", settings);
}

async function refreshDatabaseFromTray(): Promise<void> {
  const settings = cachedSettings ?? (await readSettings());
  const result = await loadGameDatabase(settings, true);
  if (result.checkedAt) {
    cachedSettings = await saveSettings({
      ...settings,
      lastDatabaseCheckAt: result.checkedAt
    });
    publishSettings(cachedSettings);
  }
  mainWindow?.webContents.send("database:updated", result);
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) {
    return;
  }

  const t = getTranslations(cachedSettings?.language ?? "en");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t.trayShow, click: showMainWindow },
      {
        label: trayPresenceActive ? t.trayPauseStatus : t.trayStartStatus,
        click: () => {
          if (trayPresenceActive) {
            void stopPresence().then((status) => {
              trayPresenceActive = status.presenceActive;
              updateTrayMenu();
            });
            return;
          }

          if (lastPresenceInput) {
            void startPresence(lastPresenceInput).then((status) => {
              trayPresenceActive = status.presenceActive;
              updateTrayMenu();
            });
            return;
          }

          showMainWindow();
        }
      },
      {
        label: t.trayRefreshDatabase,
        click: () => void refreshDatabaseFromTray()
      },
      {
        label: t.trayQuit,
        click: async () => {
          isQuitting = true;
          if (cachedSettings?.clearPresenceOnExit) {
            await stopPresence();
          }
          app.quit();
        }
      }
    ])
  );
}

function createTray(): void {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(getAssetPath("icon.ico"));
  const fallbackIcon = icon.isEmpty()
    ? nativeImage.createFromPath(getAssetPath("icon.png"))
    : icon;
  tray = new Tray(fallbackIcon.isEmpty() ? nativeImage.createEmpty() : fallbackIcon);
  tray.setToolTip(appSystemName);
  tray.on("click", showMainWindow);
  updateTrayMenu();
}

async function closeOrHideWindow(): Promise<void> {
  if (isHandlingWindowClose) {
    return;
  }

  isHandlingWindowClose = true;
  try {
    const settings = cachedSettings ?? (await readSettings());
    if (settings.closeBehaviorAsked && settings.closeToTray) {
      mainWindow?.hide();
      return;
    }

    let nextSettings = settings;
    if (!settings.closeBehaviorAsked) {
      const t = getTranslations(settings.language);
      const closePromptOptions: MessageBoxOptions = {
        type: "question",
        title: t.closePromptTitle,
        message: t.closePromptMessage,
        buttons: [t.closePromptMinimize, t.closePromptClose],
        checkboxLabel: t.closePromptDoNotAskAgain,
        checkboxChecked: false,
        defaultId: 0,
        cancelId: 1,
        noLink: true
      };
      const result = mainWindow
        ? await dialog.showMessageBox(mainWindow, closePromptOptions)
        : await dialog.showMessageBox(closePromptOptions);
      const shouldMinimizeToTray = result.response === 0;
      if (result.checkboxChecked) {
        nextSettings = await saveSettings({
          ...settings,
          closeBehaviorAsked: true,
          closeToTray: shouldMinimizeToTray
        });
        cachedSettings = nextSettings;
        publishSettings(nextSettings);
        updateTrayMenu();
      }

      if (shouldMinimizeToTray) {
        mainWindow?.hide();
        return;
      }
    }

    isQuitting = true;
    if (nextSettings.clearPresenceOnExit) {
      await stopPresence();
    }
    app.quit();
  } finally {
    isHandlingWindowClose = false;
  }
}

async function createWindow(): Promise<void> {
  const settings = await readSettings();
  cachedSettings = settings;
  createTray();
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    resizable: true,
    show: true,
    title: appName,
    icon: getAssetPath(process.platform === "win32" ? "icon.ico" : "icon.png"),
    backgroundColor: "#f6f7f9",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("minimize" as "will-resize", (event: ElectronEvent) => {
    if (cachedSettings?.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      void closeOrHideWindow();
    }
  });
}

function registerIpc(): void {
  ipcMain.handle("settings:read", () => readSettings());
  ipcMain.handle("settings:save", async (_event, settings: AppSettings) => {
    cachedSettings = await saveSettings(settings);
    publishSettings(cachedSettings);
    updateTrayMenu();
    return cachedSettings;
  });
  ipcMain.handle("database:load", (_event, settings: AppSettings, forceRefresh = false) =>
    loadGameDatabase(settings, forceRefresh)
  );
  ipcMain.handle("customGames:read", () => readCustomGames());
  ipcMain.handle("customGames:save", (_event, games: GameEntry[]) => saveCustomGames(games));
  ipcMain.handle("presence:start", async (_event, input: PresenceInput) => {
    const status = await startPresence(input);
    lastPresenceInput = input;
    trayPresenceActive = status.presenceActive;
    updateTrayMenu();
    return status;
  });
  ipcMain.handle("presence:clear", async () => {
    const status = await clearPresence();
    lastPresenceInput = null;
    trayPresenceActive = status.presenceActive;
    updateTrayMenu();
    return status;
  });
  ipcMain.handle("presence:stop", async () => {
    const status = await stopPresence();
    trayPresenceActive = status.presenceActive;
    updateTrayMenu();
    return status;
  });
  ipcMain.handle("presence:status", () => getPresenceStatus());
  ipcMain.handle("presence:check", () => checkDiscord());
  ipcMain.handle("issue:open", (_event, values: Record<string, string>) => {
    const url = new URL(reportIssueUrl);
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) {
        url.searchParams.set(key, value.trim());
      }
    }
    return shell.openExternal(url.toString());
  });
  ipcMain.handle("customGames:export", async (_event, games: GameEntry[]) => {
    const result = await dialog.showSaveDialog({
      title: "Export custom games",
      defaultPath: "custom-games.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) {
      return false;
    }
    await fs.writeFile(result.filePath, `${JSON.stringify(games, null, 2)}\n`, "utf8");
    return true;
  });
  ipcMain.handle("customGames:import", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import custom games",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const content = await fs.readFile(result.filePaths[0], "utf8");
    const database = validateGameDatabase({
      version: 1,
      updatedAt: new Date().toISOString(),
      games: JSON.parse(content) as unknown
    });
    await saveCustomGames(database.games);
    return database.games;
  });
  ipcMain.handle("localJson:choose", async () => {
    const result = await dialog.showOpenDialog({
      title: "Choose local JSON file",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"]
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });
}

app.setName(appSystemName);
app.setAppUserModelId(appSystemId);
Menu.setApplicationMenu(null);
registerIpc();

app.on("before-quit", async (event) => {
  if (isQuitting) {
    return;
  }

  const settings = cachedSettings ?? (await readSettings());
  isQuitting = true;
  if (settings.clearPresenceOnExit) {
    event.preventDefault();
    await stopPresence();
    app.quit();
  }
});

app.whenReady().then(async () => {
  await cleanupRuntimeUserData();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
