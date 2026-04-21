import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { Link } from 'react-router-dom';
import { api, extractError } from '../api';
import { useAuth } from '../auth';
import type { Project } from '../types';

const ROLE_COLOR: Record<string, string> = {
  owner: 'red',
  editor: 'blue',
  viewer: 'default',
};

const ROLE_LABEL: Record<string, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get<Project[]>('/projects');
      setItems(response.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (values: { name: string; description: string }) => {
    try {
      await api.post('/projects', values);
      message.success('项目已创建');
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  return (
    <div className="apple-page">
      <section className="apple-hero">
        <div className="apple-hero__copy">
          <p className="apple-hero__eyebrow">Workspace</p>
          <Typography.Title className="apple-hero__title">
            {user?.is_admin ? '全部项目' : '我的项目'}
          </Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {user?.email}
          </Typography.Paragraph>
        </div>
        <div className="apple-hero__meta">
          <div className="apple-stat">
            <span className="apple-stat__label">Projects</span>
            <span className="apple-stat__value">{items.length}</span>
          </div>
          <Button className="apple-pill-button" type="primary" onClick={() => setOpen(true)}>
            新建项目
          </Button>
        </div>
      </section>

      <Card className="apple-surface apple-section-card" bordered={false}>
        <List
          loading={loading}
          locale={{ emptyText: <Empty className="apple-empty" description="还没有项目" /> }}
          dataSource={items}
          renderItem={(project) => (
            <List.Item
              className="apple-list-item"
              actions={[
                <Link key="open" to={`/projects/${project.id}`}>
                  <Button className="apple-pill-button apple-outline-button" size="small">
                    打开
                  </Button>
                </Link>,
              ]}
            >
              <List.Item.Meta
                className="apple-list-item__meta"
                title={
                  <Space wrap>
                    <Link to={`/projects/${project.id}`}>{project.name}</Link>
                    {user?.is_admin && project.owner_id !== user.id ? (
                      <Tag color="gold">管理员</Tag>
                    ) : (
                      <Tag color={ROLE_COLOR[project.my_role]}>{ROLE_LABEL[project.my_role]}</Tag>
                    )}
                  </Space>
                }
                description={
                  project.description || (
                    <Typography.Text type="secondary">暂无描述</Typography.Text>
                  )
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(project.created_at).toLocaleString('zh-CN')}
              </Typography.Text>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="新建项目"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, max: 128 }]}
          >
            <Input placeholder="例如：齿轮箱设计" />
          </Form.Item>
          <Form.Item name="description" label="简介" initialValue="">
            <Input.TextArea rows={3} placeholder="可选" maxLength={512} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
