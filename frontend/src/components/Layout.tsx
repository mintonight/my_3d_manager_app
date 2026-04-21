import { ReactNode } from 'react';
import { Button, Layout as AntLayout, Space, Tag, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';

const { Header, Content } = AntLayout;

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <AntLayout className="apple-shell">
      <Header className="apple-shell__header">
        <Link to="/projects" className="apple-shell__brand">
          追光几何-Lite
        </Link>
        <div className="apple-shell__search">
          <GlobalSearch />
        </div>
        <Space size="middle" className="apple-shell__actions">
          <NotificationBell />
          <Typography.Text className="apple-shell__user">
            {user?.username} ({user?.email})
          </Typography.Text>
          {user?.is_admin && <Tag color="gold">管理员</Tag>}
          <Button className="apple-pill-button apple-outline-button" onClick={() => nav('/projects')}>
            {user?.is_admin ? '全部项目' : '我的项目'}
          </Button>
          <Button className="apple-pill-button" danger onClick={logout}>
            退出
          </Button>
        </Space>
      </Header>
      <Content className="apple-shell__content">{children}</Content>
    </AntLayout>
  );
}
