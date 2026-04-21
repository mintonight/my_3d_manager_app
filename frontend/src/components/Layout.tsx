import { ReactNode } from 'react';
import { Button, Layout as AntLayout, Space, Tag, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserSettingsButton from './UserSettingsButton';

const { Header, Content } = AntLayout;

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { isZh } = useI18n();
  const nav = useNavigate();

  const text = isZh
    ? {
        brand: '追光几何-Lite',
        admin: '管理员',
        allProjects: '全部项目',
        myProjects: '我的项目',
        logout: '退出',
      }
    : {
        brand: 'Zhuiguang Geometry Lite',
        admin: 'Admin',
        allProjects: 'All Projects',
        myProjects: 'My Projects',
        logout: 'Sign Out',
      };

  return (
    <AntLayout className="apple-shell">
      <Header className="apple-shell__header">
        <Link to="/projects" className="apple-shell__brand">
          {text.brand}
        </Link>
        <div className="apple-shell__search">
          <GlobalSearch />
        </div>
        <Space size="middle" className="apple-shell__actions">
          <NotificationBell />
          <UserSettingsButton />
          <Typography.Text className="apple-shell__user">
            {user?.username} ({user?.email})
          </Typography.Text>
          {user?.is_admin && <Tag color="gold">{text.admin}</Tag>}
          <Button className="apple-pill-button apple-outline-button" onClick={() => nav('/projects')}>
            {user?.is_admin ? text.allProjects : text.myProjects}
          </Button>
          <Button className="apple-pill-button" danger onClick={logout}>
            {text.logout}
          </Button>
        </Space>
      </Header>
      <Content className="apple-shell__content">{children}</Content>
    </AntLayout>
  );
}
