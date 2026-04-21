import { useEffect, useRef, useState } from 'react';
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
import { api, extractError, getToken } from '../api';
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

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

export default function Projects() {
  const { user } = useAuth();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectBackupLoading, setProjectBackupLoading] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);
  const [dataImportLoading, setDataImportLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
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

  const downloadProjectBackup = async () => {
    setProjectBackupLoading(true);
    try {
      const response = await fetch('/api/projects/backup/all', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error(`项目备份失败: ${response.status}`);
      saveBlob(await response.blob(), '项目备份.zip');
      message.success('项目备份已开始下载');
    } catch (error) {
      message.error(String(error));
    } finally {
      setProjectBackupLoading(false);
    }
  };

  const exportDataBackup = async () => {
    setDataExportLoading(true);
    try {
      const response = await fetch('/api/projects/backup/data/export', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error(`数据导出失败: ${response.status}`);
      saveBlob(await response.blob(), '数据备份.zip');
      message.success('数据备份已开始下载');
    } catch (error) {
      message.error(String(error));
    } finally {
      setDataExportLoading(false);
    }
  };

  const restoreDataBackup = async (file: File) => {
    setDataImportLoading(true);
    try {
      const body = new FormData();
      body.append('upload', file);
      const response = await fetch('/api/projects/backup/data/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body,
      });
      if (!response.ok) {
        let detail = `数据恢复失败: ${response.status}`;
        try {
          const payload = await response.json();
          if (payload?.detail) detail = String(payload.detail);
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      message.success('数据恢复完成');
      await load();
    } catch (error) {
      message.error(String(error));
    } finally {
      setDataImportLoading(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
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
          <Space wrap>
            {user?.is_admin && (
              <>
                <Button
                  className="apple-pill-button apple-outline-button"
                  onClick={() => void downloadProjectBackup()}
                  loading={projectBackupLoading}
                >
                  项目备份
                </Button>
                <Button
                  className="apple-pill-button apple-outline-button"
                  onClick={() => void exportDataBackup()}
                  loading={dataExportLoading}
                >
                  数据导出
                </Button>
                <Button
                  className="apple-pill-button apple-outline-button"
                  onClick={() => restoreInputRef.current?.click()}
                  loading={dataImportLoading}
                >
                  数据恢复
                </Button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    Modal.confirm({
                      title: '确定恢复数据备份？',
                      content: '恢复会覆盖当前项目、文件版本、成员、用户和评论通知数据。',
                      okText: '恢复',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: () => restoreDataBackup(file),
                    });
                  }}
                />
              </>
            )}
            <Button className="apple-pill-button" type="primary" onClick={() => setOpen(true)}>
              新建项目
            </Button>
          </Space>
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
