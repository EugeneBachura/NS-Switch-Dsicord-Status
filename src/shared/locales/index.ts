import type { AppLanguage } from "../types.js";
import { en } from "./en.js";
import { pl } from "./pl.js";
import { ru } from "./ru.js";

export const translations = {
  en,
  pl,
  ru
};

export type Translation = { [Key in keyof typeof en]: string };

export function getTranslations(language: AppLanguage): Translation {
  return translations[language] ?? translations.en;
}
