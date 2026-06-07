# Game Database

The game database is a public JSON file:

`data/games.json`

## Rules

- Keep the file valid JSON.
- Keep `version` as a number.
- Update `updatedAt` with an ISO date string.
- Use only `Nintendo Switch` or `Nintendo Switch 2`.
- `platform` is the original game platform.
- `playableOn` controls where the game is shown in the app.
- The selected console controls the Discord state text.
- Use stable lowercase ids with short dashes.
- Put searchable names in `aliases`.
- Use HTTPS image URLs only.
- Store cover images in `data/covers`.
- Use GitHub Pages cover URLs in `coverUrl`.
- Keep `coverDataUri` as `null` for the public database.
- Discord images use asset keys or supported external URLs.
- `imageKey` and `smallImageKey` are Discord asset keys.
- `imageUrl` is an optional external URL for Discord Rich Presence if supported.
- Do not add official Nintendo logos.
- Do not add official Discord logos.
- Do not add official game covers to the app.

## Fields

- `id`: stable game id.
- `title`: game title shown in Discord.
- `platform`: original game platform, `Nintendo Switch` or `Nintendo Switch 2`.
- `playableOn`: consoles where the game can be selected.
- `aliases`: extra search names.
- `coverUrl`: HTTPS cover image URL for the app UI or `null`.
- `coverDataUri`: keep this `null` in the public database.
- `imageKey`: Discord large image asset key or `null`.
- `imageUrl`: optional Discord large image URL or `null`.
- `smallImageKey`: Discord small image asset key or `null`.
- `year`: release year or `null`.
- `developer`: developer name or `null`.
- `publisher`: publisher name or `null`.
- `exclusiveStatus`: `exclusive`, `console_exclusive`, or `unknown`.
- `source`: keep this `null` in the public database.

The admin builder downloads covers to `data/covers`.
It usually sets `imageUrl` to the same value as `coverUrl`.
Discord cannot use `coverDataUri`.
Do not keep DekuDeals URLs in `data/games.json`.

## Example

```json
{
  "version": 1,
  "updatedAt": "2026-01-01T00:00:00Z",
  "games": [
    {
      "id": "zelda-tears-of-the-kingdom",
      "title": "The Legend of Zelda: Tears of the Kingdom",
      "platform": "Nintendo Switch",
      "playableOn": ["Nintendo Switch", "Nintendo Switch 2"],
      "aliases": ["TOTK", "Zelda TOTK"],
      "coverUrl": "https://eugenebachura.github.io/NS-Switch-Discord-Status/data/covers/zelda-tears-of-the-kingdom.webp",
      "coverDataUri": null,
      "imageKey": "zelda_totk",
      "imageUrl": "https://eugenebachura.github.io/NS-Switch-Discord-Status/data/covers/zelda-tears-of-the-kingdom.webp",
      "smallImageKey": "switch",
      "year": 2023,
      "developer": "Nintendo",
      "publisher": "Nintendo",
      "exclusiveStatus": "unknown",
      "source": null
    }
  ]
}
```

## Loading

`data/games.json` is the default game database.
Switch games can be shown for Nintendo Switch and Nintendo Switch 2 when `playableOn` includes both.
Switch 2 only games should use `playableOn`: `["Nintendo Switch 2"]`.
The online database can be disabled in Settings.
The app tries the remote URL first when online updates are enabled and due.
If the remote file fails, it uses the last local cache.
If cache is missing, it uses the bundled `data/games.json`.
If a local JSON file is enabled, the app uses it first.

Remote JSON is data only.
Do not add HTML, scripts, or remote code.
