import type { GameEntry, Platform } from "./types.js";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreText(haystack: string, needle: string): number {
  const source = normalize(haystack);
  const query = normalize(needle);
  if (!query) {
    return 1;
  }
  if (source === query) {
    return 100;
  }
  if (source.startsWith(query)) {
    return 80;
  }
  if (source.includes(query)) {
    return 60;
  }

  let score = 0;
  let position = 0;
  for (const char of query) {
    const next = source.indexOf(char, position);
    if (next === -1) {
      return 0;
    }
    score += next === position ? 4 : 1;
    position = next + 1;
  }

  return score;
}

export function searchGames(
  games: GameEntry[],
  query: string,
  selectedConsole: Platform
): GameEntry[] {
  return games
    .filter((game) => game.playableOn.includes(selectedConsole))
    .map((game) => {
      const titleScore = scoreText(game.title, query);
      const aliasScore = Math.max(0, ...game.aliases.map((alias) => scoreText(alias, query)));
      return { game, score: Math.max(titleScore, aliasScore) };
    })
    .filter((item) => !query.trim() || item.score > 0)
    .sort((a, b) => b.score - a.score || a.game.title.localeCompare(b.game.title))
    .map((item) => item.game);
}
