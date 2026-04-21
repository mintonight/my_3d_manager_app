import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Role, UiLanguage, UiTheme } from './types';

interface I18nValue {
  language: UiLanguage;
  isZh: boolean;
  formatDateTime: (value: string | number | Date) => string;
  formatNumber: (value: number) => string;
  roleLabel: (role: Role) => string;
  languageLabel: (language: UiLanguage) => string;
  themeLabel: (theme: UiTheme) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: UiLanguage;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(() => {
    const isZh = language === 'zh-CN';
    const dateTimeFormatter = new Intl.DateTimeFormat(language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const numberFormatter = new Intl.NumberFormat(language);

    return {
      language,
      isZh,
      formatDateTime: (input) => dateTimeFormatter.format(new Date(input)),
      formatNumber: (input) => numberFormatter.format(input),
      roleLabel: (role) => {
        if (role === 'owner') return isZh ? '所有者' : 'Owner';
        if (role === 'editor') return isZh ? '编辑者' : 'Editor';
        return isZh ? '查看者' : 'Viewer';
      },
      languageLabel: (nextLanguage) =>
        nextLanguage === 'zh-CN' ? '简体中文' : 'English',
      themeLabel: (theme) => {
        if (theme === 'dark') return isZh ? '暗色' : 'Dark';
        return isZh ? '亮色' : 'Light';
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be inside I18nProvider');
  return value;
}
