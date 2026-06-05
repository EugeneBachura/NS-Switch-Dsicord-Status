import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Gamepad2,
  Home,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Star,
  Upload,
  XCircle
} from "lucide-react";
import {
  appVersion,
  appName,
  defaultRemoteDatabaseUrl,
  defaultSettings,
  getDiscordApplicationId
} from "../shared/constants";
import { searchGames } from "../shared/search";
import { getTranslations, translations, type Translation } from "../shared/locales";
import type {
  AppLanguage,
  AppSettings,
  AppTheme,
  DatabaseLoadResult,
  DatabaseUpdateFrequency,
  GameEntry,
  Platform,
  PresenceStatus
} from "../shared/types";

type Page = "Home" | "Settings" | "About & Privacy";
type ToastKind = "success" | "error";

interface ToastMessage {
  kind: ToastKind;
  text: string;
}

const blankStatus: PresenceStatus = {
  discordDetected: false,
  presenceActive: false,
  message: "Status off"
};

const appIconUrl = "./app-icon.png";

function App() {
  const [page, setPage] = useState<Page>("Home");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [databaseResult, setDatabaseResult] = useState<DatabaseLoadResult | null>(null);
  const [customGames, setCustomGames] = useState<GameEntry[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedConsole, setSelectedConsole] = useState<Platform>("Nintendo Switch");
  const [status, setStatus] = useState<PresenceStatus>(blankStatus);
  const [checkingDiscord, setCheckingDiscord] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pendingFavoriteGameId, setPendingFavoriteGameId] = useState<string | null>(null);
  const [favoritePreviewIds, setFavoritePreviewIds] = useState<string[]>(defaultSettings.favoriteGameIds);
  const t = useMemo(() => getTranslations(settings.language), [settings.language]);

  const games = useMemo(
    () => [...(databaseResult?.database.games ?? []), ...customGames],
    [customGames, databaseResult]
  );
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;
  const activeGame = games.find((game) => game.id === activeGameId) ?? null;
  const statusActive = status.presenceActive && Boolean(activeGame);
  const discordConnected = status.discordDetected;
  const filteredGames = useMemo(
    () =>
      sortFavoritesFirst(searchGames(games, query, selectedConsole), favoritePreviewIds).slice(
        0,
        60
      ),
    [games, query, selectedConsole, favoritePreviewIds]
  );

  useEffect(() => {
    async function loadInitialData() {
      const nextSettings = await window.nsSwitchDiscordStatus.readSettings();
      const [database, savedCustomGames, nextStatus] = await Promise.all([
        window.nsSwitchDiscordStatus.loadGameDatabase(nextSettings),
        window.nsSwitchDiscordStatus.readCustomGames(),
        window.nsSwitchDiscordStatus.checkDiscord()
      ]);

      let savedSettings = nextSettings;
      if (database.checkedAt) {
        savedSettings = await window.nsSwitchDiscordStatus.saveSettings({
          ...nextSettings,
          lastDatabaseCheckAt: database.checkedAt
        });
      }

      setSettings(savedSettings);
      setDatabaseResult(database);
      setCustomGames(savedCustomGames);
      setStatus(nextStatus);
      setCheckingDiscord(false);
      setSelectedGameId(savedSettings.lastSelectedGameId);
      setSelectedConsole(savedSettings.selectedConsole);
      setActiveGameId(nextStatus.presenceActive ? savedSettings.lastSelectedGameId : null);
    }

    void loadInitialData();
  }, []);

  useEffect(
    () =>
      window.nsSwitchDiscordStatus.onSettingsUpdated((nextSettings) => {
        setSettings(nextSettings);
        setFavoritePreviewIds(nextSettings.favoriteGameIds);
        setSelectedConsole(nextSettings.selectedConsole);
      }),
    []
  );

  useEffect(
    () =>
      window.nsSwitchDiscordStatus.onDatabaseUpdated((result) => {
        setDatabaseResult(result);
      }),
    []
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.kind === "success" ? 2400 : 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (selectedGame && !selectedGame.playableOn.includes(selectedConsole)) {
      setSelectedGameId(null);
      setActiveGameId(null);
    }
  }, [selectedConsole, selectedGame]);

  async function persistSettings(nextSettings: AppSettings) {
    setSettings(nextSettings);
    const saved = await window.nsSwitchDiscordStatus.saveSettings(nextSettings);
    setSettings(saved);
    setFavoritePreviewIds(saved.favoriteGameIds);
    return saved;
  }

  async function persistDatabaseCheck(
    nextSettings: AppSettings,
    result: DatabaseLoadResult
  ): Promise<AppSettings> {
    if (!result.checkedAt) {
      return nextSettings;
    }

    return window.nsSwitchDiscordStatus.saveSettings({
      ...nextSettings,
      lastDatabaseCheckAt: result.checkedAt
    });
  }

  async function loadDatabase(nextSettings: AppSettings, forceRefresh = false, showToast = false) {
    const result = await window.nsSwitchDiscordStatus.loadGameDatabase(nextSettings, forceRefresh);
    const savedSettings = await persistDatabaseCheck(nextSettings, result);
    setSettings(savedSettings);
    setDatabaseResult(result);
    if (showToast) {
      setToast(
        result.error
          ? { kind: "error", text: t.databaseUpdateFailed }
          : { kind: "success", text: t.databaseUpdated }
      );
    }
    return result;
  }

  async function selectGame(game: GameEntry) {
    setSelectedGameId(game.id);
    if (settings.rememberLastSelectedGame) {
      await persistSettings({ ...settings, lastSelectedGameId: game.id });
    }

    if (!checkingDiscord && !discordConnected) {
      setToast({ kind: "error", text: t.discordNotRunning });
    }
  }

  async function startGameFromCard(game: GameEntry) {
    setSelectedGameId(game.id);
    if (settings.rememberLastSelectedGame) {
      await persistSettings({ ...settings, lastSelectedGameId: game.id });
    }
    await startStatusFor(game, selectedConsole);
  }

  async function startStatusFor(game: GameEntry, console: Platform, showToast = true) {
    try {
      const nextStatus = await window.nsSwitchDiscordStatus.startPresence({
        applicationId: getDiscordApplicationId(console),
        game,
        details: game.title,
        state: "",
        largeImage: game.imageKey || game.imageUrl || "",
        smallImage: game.smallImageKey || game.smallImage || "",
        useStartTimestamp: true
      });

      setStatus(nextStatus);
      if (!nextStatus.discordDetected) {
        setActiveGameId(null);
        setToast({ kind: "error", text: t.discordNotRunning });
        return;
      }

      setCheckingDiscord(false);
      setActiveGameId(game.id);
      if (showToast) {
        setToast({ kind: "success", text: t.statusStarted });
      }
    } catch {
      setActiveGameId(null);
      setToast({ kind: "error", text: t.couldNotUpdateStatus });
    }
  }

  async function startSelectedStatus() {
    if (selectedGame) {
      await startStatusFor(selectedGame, selectedConsole);
    }
  }

  async function pauseStatus() {
    setStatus(await window.nsSwitchDiscordStatus.stopPresence());
    setActiveGameId(null);
    setToast({ kind: "success", text: t.statusPaused });
  }

  async function refreshDatabase() {
    await loadDatabase(settings, true, true);
  }

  async function changeSelectedConsole(nextConsole: Platform) {
    setSelectedConsole(nextConsole);
    const nextSettings = { ...settings, selectedConsole: nextConsole };
    if (selectedGame && !selectedGame.playableOn.includes(nextConsole)) {
      if (statusActive) {
        setStatus(await window.nsSwitchDiscordStatus.stopPresence());
      }
      setSelectedGameId(null);
      setActiveGameId(null);
      if (settings.rememberLastSelectedGame) {
        await persistSettings({ ...nextSettings, lastSelectedGameId: null });
      } else {
        await persistSettings(nextSettings);
      }
      setToast({ kind: "error", text: t.gameNotPlayable });
      return;
    }

    await persistSettings(nextSettings);
    if (statusActive && activeGame && activeGame.playableOn.includes(nextConsole)) {
      await startStatusFor(activeGame, nextConsole, false);
    }
  }

  async function importCustomGames() {
    const imported = await window.nsSwitchDiscordStatus.importCustomGames();
    if (imported) {
      setCustomGames(imported);
    }
  }

  async function exportCustomGames() {
    await window.nsSwitchDiscordStatus.exportCustomGames(customGames);
  }

  async function chooseLocalJsonFile() {
    const filePath = await window.nsSwitchDiscordStatus.chooseLocalJsonFile();
    if (!filePath) {
      return;
    }

    const saved = await persistSettings({
      ...settings,
      useLocalJsonFile: true,
      localJsonFilePath: filePath
    });
    await loadDatabase(saved, true);
  }

  async function clearLocalCustomGames() {
    await window.nsSwitchDiscordStatus.saveCustomGames([]);
    setCustomGames([]);
  }

  async function toggleFavoriteGame(gameId: string) {
    const favoriteIds = new Set(favoritePreviewIds);
    if (favoriteIds.has(gameId)) {
      favoriteIds.delete(gameId);
    } else {
      favoriteIds.add(gameId);
    }
    const nextFavoriteGameIds = [...favoriteIds];
    setPendingFavoriteGameId(gameId);
    setFavoritePreviewIds(nextFavoriteGameIds);
    window.setTimeout(() => {
      setPendingFavoriteGameId(null);
      void persistSettings({ ...settings, favoriteGameIds: nextFavoriteGameIds });
    }, 360);
  }

  return (
    <div className={`shell ${settings.theme}Theme`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <AppLogo />
          </div>
          <div>
            <strong>{appName}</strong>
          </div>
        </div>
        <nav className="nav">
          <NavButton icon={<Home size={18} />} label="Home" text={t.navHome} page={page} setPage={setPage} />
          <NavButton
            icon={<Settings size={18} />}
            label="Settings"
            text={t.navSettings}
            page={page}
            setPage={setPage}
          />
          <NavButton
            icon={<Shield size={18} />}
            label="About & Privacy"
            text={t.navAbout}
            page={page}
            setPage={setPage}
          />
        </nav>
      </aside>

      <main className="main">
        {toast ? (
          <button className={`toast ${toast.kind}`} onClick={() => setToast(null)}>
            {toast.kind === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toast.text}
            <XCircle size={16} />
          </button>
        ) : null}

        {page === "Home" ? (
          <HomePage
            query={query}
            setQuery={setQuery}
            selectedConsole={selectedConsole}
            setSelectedConsole={changeSelectedConsole}
            games={filteredGames}
            selectedGame={selectedGame}
            activeGame={activeGame}
            statusActive={statusActive}
            discordConnected={discordConnected}
            checkingDiscord={checkingDiscord}
            status={status}
            databaseResult={databaseResult}
            settings={settings}
            favoriteGameIds={favoritePreviewIds}
            pendingFavoriteGameId={pendingFavoriteGameId}
            selectGame={selectGame}
            startGameFromCard={startGameFromCard}
            toggleFavoriteGame={toggleFavoriteGame}
            startSelectedStatus={startSelectedStatus}
            pauseStatus={pauseStatus}
            refreshDatabase={refreshDatabase}
            t={t}
          />
        ) : null}

        {page === "Settings" ? (
          <SettingsPage
            settings={settings}
            databaseResult={databaseResult}
            customGames={customGames}
            persistSettings={persistSettings}
            loadDatabase={loadDatabase}
            importCustomGames={importCustomGames}
            exportCustomGames={exportCustomGames}
            chooseLocalJsonFile={chooseLocalJsonFile}
            clearLocalCustomGames={clearLocalCustomGames}
            t={t}
          />
        ) : null}

        {page === "About & Privacy" ? <AboutPrivacyPage t={t} /> : null}
      </main>
    </div>
  );
}

