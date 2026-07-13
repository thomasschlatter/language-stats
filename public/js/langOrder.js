// Rough global importance (by number of speakers) for a base language, used to
// order the language carousel and to pick a sensible default language. Anything
// unranked sorts after the ranked ones, then alphabetically by name.
export const LANG_IMPORTANCE = [
  'en', 'zh', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'ru', 'ur', 'id', 'de', 'ja',
  'sw', 'tr', 'ta', 'vi', 'ko', 'it', 'fa', 'pl', 'uk', 'th', 'nl', 'ms', 'ro',
  'el', 'cs', 'sv', 'hu', 'he', 'da', 'fi', 'sk', 'nb', 'no', 'hr', 'bg', 'sr',
  'ca', 'lt', 'sl', 'lv', 'et', 'ga', 'is', 'af', 'tl',
];

export function langImportance(lang) {
  const i = LANG_IMPORTANCE.indexOf(lang.lang);
  return i < 0 ? LANG_IMPORTANCE.length : i;
}

export function byImportance(a, b) {
  return langImportance(a) - langImportance(b) || a.name.localeCompare(b.name);
}
