# Contributing

Thanks for taking a look.

This project is intentionally narrow. It is only for Nintendo Switch and Nintendo Switch 2 manual Discord status. Please do not add PlayStation, Xbox, Steam, Epic, PC game tracking, telemetry, account login, tokens, or anything that changes the Discord client.

Game data should stay simple and easy to review. Use `data/games.json`, keep aliases short, use HTTPS image URLs, and avoid official Nintendo or Discord logos. Covers can live in `data/covers`.

For code changes, small patches are best. If you touch validation, search, settings, or Discord RPC behavior, please add or update tests.
