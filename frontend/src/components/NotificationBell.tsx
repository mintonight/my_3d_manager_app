import { useEffect, useState } from 'react';
import { Badge, Button, Empty, Popover, Space, Spin, Tag, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Notification } from '../types';

function notificationPath(notification: Notification): string {
  const base = notification.file_version_id
    ? `/projects/${notification.project_id}/files/${notification.file_id}`
    : `/projects/${notification.project_id}`;

  const params = new URLSearchParams({
    commentId: String(notification.comment_id),
    notificationId: String(notification.id),
  });

  if (notification.file_version_id) {
    params.set('versionComment', String(notification.file_version_id));
  } else {
    params.set('fileComment', String(notification.file_id));
  }

  return `${base}?${params.toString()}`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<Notification[]>('/notifications');
      setItems(response.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [location.pathname, location.search]);

  useEffect(() => {
    const refresh = () => {
      void load();
    };
    window.addEventListener('notifications:refresh', refresh);
    return () => window.removeEventListener('notifications:refresh', refresh);
  }, [location.pathname, location.search]);

  const unreadCount = items.filter((item) => !item.is_read).length;

  const content = (
    <div style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提醒" />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {items.map((item) => (
            <Button
              key={item.id}
              type="text"
              block
              className="apple-notification-item"
              style={{ height: 'auto', textAlign: 'left', padding: '10px 12px' }}
              onClick={() => {
                setOpen(false);
                navigate(notificationPath(item));
              }}
            >
              <Space direction="vertical" size={4} style={{ width: '100%', alignItems: 'flex-start' }}>
                <Space wrap>
                  <Typography.Text strong>{item.author_username}</Typography.Text>
                  <Tag color={item.is_read ? 'default' : 'blue'}>
                    {item.is_read ? '已读' : '未读'}
                  </Tag>
                </Space>
                <Typography.Text ellipsis style={{ maxWidth: 300 }}>
                  {item.comment_content}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </Typography.Text>
              </Space>
            </Button>
          ))}
        </Space>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void load();
      }}
      placement="bottomRight"
      overlayClassName="apple-notification-popover"
    >
      <Badge count={unreadCount} size="small">
        <Button className="apple-pill-button apple-outline-button" size="small" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  );
}
