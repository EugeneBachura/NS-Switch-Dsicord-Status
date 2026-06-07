import {
  platforms,
  type ExclusiveStatus,
  type GameDatabase,
  type GameEntry,
  type GameSource,
  type Platform
} from "./types.js";

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && platforms.includes(value as Platform);
}

function isNullableString(value: unknown): value is string | null {
  return value === undefined || value === null || typeof value === "string";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPlatformArray(value: unknown): value is Platform[] {
  return Array.isArray(value) && value.every((item) => isPlatform(item));
}

function migratePlayableOn(platform: Platform, playableOn: unknown): Platform[] {
  if (platform === "Nintendo Switch") {
    const consoles = isPlatformArray(playableOn) ? playableOn : [];
    const defaultConsoles: Platform[] = ["Nintendo Switch", "Nintendo Switch 2"];
    return [...new Set<Platform>([...defaultConsoles, ...consoles])];
  }

  return ["Nintendo Switch 2"];
}

function validateImageValue(value: string | null, field: string, errors: string[]): void {
  if (value !== null && value.length > 0 && !isHttpsUrl(value)) {
    errors.push(`${field} must be null, empty, or an HTTPS URL`);
  }
}

function isDataUri(value: string): boolean {
  return value.startsWith("data:image/");
}

function validateCoverDataUri(value: string | null, field: string, errors: string[]): void {
  if (value !== null && value.length > 0 && !isDataUri(value)) {
    errors.push(`${field} must be null, empty, or an image data URI`);
  }
}

function migrateExclusiveStatus(value: unknown): ExclusiveStatus {
  return value === "exclusive" || value === "console_exclusive" || value === "unknown"
    ? value
    : "unknown";
}

function migrateSource(value: unknown): GameSource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.name !== "string" || typeof candidate.url !== "string") {
    return null;
  }

  return {
    name: candidate.name,
    url: candidate.url
  };
}

export function validateGameEntry(value: unknown, index = 0): GameEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    !isPlatform(candidate.platform) ||
    !isStringArray(candidate.aliases) ||
    !isNullableString(candidate.image) ||
    !isNullableString(candidate.imageKey) ||
    !isNullableString(candidate.smallImage) ||
    !isNullableString(candidate.smallImageKey) ||
    !isNullableNumber(candidate.year) ||
    !isNullableString(candidate.developer) ||
    !isNullableString(candidate.publisher)
  ) {
    throw new Error(`Invalid game entry at index ${index}`);
  }

  const errors: string[] = [];
  const coverUrl = nullableString(candidate.coverUrl ?? candidate.image);
  const coverDataUri = nullableString(candidate.coverDataUri);
  const imageUrl = nullableString(candidate.imageUrl ?? candidate.image);
  const smallImage = nullableString(candidate.smallImage);
  validateImageValue(coverUrl, `games[${index}].coverUrl`, errors);
  validateCoverDataUri(coverDataUri, `games[${index}].coverDataUri`, errors);
  validateImageValue(imageUrl, `games[${index}].imageUrl`, errors);
  validateImageValue(smallImage, `games[${index}].smallImage`, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const playableOn = migratePlayableOn(candidate.platform, candidate.playableOn);

  return {
    id: candidate.id,
    title: candidate.title,
    platform: candidate.platform,
    playableOn,
    coverUrl,
    coverDataUri,
    aliases: candidate.aliases,
    image: nullableString(candidate.image),
    imageKey: nullableString(candidate.imageKey),
    imageUrl,
    smallImage,
    smallImageKey: nullableString(candidate.smallImageKey),
    year: candidate.year ?? null,
    developer: candidate.developer ?? null,
    publisher: candidate.publisher ?? null,
    exclusiveStatus: migrateExclusiveStatus(candidate.exclusiveStatus),
    source: migrateSource(candidate.source)
  };
}

export function validateGameDatabase(value: unknown): GameDatabase {
  if (!value || typeof value !== "object") {
    throw new Error("Database must be an object");
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.version !== "number" || !Number.isFinite(candidate.version)) {
    throw new Error("Database version must be a number");
  }

  if (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt))) {
    throw new Error("updatedAt must be an ISO date string");
  }

  if (!Array.isArray(candidate.games)) {
    throw new Error("games must be an array");
  }

  return {
    version: candidate.version,
    updatedAt: candidate.updatedAt,
    games: candidate.games.map((game, index) => validateGameEntry(game, index) as GameEntry)
  };
}

export function imageInputToPresenceValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (isHttpsUrl(value)) {
    return value;
  }

  return value.trim() || null;
}
