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
import { useI18n } from '../i18n';
import UploadFile from '../components/UploadFile';
import MemberPanel from '../components/MemberPanel';
import SnapshotPanel from '../components/SnapshotPanel';
import PreviewModal from '../components/FilePreview/PreviewModal';
import { isPreviewable } from '../components/FilePreview/utils';
import CommentPanel from '../components/CommentPanel';
import type { FileItem, Project, Role } from '../types';

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
  const { isZh, formatDateTime, roleLabel } = useI18n();
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

  const text = isZh
    ? {
        allProjects: '全部项目',
        myProjects: '我的项目',
        workspace: '项目工作区',
        filesLabel: '文件',
        subtitle: '版本历史、文件预览和协作成员都收束在这一处。',
        admin: '管理员',
        downloadProjectFailed: (status: number) => `下载失败: ${status}`,
        projectDownloaded: '项目已打包下载',
        deletedFile: '文件已删除',
        deletedProject: '项目已删除',
        filesTab: (count: number) => `文件 (${count})`,
        membersTab: '成员',
        snapshotsTab: '快照',
        uploadNewFile: '上传新文件',
        uploadFolder: '上传文件夹',
        viewerInfo: '查看者只能浏览、搜索、评论和下载文件。',
        searchPlaceholder: '在当前项目内搜索文件',
        noSearchResults: '没有匹配的文件',
        noFiles: '还没有文件',
        fileName: '文件名',
        currentVersion: '当前版本',
        noVersion: '无版本',
        createdAt: '创建时间',
        actions: '操作',
        preview: '预览',
        downloadCurrent: '下载当前版本',
        comments: '评论',
        commitNewVersion: '提交新版本',
        history: '历史',
        delete: '删除',
        deleteProject: '删除项目',
        deleteProjectConfirm: '确定删除这个项目？所有文件和版本都会被一起删除。',
        deleteFileConfirm: '确定删除这个文件及其所有版本？',
        downloadProject: '下载项目',
        fileCommentsTitle: (name: string) => `文件评论 · ${name}`,
      }
    : {
        allProjects: 'All Projects',
        myProjects: 'My Projects',
        workspace: 'Project Workspace',
        filesLabel: 'Files',
        subtitle: 'Version history, file preview, and collaborators are gathered in one place.',
        admin: 'Admin',
        downloadProjectFailed: (status: number) => `Download failed: ${status}`,
        projectDownloaded: 'Project archive downloaded',
        deletedFile: 'File deleted',
        deletedProject: 'Project deleted',
        filesTab: (count: number) => `Files (${count})`,
        membersTab: 'Members',
        snapshotsTab: 'Snapshots',
        uploadNewFile: 'Upload New File',
        uploadFolder: 'Upload Folder',
        viewerInfo: 'Viewers can browse, search, comment on, and download files only.',
        searchPlaceholder: 'Search files in this project',
        noSearchResults: 'No matching files',
        noFiles: 'No files yet',
        fileName: 'File Name',
        currentVersion: 'Current Version',
        noVersion: 'No Version',
        createdAt: 'Created At',
        actions: 'Actions',
        preview: 'Preview',
        downloadCurrent: 'Download Current',
        comments: 'Comments',
        commitNewVersion: 'Commit New Version',
        history: 'History',
        delete: 'Delete',
        deleteProject: 'Delete Project',
        deleteProjectConfirm: 'Delete this project? All files and versions will be removed.',
        deleteFileConfirm: 'Delete this file and all of its versions?',
        downloadProject: 'Download Project',
        fileCommentsTitle: (name: string) => `File Comments · ${name}`,
      };

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
      if (!response.ok) throw new Error(text.downloadProjectFailed(response.status));
      const blob = await response.blob();
      saveBlob(blob, name);
    } catch (error) {
      message.error(String(error));
    }
  };

  const deleteFile = async (fid: number) => {
    try {
      await api.delete(`/projects/${pidNum}/files/${fid}`);
      message.success(text.deletedFile);
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const deleteProject = async () => {
    try {
      await api.delete(`/projects/${pidNum}`);
      message.success(text.deletedProject);
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
        message.error(text.downloadProjectFailed(response.status));
        return;
      }
      const blob = await response.blob();
      saveBlob(blob, `${project.name}.zip`);
      message.success(text.projectDownloaded);
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
  const roleTagText = adminOverride ? text.admin : roleLabel(project.my_role);

  return (
    <div className="apple-page">
      <Breadcrumb
        className="apple-page__crumbs"
        items={[
          { title: <Link to="/projects">{user?.is_admin ? text.allProjects : text.myProjects}</Link> },
          { title: project.name },
        ]}
      />

      <section className="apple-hero">
        <div className="apple-hero__copy">
          <p className="apple-hero__eyebrow">{text.workspace}</p>
          <Typography.Title className="apple-hero__title">{project.name}</Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {project.description || text.subtitle}
          </Typography.Paragraph>
        </div>
        <div className="apple-hero__meta">
          <Tag color={adminOverride ? 'gold' : 'blue'}>{roleTagText}</Tag>
          <div className="apple-stat">
            <span className="apple-stat__label">{text.filesLabel}</span>
            <span className="apple-stat__value">{allFiles.length}</span>
          </div>
          <Space wrap>
            <Button
              className="apple-pill-button apple-outline-button"
              onClick={() => void downloadProject()}
              disabled={allFiles.length === 0}
              loading={projectDownloading}
            >
              {text.downloadProject}
            </Button>
            {isOwner && (
              <Popconfirm
                title={text.deleteProjectConfirm}
                onConfirm={() => void deleteProject()}
                okText={text.delete}
                okButtonProps={{ danger: true }}
                cancelText={isZh ? '取消' : 'Cancel'}
              >
                <Button className="apple-pill-button" danger>
                  {text.deleteProject}
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
              label: text.filesTab(allFiles.length),
              children: (
                <div>
                  <div className="apple-toolbar">
                    <div className="apple-toolbar__group">
                      {editable ? (
                        <>
                          <UploadFile pid={pidNum} mode="file" buttonText={text.uploadNewFile} onDone={load} />
                          <UploadFile pid={pidNum} mode="folder" buttonText={text.uploadFolder} onDone={load} />
                        </>
                      ) : (
                        <Alert type="info" message={text.viewerInfo} showIcon />
                      )}
                    </div>
                    <Input
                      className="apple-search-input"
                      allowClear
                      value={fileQuery}
                      prefix={<SearchOutlined />}
                      suffix={searching ? <Spin size="small" /> : null}
                      placeholder={text.searchPlaceholder}
                      style={{ width: 320, maxWidth: '100%' }}
                      onChange={(event) => setFileQuery(event.target.value)}
                    />
                  </div>

                  {files.length === 0 ? (
                    <Empty
                      className="apple-empty"
                      description={fileQuery.trim() ? text.noSearchResults : text.noFiles}
                    />
                  ) : (
                    <Table
                      rowKey="id"
                      dataSource={files}
                      pagination={false}
                      sortDirections={['ascend', 'descend']}
                      columns={[
                        {
                          title: text.fileName,
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
                          title: text.currentVersion,
                          dataIndex: 'current_version_no',
                          sorter: (a: FileItem, b: FileItem) =>
                            (a.current_version_no ?? -1) - (b.current_version_no ?? -1),
                          render: (value: number | null) =>
                            value ? <Tag color="green">v{value}</Tag> : <Tag>{text.noVersion}</Tag>,
                        },
                        {
                          title: text.createdAt,
                          dataIndex: 'created_at',
                          defaultSortOrder: 'descend',
                          sorter: (a: FileItem, b: FileItem) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                          render: (createdAt: string) => formatDateTime(createdAt),
                        },
                        {
                          title: text.actions,
                          render: (_: unknown, row: FileItem) => (
                            <Space wrap>
                              {row.current_version_id && isPreviewable(row.name) && (
                                <Button size="small" type="link" onClick={() => setPreviewing(row)}>
                                  {text.preview}
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
                                  {text.downloadCurrent}
                                </Button>
                              )}
                              <Button
                                size="small"
                                className="apple-outline-button"
                                onClick={() => setCommentFile(row)}
                              >
                                {text.comments}
                              </Button>
                              {editable && (
                                <UploadFile
                                  pid={pidNum}
                                  fid={row.id}
                                  buttonText={text.commitNewVersion}
                                  onDone={load}
                                />
                              )}
                              <Link to={`/projects/${pidNum}/files/${row.id}`}>
                                <Button size="small" className="apple-outline-button">
                                  {text.history}
                                </Button>
                              </Link>
                              {isOwner && (
                                <Popconfirm
                                  title={text.deleteFileConfirm}
                                  onConfirm={() => void deleteFile(row.id)}
                                  okText={text.delete}
                                  okButtonProps={{ danger: true }}
                                  cancelText={isZh ? '取消' : 'Cancel'}
                                >
                                  <Button size="small" danger>
                                    {text.delete}
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
              label: text.membersTab,
              children: <MemberPanel pid={pidNum} myRole={project.my_role} />,
            },
            {
              key: 'snapshots',
              label: text.snapshotsTab,
              children: (
                <SnapshotPanel pid={pidNum} canRollback={editable} onChanged={load} />
              ),
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
          title={text.fileCommentsTitle(commentFile.name)}
          currentUser={user}
          onClose={closeFileComments}
          highlightCommentId={targetCommentId || undefined}
          notificationId={targetNotificationId || undefined}
        />
      )}
    </div>
  );
}
