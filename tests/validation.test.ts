import { describe, expect, it } from "vitest";
import {
  defaultApplicationId,
  defaultRemoteDatabaseUrl,
  defaultSettings,
  discordApplicationIds,
  getDiscordApplicationId
} from "../src/shared/constants";
import { searchGames } from "../src/shared/search";
import { validateGameDatabase } from "../src/shared/validation";
import type { GameEntry } from "../src/shared/types";

const games: GameEntry[] = [
  {
    id: "zelda-tears-of-the-kingdom",
    title: "The Legend of Zelda: Tears of the Kingdom",
    platform: "Nintendo Switch",
    playableOn: ["Nintendo Switch", "Nintendo Switch 2"],
    aliases: ["TOTK"],
    coverUrl: null,
    coverDataUri: null,
    image: null,
    imageKey: "zelda_totk",
    imageUrl: null,
    smallImage: null,
    smallImageKey: "switch",
    year: 2023,
    developer: "Nintendo",
    publisher: "Nintendo",
    exclusiveStatus: "unknown",
    source: null
  }
];

describe("validateGameDatabase", () => {
  it("accepts the supported schema", () => {
    const database = validateGameDatabase({
      version: 1,
      updatedAt: "2026-01-01T00:00:00Z",
      games
    });

    expect(database.games[0].platform).toBe("Nintendo Switch");
    expect(database.games[0].playableOn).toEqual(["Nintendo Switch", "Nintendo Switch 2"]);
  });

  it("migrates Switch games without playableOn to both consoles", () => {
    const oldGame: Partial<GameEntry> = { ...games[0] };
    delete oldGame.playableOn;
    const database = validateGameDatabase({
      version: 1,
      updatedAt: "2026-01-01T00:00:00Z",
      games: [oldGame]
    });

    expect(database.games[0].playableOn).toEqual(["Nintendo Switch", "Nintendo Switch 2"]);
  });

  it("migrates Switch 2 games without playableOn to Switch 2 only", () => {
    const oldGame: Partial<GameEntry> = {
      ...games[0],
      id: "metroid-prime-4-beyond",
      platform: "Nintendo Switch 2" as const
    };
    delete oldGame.playableOn;
    const database = validateGameDatabase({
      version: 1,
      updatedAt: "2026-01-01T00:00:00Z",
      games: [oldGame]
    });

    expect(database.games[0].playableOn).toEqual(["Nintendo Switch 2"]);
  });

  it("rejects non HTTPS images", () => {
    expect(() =>
      validateGameDatabase({
        version: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        games: [{ ...games[0], image: "http://example.com/image.png" }]
      })
    ).toThrow("HTTPS");
  });

  it("rejects other platforms", () => {
    expect(() =>
      validateGameDatabase({
        version: 1,
        updatedAt: "2026-01-01T00:00:00Z",
        games: [{ ...games[0], platform: "PC" }]
      })
    ).toThrow("Invalid game entry");
  });
});

describe("searchGames", () => {
  it("finds aliases", () => {
    expect(searchGames(games, "totk", "Nintendo Switch")[0].id).toBe(
      "zelda-tears-of-the-kingdom"
    );
  });

  it("filters games by selected console", () => {
    const switch2Only: GameEntry = {
      ...games[0],
      id: "metroid-prime-4-beyond",
      title: "Metroid Prime 4: Beyond",
      platform: "Nintendo Switch 2",
      playableOn: ["Nintendo Switch 2"],
      aliases: ["Metroid Prime 4"]
    };

    expect(searchGames([games[0], switch2Only], "", "Nintendo Switch")).toEqual([games[0]]);
    expect(searchGames([games[0], switch2Only], "", "Nintendo Switch 2")).toHaveLength(2);
  });
});

describe("default settings", () => {
  it("keeps the built-in Application ID out of user settings", () => {
    expect(defaultApplicationId).toBe("1508037310489427978");
    expect(discordApplicationIds["Nintendo Switch"]).toBe("1508037310489427978");
    expect(discordApplicationIds["Nintendo Switch 2"]).toBe("1512445553655676978");
    expect(getDiscordApplicationId("Nintendo Switch 2")).toBe("1512445553655676978");
    expect(defaultSettings.discordApplicationId).toBe("");
  });

  it("uses the repository game database URL by default", () => {
    expect(defaultRemoteDatabaseUrl).toBe(
      "https://eugenebachura.github.io/NS-Switch-Dsicord-Status/data/games.json"
    );
    expect(defaultSettings.remoteDatabaseUrl).toBe(defaultRemoteDatabaseUrl);
  });

  it("keeps daily database updates and tray options conservative by default", () => {
    expect(defaultSettings.databaseUpdateFrequency).toBe("Every day");
    expect(defaultSettings.minimizeToTray).toBe(false);
    expect(defaultSettings.closeToTray).toBe(false);
    expect(defaultSettings.selectedConsole).toBe("Nintendo Switch");
    expect(defaultSettings.favoriteGameIds).toEqual([]);
    expect(defaultSettings.language).toBe("en");
    expect(defaultSettings.theme).toBe("soft");
    expect(defaultSettings.closeBehaviorAsked).toBe(false);
  });
});
