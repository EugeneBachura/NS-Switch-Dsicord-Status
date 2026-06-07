# NS Switch Discord Status

NS Switch Discord Status is a small desktop app for showing a Nintendo Switch or Nintendo Switch 2 game in Discord. You pick the game yourself, press Start, and the app sends that status through the local Discord Desktop RPC.

It does not log in to Discord or Nintendo. It does not ask for tokens, passwords, cookies, OAuth, or account data. The app only talks to Discord Desktop running on your computer.

The game list is a public JSON file in this repository. Covers live in `data/covers`, and the app can load the latest database from GitHub Pages. You can turn the online database off in Settings if you prefer using cache and bundled data.

## Install

Use the Windows installer from GitHub Releases. During setup you can choose the installer language and whether to create a desktop shortcut.

If Windows keeps showing an old icon, unpin the old shortcut, install the app again, and pin the fresh shortcut.

## Using It

Choose Nintendo Switch or Nintendo Switch 2, pick a game, and press Start. The selected console controls which Discord application is used, while the game title is shown as the activity.

Favorites move to the top of the list. Tray behavior, language, theme, and database settings are in Settings.

## Game Database

The public database is `data/games.json`. Cover images are stored in `data/covers`.

Notes for editing the database are in `docs/game-database.md`. The app validates the JSON before using it, and remote JSON is treated as data only.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run test
npm run lint
npm run build
```

## Releases

The built installer is not committed to Git. It belongs on the GitHub Releases page. See `RELEASES.md`.

## Legal

This project is unofficial and is not affiliated with Nintendo, Discord, or any game publisher. Nintendo Switch, Nintendo Switch 2, Discord, and game names belong to their owners.

The source code is licensed under Apache-2.0.
