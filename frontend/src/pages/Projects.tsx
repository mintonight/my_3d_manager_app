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
import { useI18n } from '../i18n';
import type { Project } from '../types';

const ROLE_COLOR: Record<string, string> = {
  owner: 'red',
  editor: 'blue',
  viewer: 'default',
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
  const { isZh, formatDateTime, roleLabel } = useI18n();
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectBackupLoading, setProjectBackupLoading] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);
  const [dataImportLoading, setDataImportLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [form] = Form.useForm();

  const text = isZh
    ? {
        created: '项目已创建',
        projectBackupFailed: (status: number) => `项目备份失败: ${status}`,
        projectBackupName: '项目备份.zip',
        projectBackupStarted: '项目备份已开始下载',
        dataExportFailed: (status: number) => `数据导出失败: ${status}`,
        dataBackupName: '数据备份.zip',
        dataExportStarted: '数据备份已开始下载',
        dataImportFailed: (status: number) => `数据恢复失败: ${status}`,
        dataRestored: '数据恢复完成',
        workspace: '工作区',
        projectsLabel: '项目',
        allProjects: '全部项目',
        myProjects: '我的项目',
        projectBackup: '项目备份',
        dataExport: '数据导出',
        dataImport: '数据恢复',
        restoreConfirmTitle: '确定恢复数据备份？',
        restoreConfirmContent:
          '恢复会覆盖当前项目、文件版本、成员、用户和评论通知数据。',
        restore: '恢复',
        cancel: '取消',
        newProject: '新建项目',
        empty: '还没有项目',
        openProject: '打开',
        admin: '管理员',
        noDescription: '暂无描述',
        createProject: '新建项目',
        create: '创建',
        projectName: '项目名称',
        projectNamePlaceholder: '例如：齿轮箱设计',
        description: '简介',
        descriptionPlaceholder: '可选',
      }
    : {
        created: 'Project created',
        projectBackupFailed: (status: number) => `Project backup failed: ${status}`,
        projectBackupName: 'project-backup.zip',
        projectBackupStarted: 'Project backup download started',
        dataExportFailed: (status: number) => `Data export failed: ${status}`,
        dataBackupName: 'data-backup.zip',
        dataExportStarted: 'Data backup download started',
        dataImportFailed: (status: number) => `Data restore failed: ${status}`,
        dataRestored: 'Data restored',
        workspace: 'Workspace',
        projectsLabel: 'Projects',
        allProjects: 'All Projects',
        myProjects: 'My Projects',
        projectBackup: 'Project Backup',
        dataExport: 'Export Data',
        dataImport: 'Restore Data',
        restoreConfirmTitle: 'Restore a full data backup?',
        restoreConfirmContent:
          'This will overwrite current projects, file versions, members, users, comments, and notifications.',
        restore: 'Restore',
        cancel: 'Cancel',
        newProject: 'New Project',
        empty: 'No projects yet',
        openProject: 'Open',
        admin: 'Admin',
        noDescription: 'No description',
        createProject: 'Create Project',
        create: 'Create',
        projectName: 'Project Name',
        projectNamePlaceholder: 'For example: Gearbox Design',
        description: 'Description',
        descriptionPlaceholder: 'Optional',
      };

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
      message.success(text.created);
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
      if (!response.ok) throw new Error(text.projectBackupFailed(response.status));
      saveBlob(await response.blob(), text.projectBackupName);
      message.success(text.projectBackupStarted);
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
      if (!response.ok) throw new Error(text.dataExportFailed(response.status));
      saveBlob(await response.blob(), text.dataBackupName);
      message.success(text.dataExportStarted);
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
        let detail = text.dataImportFailed(response.status);
        try {
          const payload = await response.json();
          if (payload?.detail) detail = String(payload.detail);
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      message.success(text.dataRestored);
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
          <p className="apple-hero__eyebrow">{text.workspace}</p>
          <Typography.Title className="apple-hero__title">
            {user?.is_admin ? text.allProjects : text.myProjects}
          </Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {user?.email}
          </Typography.Paragraph>
        </div>
        <div className="apple-hero__meta">
          <div className="apple-stat">
            <span className="apple-stat__label">{text.projectsLabel}</span>
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
                  {text.projectBackup}
                </Button>
                <Button
                  className="apple-pill-button apple-outline-button"
                  onClick={() => void exportDataBackup()}
                  loading={dataExportLoading}
                >
                  {text.dataExport}
                </Button>
                <Button
                  className="apple-pill-button apple-outline-button"
                  onClick={() => restoreInputRef.current?.click()}
                  loading={dataImportLoading}
                >
                  {text.dataImport}
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
                      title: text.restoreConfirmTitle,
                      content: text.restoreConfirmContent,
                      okText: text.restore,
                      cancelText: text.cancel,
                      okButtonProps: { danger: true },
                      onOk: () => restoreDataBackup(file),
                    });
                  }}
                />
              </>
            )}
            <Button className="apple-pill-button" type="primary" onClick={() => setOpen(true)}>
              {text.newProject}
            </Button>
          </Space>
        </div>
      </section>

      <Card className="apple-surface apple-section-card" bordered={false}>
        <List
          loading={loading}
          locale={{ emptyText: <Empty className="apple-empty" description={text.empty} /> }}
          dataSource={items}
          renderItem={(project) => (
            <List.Item
              className="apple-list-item"
              actions={[
                <Link key="open" to={`/projects/${project.id}`}>
                  <Button className="apple-pill-button apple-outline-button" size="small">
                    {text.openProject}
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
                      <Tag color="gold">{text.admin}</Tag>
                    ) : (
                      <Tag color={ROLE_COLOR[project.my_role]}>{roleLabel(project.my_role)}</Tag>
                    )}
                  </Space>
                }
                description={
                  project.description || (
                    <Typography.Text type="secondary">{text.noDescription}</Typography.Text>
                  )
                }
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {formatDateTime(project.created_at)}
              </Typography.Text>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={text.createProject}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={text.create}
        cancelText={text.cancel}
      >
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item
            name="name"
            label={text.projectName}
            rules={[{ required: true, max: 128 }]}
          >
            <Input placeholder={text.projectNamePlaceholder} />
          </Form.Item>
          <Form.Item name="description" label={text.description} initialValue="">
            <Input.TextArea rows={3} placeholder={text.descriptionPlaceholder} maxLength={512} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
