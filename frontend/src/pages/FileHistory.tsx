import { useEffect, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, extractError, getToken } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import PreviewModal from '../components/FilePreview/PreviewModal';
import { isPreviewable } from '../components/FilePreview/utils';
import CommentPanel from '../components/CommentPanel';
import type { FileItem, FileVersion, Project, Role } from '../types';

function canEdit(role?: Role) {
  return role === 'owner' || role === 'editor';
}

function prettySize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileHistory() {
  const { pid, fid } = useParams<{ pid: string; fid: string }>();
  const pidNum = Number(pid);
  const fidNum = Number(fid);
  const { user } = useAuth();
  const { isZh, formatDateTime } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [file, setFile] = useState<FileItem | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<FileVersion | null>(null);
  const [commentVersion, setCommentVersion] = useState<FileVersion | null>(null);

  const targetVersionId = Number(searchParams.get('versionComment') || '');
  const targetCommentId = Number(searchParams.get('commentId') || '');
  const targetNotificationId = Number(searchParams.get('notificationId') || '');

  const text = isZh
    ? {
        allProjects: '全部项目',
        myProjects: '我的项目',
        timeline: '文件时间线',
        subtitle: '当前文件的版本时间线、提交信息与回滚入口。',
        versionsLabel: '版本数',
        noCommitMessage: '没有提交说明',
        preview: '预览',
        download: '下载',
        comments: '评论',
        rollback: '回滚',
        rollbackTo: '回滚到此版本',
        rollbackConfirm: (versionNo: number) =>
          `回滚到 v${versionNo}？当前版本指针会移动到这里，历史版本仍会保留。`,
        currentVersion: '当前版本',
        commentsTitle: (versionNo: number) => `版本评论 · v${versionNo}`,
      }
    : {
        allProjects: 'All Projects',
        myProjects: 'My Projects',
        timeline: 'File Timeline',
        subtitle: 'Version timeline, commit information, and rollback entry for the current file.',
        versionsLabel: 'Versions',
        noCommitMessage: 'No commit message',
        preview: 'Preview',
        download: 'Download',
        comments: 'Comments',
        rollback: 'Rollback',
        rollbackTo: 'Rollback to This Version',
        rollbackConfirm: (versionNo: number) =>
          `Rollback to v${versionNo}? The current pointer will move here while history stays intact.`,
        currentVersion: 'Current Version',
        commentsTitle: (versionNo: number) => `Version Comments · v${versionNo}`,
      };

  const load = async () => {
    setLoading(true);
    try {
      const [projectResponse, fileResponse, versionResponse] = await Promise.all([
        api.get<Project>(`/projects/${pidNum}`),
        api.get<FileItem[]>(`/projects/${pidNum}/files`),
        api.get<FileVersion[]>(`/projects/${pidNum}/files/${fidNum}/versions`),
      ]);
      setProject(projectResponse.data);
      setFile(fileResponse.data.find((item) => item.id === fidNum) ?? null);
      setVersions(versionResponse.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pidNum, fidNum]);

  useEffect(() => {
    if (!targetVersionId || !versions.length) return;
    const target = versions.find((version) => version.id === targetVersionId);
    if (target) setCommentVersion(target);
  }, [targetVersionId, versions]);

  const closeVersionComments = () => {
    setCommentVersion(null);
    if (searchParams.get('versionComment')) {
      const next = new URLSearchParams(searchParams);
      next.delete('versionComment');
      next.delete('commentId');
      next.delete('notificationId');
      setSearchParams(next);
    }
  };

  const rollback = async (versionId: number) => {
    try {
      await api.post(`/projects/${pidNum}/files/${fidNum}/rollback/${versionId}`);
      message.success(isZh ? '已回滚到指定版本' : 'Rolled back to the selected version');
      await load();
    } catch (error) {
      message.error(extractError(error));
    }
  };

  const download = async (version: FileVersion) => {
    if (!file) return;
    try {
      const token = getToken();
      const response = await fetch(`/api/projects/${pidNum}/files/${fidNum}/versions/${version.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${file.name}.v${version.version_no}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      message.error(String(error));
    }
  };

  if (loading || !project || !file) {
    return (
      <div className="apple-loading">
        <Spin size="large" />
      </div>
    );
  }

  const editable = canEdit(project.my_role);

  return (
    <div className="apple-page">
      <Breadcrumb
        className="apple-page__crumbs"
        items={[
          { title: <Link to="/projects">{user?.is_admin ? text.allProjects : text.myProjects}</Link> },
          { title: <Link to={`/projects/${pidNum}`}>{project.name}</Link> },
          { title: file.name },
        ]}
      />

      <section className="apple-hero">
        <div className="apple-hero__copy">
          <p className="apple-hero__eyebrow">{text.timeline}</p>
          <Typography.Title className="apple-hero__title">{file.name}</Typography.Title>
          <Typography.Paragraph className="apple-hero__subtitle">
            {text.subtitle}
          </Typography.Paragraph>
        </div>
        <div className="apple-hero__meta">
          <div className="apple-stat">
            <span className="apple-stat__label">{text.currentVersion}</span>
            <span className="apple-stat__value">v{file.current_version_no ?? '0'}</span>
          </div>
          <div className="apple-stat">
            <span className="apple-stat__label">{text.versionsLabel}</span>
            <span className="apple-stat__value">{versions.length}</span>
          </div>
        </div>
      </section>

      <Card className="apple-surface apple-section-card" bordered={false}>
        <Timeline
          mode="left"
          items={versions.map((version) => ({
            color: version.is_current ? 'green' : 'gray',
            label: (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {formatDateTime(version.created_at)}
              </Typography.Text>
            ),
            children: (
              <Card className="apple-history-card" size="small" bordered={false}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={version.is_current ? 'green' : 'blue'}>v{version.version_no}</Tag>
                    {version.is_current && <Tag color="green">{text.currentVersion}</Tag>}
                    <Typography.Text strong>{version.author_username}</Typography.Text>
                    <Typography.Text type="secondary">{prettySize(version.size_bytes)}</Typography.Text>
                  </Space>
                  <Typography.Paragraph style={{ margin: 0 }}>
                    {version.commit_message || (
                      <span style={{ color: 'var(--ln-text-quaternary)' }}>{text.noCommitMessage}</span>
                    )}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                    sha256: {version.blob_hash.slice(0, 16)}...
                  </Typography.Text>
                  <Space wrap>
                    {isPreviewable(file.name) && (
                      <Button size="small" type="link" onClick={() => setPreviewing(version)}>
                        {text.preview}
                      </Button>
                    )}
                    <Button size="small" className="apple-outline-button" onClick={() => void download(version)}>
                      {text.download}
                    </Button>
                    <Button
                      size="small"
                      className="apple-outline-button"
                      onClick={() => setCommentVersion(version)}
                    >
                      {text.comments}
                    </Button>
                    {editable && !version.is_current && (
                      <Popconfirm
                        title={text.rollbackConfirm(version.version_no)}
                        onConfirm={() => void rollback(version.id)}
                        okText={text.rollback}
                        cancelText={isZh ? '取消' : 'Cancel'}
                      >
                        <Button size="small" className="apple-pill-button" type="primary">
                          {text.rollbackTo}
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Space>
              </Card>
            ),
          }))}
        />
      </Card>

      {previewing && (
        <PreviewModal
          open={!!previewing}
          onClose={() => setPreviewing(null)}
          pid={pidNum}
          fid={fidNum}
          vid={previewing.id}
          versionNo={previewing.version_no}
          filename={file.name}
        />
      )}

      {commentVersion && (
        <CommentPanel
          pid={pidNum}
          fid={fidNum}
          versionId={commentVersion.id}
          open={!!commentVersion}
          title={text.commentsTitle(commentVersion.version_no)}
          currentUser={user}
          onClose={closeVersionComments}
          highlightCommentId={targetCommentId || undefined}
          notificationId={targetNotificationId || undefined}
        />
      )}
    </div>
  );
}
