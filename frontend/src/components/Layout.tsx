import { ReactNode } from 'react';
import { Layout as AntLayout } from 'antd';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserSettingsButton from './UserSettingsButton';

const { Header, Content } = AntLayout;

export default function Layout({ children }: { children: ReactNode }) {
  const { isZh } = useI18n();

  const text = isZh
    ? { brand: '追光几何-Lite' }
    : { brand: 'Zhuiguang Geometry Lite' };

  return (
    <AntLayout className="apple-shell">
      <Header className="apple-shell__header">
        <Link to="/projects" className="apple-shell__brand">
          {text.brand}
        </Link>
        <div className="apple-shell__search">
          <GlobalSearch />
        </div>
        <div className="apple-shell__actions">
          <NotificationBell />
          <UserSettingsButton />
        </div>
      </Header>
      <Content className="apple-shell__content">{children}</Content>
    </AntLayout>
  );
}
