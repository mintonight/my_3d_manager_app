import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import App from './App';
import { AuthProvider, useAuth } from './auth';
import { I18nProvider } from './i18n';
import { readStoredUiLanguage, readStoredUiTheme } from './preferences';
import './styles.css';
import { buildAntdTheme } from './theme';

function RootProviders() {
  const { user } = useAuth();
  const language = user?.ui_language ?? readStoredUiLanguage();
  const themeMode = user?.ui_theme ?? readStoredUiTheme();

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.lang = language;
  }, [language, themeMode]);

  return (
    <I18nProvider language={language}>
      <ConfigProvider
        locale={language === 'zh-CN' ? zhCN : enUS}
        theme={buildAntdTheme(themeMode)}
      >
        <AntApp>
          <App />
        </AntApp>
      </ConfigProvider>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RootProviders />
    </AuthProvider>
  </React.StrictMode>,
);