interface NavButtonProps {
  icon: JSX.Element;
  label: Page;
  text: string;
  page: Page;
  setPage: (page: Page) => void;
}

function NavButton({ icon, label, text, page, setPage }: NavButtonProps) {
  return (
    <button
      aria-label={text}
      className={page === label ? "active" : ""}
      onClick={() => setPage(label)}
      title={text}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}

function AppLogo({ className = "" }: { className?: string }) {
  return <img className={`appLogo ${className}`.trim()} src={appIconUrl} alt="" />;
}

interface HomePageProps {
  query: string;
  setQuery: (query: string) => void;
  selectedConsole: Platform;
  setSelectedConsole: (platform: Platform) => void;
  games: GameEntry[];
  selectedGame: GameEntry | null;
  activeGame: GameEntry | null;
  statusActive: boolean;
  discordConnected: boolean;
  checkingDiscord: boolean;
  status: PresenceStatus;
  databaseResult: DatabaseLoadResult | null;
  settings: AppSettings;
  favoriteGameIds: string[];
  pendingFavoriteGameId: string | null;
  selectGame: (game: GameEntry) => void;
  startGameFromCard: (game: GameEntry) => void;
  toggleFavoriteGame: (gameId: string) => void;
  startSelectedStatus: () => void;
  pauseStatus: () => void;
  refreshDatabase: () => void;
  t: Translation;
}

function HomePage(props: HomePageProps) {
  return (
    <section className="homePage">
      <CurrentStatus
        selectedGame={props.selectedGame}
        activeGame={props.activeGame}
        statusActive={props.statusActive}
        discordConnected={props.discordConnected}
        checkingDiscord={props.checkingDiscord}
        databaseResult={props.databaseResult}
        settings={props.settings}
        startSelectedStatus={props.startSelectedStatus}
        pauseStatus={props.pauseStatus}
        refreshDatabase={props.refreshDatabase}
        t={props.t}
      />

      <div className="toolbar">
        <label className="searchBox">
          <Search size={18} />
          <input
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            placeholder={props.t.searchGames}
          />
        </label>
        <div className="consoleControl">
          <SegmentedControl
            value={props.selectedConsole}
            onChange={props.setSelectedConsole}
            options={["Nintendo Switch", "Nintendo Switch 2"]}
          />
        </div>
      </div>

      <div className="gameGrid">
        {props.games.map((game) => {
          const isSelected = props.selectedGame?.id === game.id;
          const isPlaying = props.statusActive && props.activeGame?.id === game.id;
          const isFavorite = props.favoriteGameIds.includes(game.id);
          const isFavoritePending = props.pendingFavoriteGameId === game.id;
          const coverSrc = game.coverDataUri || game.coverUrl;
          return (
            <div
              className={`gameCard${isSelected ? " selected" : ""}${isPlaying ? " playing" : ""}${isFavoritePending ? " favoritePending" : ""}`}
              key={game.id}
              onClick={() => props.selectGame(game)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.selectGame(game);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <button
                className={`favoriteButton${isFavorite ? " favorite" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  props.toggleFavoriteGame(game.id);
                }}
                title={isFavorite ? props.t.removeFromFavorites : props.t.addToFavorites}
                aria-label={isFavorite ? props.t.removeFromFavorites : props.t.addToFavorites}
              >
                <Star size={15} fill={isFavorite ? "currentColor" : "none"} />
              </button>
              <div className="gameIcon">
                {coverSrc ? (
                  <img
                    alt=""
                    src={coverSrc}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : null}
                <Gamepad2 size={22} />
                <button
                  className="gameQuickAction"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isPlaying) {
                      props.pauseStatus();
                      return;
                    }
                    props.startGameFromCard(game);
                  }}
                  title={isPlaying ? props.t.pause : props.t.start}
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
              </div>
              <div>
                <strong>{game.title}</strong>
                <span>{formatGamePlatformLabel(game.platform, props.t)}</span>
                {isPlaying ? <em>{props.t.nowPlaying}</em> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CurrentStatus({
  selectedGame,
  activeGame,
  statusActive,
  discordConnected,
  checkingDiscord,
  databaseResult,
  settings,
  startSelectedStatus,
  pauseStatus,
  refreshDatabase,
  t
}: {
  selectedGame: GameEntry | null;
  activeGame: GameEntry | null;
  statusActive: boolean;
  discordConnected: boolean;
  checkingDiscord: boolean;
  databaseResult: DatabaseLoadResult | null;
  settings: AppSettings;
  startSelectedStatus: () => void;
  pauseStatus: () => void;
  refreshDatabase: () => void;
  t: Translation;
}) {
  const checkedAt = databaseResult?.checkedAt ?? settings.lastDatabaseCheckAt;
  const title = statusActive && activeGame ? activeGame.title : selectedGame?.title ?? t.noGameSelected;
  const iconGame = statusActive && activeGame ? activeGame : selectedGame;
  const iconSrc = iconGame?.coverDataUri || iconGame?.coverUrl || null;
  const subtitle =
    statusActive && activeGame
      ? t.sharingInDiscord
      : selectedGame
        ? ""
        : t.chooseGame;
  const databaseMessage = databaseResult?.error
    ? databaseResult.source === "bundled"
      ? t.databaseFailedBundled
      : t.databaseFailedCached
    : null;
  return (
    <section className="currentStatus">
      <div className="statusMain">
        <div className="statusIcon">
          {iconSrc ? (
            <img
              alt=""
              src={iconSrc}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          <AppLogo />
        </div>
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
      </div>
      <div className="statusMeta">
        <div className="statusActions">
          {statusActive ? (
            <button
              className="statusActionButton pauseButton"
              onClick={pauseStatus}
              title={t.pause}
              aria-label={t.pause}
            >
              <Pause size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              className="statusActionButton primaryButton"
              onClick={startSelectedStatus}
              title={t.start}
              aria-label={t.start}
              disabled={!selectedGame}
            >
              <Play size={18} fill="currentColor" />
            </button>
          )}
        </div>
        <div className="statusLabels">
          <StatusPill active={statusActive} label={statusActive ? t.statusOn : t.statusOff} />
          <StatusPill
            active={discordConnected}
            label={
              checkingDiscord
                ? t.checkingDiscord
                : discordConnected
                  ? t.discordConnected
                  : t.discordNotRunning
            }
          />
        </div>
      </div>
      {databaseMessage ? (
        <div className="statusFootRow">
          <p className="statusFoot warningText">{databaseMessage}</p>
          <button className="iconButton" onClick={refreshDatabase} title={t.refreshDatabase}>
            <RefreshCw size={16} />
          </button>
        </div>
      ) : (
        <div className="statusFootRow">
          <p className="statusFoot">{t.lastDatabaseCheck}: {formatCheckedAt(checkedAt, t)}</p>
          <button className="iconButton" onClick={refreshDatabase} title={t.refreshDatabase}>
            <RefreshCw size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="statusPill">
      <span className={active ? "dot activeDot" : "dot"} />
      {label}
    </div>
  );
}

interface SettingsPageProps {
  settings: AppSettings;
  databaseResult: DatabaseLoadResult | null;
  customGames: GameEntry[];
  persistSettings: (settings: AppSettings) => Promise<AppSettings>;
  loadDatabase: (
    settings: AppSettings,
    forceRefresh?: boolean,
    showToast?: boolean
  ) => Promise<DatabaseLoadResult>;
  importCustomGames: () => void;
  exportCustomGames: () => void;
  chooseLocalJsonFile: () => void;
  clearLocalCustomGames: () => void;
  t: Translation;
}

function SettingsPage(props: SettingsPageProps) {
  async function update(patch: Partial<AppSettings>, reloadDatabase = false) {
    const saved = await props.persistSettings({ ...props.settings, ...patch });
    if (reloadDatabase) {
      await props.loadDatabase(saved, true);
    }
  }

  return (
    <section className="settingsPage">
      <h1>{props.t.settingsTitle}</h1>
      <div className="formPanel appSettings">
        <h2>{props.t.appSection}</h2>
        <div className="languageRow">
          <SelectField
            label={props.t.language}
            value={props.settings.language}
            options={Object.keys(translations)}
            optionLabels={{
              en: translations.en.languageName,
              pl: translations.pl.languageName,
              ru: translations.ru.languageName
            }}
            onChange={(language) => update({ language: language as AppLanguage })}
          />
          <SelectField
            label={props.t.theme}
            value={props.settings.theme}
            options={["dark", "light", "soft"]}
            optionLabels={{
              dark: props.t.darkTheme,
              light: props.t.lightTheme,
              soft: props.t.softTheme
            }}
            onChange={(theme) => update({ theme: theme as AppTheme })}
          />
        </div>
        <div className="appSettingsGrid">
          <ToggleField
            label={props.t.rememberLastSelectedGame}
            checked={props.settings.rememberLastSelectedGame}
            onChange={(rememberLastSelectedGame) => update({ rememberLastSelectedGame })}
          />
          <ToggleField
            label={props.t.clearPresenceOnExit}
            checked={props.settings.clearPresenceOnExit}
            onChange={(clearPresenceOnExit) => update({ clearPresenceOnExit })}
          />
          <ToggleField
            label={props.t.minimizeToTray}
            checked={props.settings.minimizeToTray}
            onChange={(minimizeToTray) => update({ minimizeToTray })}
          />
          <ToggleField
            label={props.t.closeToTray}
            checked={props.settings.closeToTray}
            onChange={(closeToTray) => update({ closeToTray, closeBehaviorAsked: true })}
          />
          <ToggleField
            label={props.t.askWhenClosing}
            checked={!props.settings.closeBehaviorAsked}
            onChange={(askWhenClosing) => update({ closeBehaviorAsked: !askWhenClosing })}
          />
          <ToggleField
            label={props.t.startWithSystem}
            checked={props.settings.startWithSystem}
            onChange={(startWithSystem) => update({ startWithSystem })}
          />
        </div>
      </div>

      <div className="formPanel databaseSettings">
        <h2>{props.t.gameDatabase}</h2>
        <ToggleField
          label={props.t.useOnlineGameDatabase}
          checked={props.settings.useOnlineDatabase}
          onChange={(useOnlineDatabase) => update({ useOnlineDatabase }, true)}
        />
        <TextField
          label={props.t.gameDatabaseUrl}
          value={props.settings.remoteDatabaseUrl}
          onChange={(remoteDatabaseUrl) => update({ remoteDatabaseUrl })}
          helpText={props.t.databaseUrlHelp}
        />
        <SelectField
          label={props.t.updateFrequency}
          value={props.settings.databaseUpdateFrequency}
          options={["Every launch", "Every 3 hours", "Every day", "Every week", "Never"]}
          optionLabels={{
            "Every launch": props.t.updateEveryLaunch,
            "Every 3 hours": props.t.updateEvery3Hours,
            "Every day": props.t.updateEveryDay,
            "Every week": props.t.updateEveryWeek,
            Never: props.t.updateNever
          }}
          onChange={(databaseUpdateFrequency) =>
            update({ databaseUpdateFrequency: databaseUpdateFrequency as DatabaseUpdateFrequency })
          }
        />
        {!props.settings.useOnlineDatabase ? (
          <p className="mutedNote">{props.t.onlineDatabaseDisabled}</p>
        ) : null}
        <div className="settingsMeta">
          <span>{props.t.lastChecked}</span>
          <strong>{formatCheckedAt(props.settings.lastDatabaseCheckAt, props.t)}</strong>
        </div>
        <div className="settingsMeta">
          <span>{props.t.currentSource}</span>
          <strong>{props.databaseResult?.source ?? "loading"}</strong>
        </div>
        <div className="settingsMeta">
          <span>{props.t.nextCheck}</span>
          <strong>{formatNextCheck(props.settings, props.t)}</strong>
        </div>
        <div className="buttonRow">
          <button className="primaryButton" onClick={() => props.loadDatabase(props.settings, true, true)}>
            <RefreshCw size={18} />
            {props.t.refreshNow}
          </button>
          <button className="outlineButton" onClick={() => update({ remoteDatabaseUrl: defaultRemoteDatabaseUrl }, true)}>
            <Database size={18} />
            {props.t.resetDatabaseUrl}
          </button>
        </div>
      </div>

      <div className="formPanel librarySettings">
        <h2>{props.t.library}</h2>
        <div className="buttonRow">
          <button onClick={props.importCustomGames}>
            <Upload size={18} />
            {props.t.importCustomJson}
          </button>
          <button onClick={props.exportCustomGames}>
            <Download size={18} />
            {props.t.exportCustomJson}
          </button>
        </div>
        <ToggleField
          label={props.t.useLocalJsonFile}
          checked={props.settings.useLocalJsonFile}
          onChange={(useLocalJsonFile) => update({ useLocalJsonFile }, true)}
        />
        <TextField
          label={props.t.localFilePath}
          value={props.settings.localJsonFilePath}
          onChange={(localJsonFilePath) => update({ localJsonFilePath })}
          placeholder={props.t.chooseLocalJsonFile}
        />
        <div className="buttonRow">
          <button onClick={props.chooseLocalJsonFile}>
            <Database size={18} />
            {props.t.chooseLocalJson}
          </button>
          <button onClick={props.clearLocalCustomGames}>
            <XCircle size={18} />
            {props.t.clearLocalCustomGames}
          </button>
        </div>
        <p className="muted">{props.customGames.length} {props.t.customGamesStored}</p>
      </div>
    </section>
  );
}

function AboutPrivacyPage({ t }: { t: Translation }) {
  return (
    <section className="textPage">
      <h1>{t.aboutTitle}</h1>
      <div className="aboutPanel">
        <div className="brandMark">
          <AppLogo />
        </div>
        <div>
          <div className="aboutTitleRow">
            <h2>{appName}</h2>
            <span className="aboutVersion">v{appVersion}</span>
          </div>
          <p>{t.aboutDescription}</p>
          <p>{t.aboutCopyPrivacy}</p>
          <p>{t.aboutCopyDatabase}</p>
          <p>{t.unofficial} {t.notAffiliated} {t.noNintendoServices}</p>
        </div>
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  helpText
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {helpText ? <small>{helpText}</small> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggleRow">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function SegmentedControl({
  value,
  options,
  onChange
}: {
  value: Platform;
  options: Platform[];
  onChange: (value: Platform) => void;
}) {
  return (
    <div className="segments">
      {options.map((option) => (
        <button
          className={value === option ? "selectedSegment" : ""}
          key={option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function formatCheckedAt(value: string | null | undefined, t: Translation): string {
  if (!value) {
    return t.never;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return t.never;
  }

  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString() ? `${t.todayAt} ${time}` : date.toLocaleString();
}

function formatGamePlatformLabel(platform: Platform, t: Translation): string {
  return platform === "Nintendo Switch" ? t.switchTitle : t.switch2OnlyTitle;
}

function formatNextCheck(settings: AppSettings, t: Translation): string {
  if (!settings.useOnlineDatabase) {
    return t.disabled;
  }
  if (settings.databaseUpdateFrequency === "Every launch") {
    return t.nextLaunch;
  }
  if (settings.databaseUpdateFrequency === "Never") {
    return t.never;
  }
  if (!settings.lastDatabaseCheckAt) {
    return t.now;
  }

  const lastCheck = Date.parse(settings.lastDatabaseCheckAt);
  if (Number.isNaN(lastCheck)) {
    return t.now;
  }

  const interval =
    settings.databaseUpdateFrequency === "Every 3 hours"
      ? 3 * 60 * 60 * 1000
      : settings.databaseUpdateFrequency === "Every day"
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  const next = new Date(lastCheck + interval);
  return next <= new Date() ? t.now : formatCheckedAt(next.toISOString(), t);
}

function sortFavoritesFirst(games: GameEntry[], favoriteGameIds: string[]): GameEntry[] {
  const favoriteIds = new Set(favoriteGameIds);
  return [...games].sort((a, b) => {
    const aFavorite = favoriteIds.has(a.id);
    const bFavorite = favoriteIds.has(b.id);
    if (aFavorite && bFavorite) {
      return a.title.localeCompare(b.title);
    }
    if (aFavorite !== bFavorite) {
      return aFavorite ? -1 : 1;
    }
    return 0;
  });
}

export default App;
