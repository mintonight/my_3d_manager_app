import type { UiLanguage, UiTheme, User } from './types';

export const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh-CN';
export const DEFAULT_UI_THEME: UiTheme = 'light';

const LANGUAGE_STORAGE_KEY = 'zgg_ui_language';
const THEME_STORAGE_KEY = 'zgg_ui_theme';

export function normalizeUiLanguage(value?: string | null): UiLanguage {
  return value === 'en-US' ? 'en-US' : DEFAULT_UI_LANGUAGE;
}

export function normalizeUiTheme(value?: string | null): UiTheme {
  return value === 'dark' ? 'dark' : DEFAULT_UI_THEME;
}

export function readStoredUiLanguage(): UiLanguage {
  return normalizeUiLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function readStoredUiTheme(): UiTheme {
  return normalizeUiTheme(localStorage.getItem(THEME_STORAGE_KEY));
}

export function persistUserPreferences(user: Pick<User, 'ui_language' | 'ui_theme'>): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeUiLanguage(user.ui_language));
  localStorage.setItem(THEME_STORAGE_KEY, normalizeUiTheme(user.ui_theme));
}

export function clearStoredUserPreferences(): void {
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  localStorage.removeItem(THEME_STORAGE_KEY);
}
