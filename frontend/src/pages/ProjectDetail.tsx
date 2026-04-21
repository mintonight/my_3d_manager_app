import { useEffect, useState } from 'react';
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError, getToken } from '../api';
import { useAuth } from '../auth';
import UploadFile from '../components/UploadFile';
import MemberPanel from '../components/MemberPanel';
import PreviewModal from '../components/FilePreview/PreviewModal';
import { isPreviewable } from '../components/FilePreview/utils';
import CommentPanel from '../components/CommentPanel';
import type { FileItem, Project, Role } from '../types';

const ROLE_LABEL: Record<Role, string> = {
  owner: '所有者',
  editor: '编辑者',
  viewer: '查看者',
};

function canEdit(role?: Role) {
  return role === 'owner' || role === 'editor';
}

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

export default function ProjectDetail() {
  const { pid } = useParams<{ pid: string }>();
  const pidNum = Number(pid);
  const nav = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [projectDownloading, setProjectDownloading] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [previewing, setPreviewing] = useState<FileItem | null>(null);
  const [commentFile, setCommentFile] = useState<FileItem | null>(null);

  const targetFileId = Number(searchParams.get('fileComment') || '');
  const targetCommentId = Number(searchParams.get('commentId') || '');
  const targetNotificationId = Number(searchParams.get('notificationId') || '');

  const load = async () => {
    setLoading(true);
    try {
      const [projectResponse, fileResponse] = await Promise.all([
        api.get<Project>(`/projects/${pidNum}`),
        api.get<FileItem[]>(`/projects/${pidNum}/files`),
      ]);
      setProject(projectResponse.data);
      setAllFiles(fileResponse.data);
      setFiles(fileResponse.data);
    } catch (error) {
      message.error(extractError(error));
      nav('/projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pidNum]);

  useEffect(() => {
    if (!allFiles.length || !targetFileId) return;
    const target = allFiles.find((file) => file.id === targetFileId);
    if (target) setCommentFile(target);
  }, [allFiles, targetFileId]);

  useEffect(() => {
    const trimmed = fileQuery.trim();
    if (!trimmed) {
      setFiles(allFiles);
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get<FileItem[]>(`/projects/${pidNum}/search`, {
          params: { q: trimmed },
        });
        setFiles(response.data);
      } catch (error) {
        message.error(extractError(error));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [allFiles, fileQuery, pidNum]);

  const closeFileComments = () => {
    setCommentFile(null);
    if (searchParams.get('fileComment')) {
      const next = new URLSearchParams(searchParams);
      next.delete('fileComment');
      next.delete('commentId');
      next.delete('notificationId');
      setSearchParams(next);
    }
  };

  const download = async (fid: number, vid: number, name: string) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/projects/${pidNum}/files/${fid}/versions/${vid}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`下载失败: ${response.status}`);
      const blob = await response.blob();
      saveBlob(blob, name);
    } catch (error) {
      message.error(String(error));
    }
  };

  const deleteFile = async (fid: number) => {
    try {
      await api.delete(`/projects/${pidNum}/files/${fid}`);
      message.success('文件已删除');
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const deleteProject = async () => {
    try {
      await api.delete(`/projects/${pidNum}`);
      message.success('项目已删除');
      nav('/projects');
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const downloadProject = async () => {
    if (!project) return;
    setProjectDownloading(true);
    try {
      const token = getToken();
      const response = await fetch(`/api/projects/${pidNum}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        message.error(`下载失败: ${response.status}`);
        return;
      }
      const blob = await response.blob();
      saveBlob(blob, `${project.name}.zip`);
      message.success('项目已打包下载');
    } catch (error) {
      message.error(String(error));
    } finally {
      setProjectDownloading(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="apple-loading">
        <Spin size="large" />
      </div>
    );
  }

  const editable = canEdit(project.my_role);
  const isOwner = project.my_role === 'owner';
  const adminOverride = !!user?.is_admin && project.owner_id !== user.id;
  const roleTagText = adminOverride ? '管理员' : ROLE_LABEL[project.my_role];

  return (
    <div className="apple-page">
      <Breadcrumb
        className="apple-page__crumbs"
        items={[
          { title: <Link to="/projects">{user?.is_admin ? '全部项目' : '我的项目'}</Link> },
          { title: project.name },
        ]}
      />

      <section className="apple-hero">
        <div className="apple-hero__copy">
          <p className="apple-hero__eyebrow">Project workspace</p>
          <Typography.Title className="apple-hero__title">
            {project.name}
          </Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {project.description || '版本历史、文件预览和协作成员都收束在这一处。'}
          </Typography.Paragraph>
        </div>
        <div className="apple-hero__meta">
          <Tag color={adminOverride ? 'gold' : 'blue'}>{roleTagText}</Tag>
          <div className="apple-stat">
            <span className="apple-stat__label">Files</span>
            <span className="apple-stat__value">{allFiles.length}</span>
          </div>
          <Space wrap>
            <Button
              className="apple-pill-button apple-outline-button"
              onClick={() => void downloadProject()}
              disabled={allFiles.length === 0}
              loading={projectDownloading}
            >
              下载项目
            </Button>
            {isOwner && (
              <Popconfirm
                title="确定删除这个项目？所有文件和版本都会被一起删除。"
                onConfirm={() => void deleteProject()}
                okText="删除"
                okButtonProps={{ danger: true }}
                cancelText="取消"
              >
                <Button className="apple-pill-button" danger>
                  删除项目
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </section>

      <Card className="apple-surface apple-section-card" bordered={false}>
        <Tabs
          defaultActiveKey="files"
          items={[
            {
              key: 'files',
              label: `文件 (${allFiles.length})`,
              children: (
                <div>
                  <div className="apple-toolbar">
                    <div className="apple-toolbar__group">
                      {editable ? (
                        <>
                          <UploadFile pid={pidNum} mode="file" buttonText="上传新文件" onDone={load} />
                          <UploadFile pid={pidNum} mode="folder" buttonText="上传文件夹" onDone={load} />
                        </>
                      ) : (
                        <Alert
                          type="info"
                          message="查看者只能浏览、搜索、评论和下载文件。"
                          showIcon
                        />
                      )}
                    </div>
                    <Input
                      className="apple-search-input"
                      allowClear
                      value={fileQuery}
                      prefix={<SearchOutlined />}
                      suffix={searching ? <Spin size="small" /> : null}
                      placeholder="在当前项目内搜索文件"
                      style={{ width: 320, maxWidth: '100%' }}
                      onChange={(event) => setFileQuery(event.target.value)}
                    />
                  </div>

                  {files.length === 0 ? (
                    <Empty
                      className="apple-empty"
                      description={fileQuery.trim() ? '没有匹配的文件' : '还没有文件'}
                    />
                  ) : (
                    <Table
                      rowKey="id"
                      dataSource={files}
                      pagination={false}
                      sortDirections={['ascend', 'descend']}
                      columns={[
                        {
                          title: '文件名',
                          dataIndex: 'name',
                          sorter: (a: FileItem, b: FileItem) =>
                            a.name.localeCompare(b.name, 'zh-Hans-CN', {
                              numeric: true,
                              sensitivity: 'base',
                            }),
                          render: (name: string, row: FileItem) => (
                            <Link to={`/projects/${pidNum}/files/${row.id}`}>{name}</Link>
                          ),
                        },
                        {
                          title: '当前版本',
                          dataIndex: 'current_version_no',
                          sorter: (a: FileItem, b: FileItem) =>
                            (a.current_version_no ?? -1) - (b.current_version_no ?? -1),
                          render: (value: number | null) =>
                            value ? <Tag color="green">v{value}</Tag> : <Tag>无版本</Tag>,
                        },
                        {
                          title: '创建时间',
                          dataIndex: 'created_at',
                          defaultSortOrder: 'descend',
                          sorter: (a: FileItem, b: FileItem) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                          render: (createdAt: string) => new Date(createdAt).toLocaleString('zh-CN'),
                        },
                        {
                          title: '操作',
                          render: (_: unknown, row: FileItem) => (
                            <Space wrap>
                              {row.current_version_id && isPreviewable(row.name) && (
                                <Button size="small" type="link" onClick={() => setPreviewing(row)}>
                                  预览
                                </Button>
                              )}
                              {row.current_version_id && (
                                <Button
                                  size="small"
                                  className="apple-outline-button"
                                  onClick={() =>
                                    void download(
                                      row.id,
                                      row.current_version_id!,
                                      `${row.name}.v${row.current_version_no}`,
                                    )
                                  }
                                >
                                  下载当前版本
                                </Button>
                              )}
                              <Button
                                size="small"
                                className="apple-outline-button"
                                onClick={() => setCommentFile(row)}
                              >
                                评论
                              </Button>
                              {editable && (
                                <UploadFile
                                  pid={pidNum}
                                  fid={row.id}
                                  buttonText="提交新版本"
                                  onDone={load}
                                />
                              )}
                              <Link to={`/projects/${pidNum}/files/${row.id}`}>
                                <Button size="small" className="apple-outline-button">
                                  历史
                                </Button>
                              </Link>
                              {isOwner && (
                                <Popconfirm
                                  title="确定删除这个文件及其所有版本？"
                                  onConfirm={() => void deleteFile(row.id)}
                                  okText="删除"
                                  okButtonProps={{ danger: true }}
                                  cancelText="取消"
                                >
                                  <Button size="small" danger>
                                    删除
                                  </Button>
                                </Popconfirm>
                              )}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'members',
              label: '成员',
              children: <MemberPanel pid={pidNum} myRole={project.my_role} />,
            },
          ]}
        />
      </Card>

      {previewing && (
        <PreviewModal
          open={!!previewing}
          onClose={() => setPreviewing(null)}
          pid={pidNum}
          fid={previewing.id}
          vid={previewing.current_version_id}
          versionNo={previewing.current_version_no}
          filename={previewing.name}
        />
      )}

      {commentFile && (
        <CommentPanel
          pid={pidNum}
          fid={commentFile.id}
          open={!!commentFile}
          title={`文件评论 · ${commentFile.name}`}
          currentUser={user}
          onClose={closeFileComments}
          highlightCommentId={targetCommentId || undefined}
          notificationId={targetNotificationId || undefined}
        />
      )}
    </div>
  );
}
