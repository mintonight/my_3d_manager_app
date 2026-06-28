import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { DownloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { api, extractError, getToken } from '../api';
import { useI18n } from '../i18n';
import type { Snapshot, SnapshotListItem } from '../types';

interface Props {
  pid: number;
  canRollback: boolean;
  onChanged: () => void;
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

export default function SnapshotPanel({ pid, canRollback, onChanged }: Props) {
  const { isZh, formatDateTime } = useI18n();
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Snapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  const text = isZh
    ? {
        title: '项目快照',
        subtitle: '每次上传或删除都会产生一个项目级快照，可整体回滚到任意时刻。',
        empty: '还没有快照',
        loading: '加载中...',
        current: '当前',
        files: (n: number) => `${n} 个文件`,
        rollback: '回滚到此快照',
        rollbackConfirm: (n: number) =>
          `确定回滚到此快照？项目所有文件（含装配体）会一起回到该时刻。被删的文件会恢复，之后新增的会被隐藏。历史不会丢失。`,
        rollbackDone: '已回滚到该快照',
        download: '下载该快照',
        detailTitle: (id: number) => `快照 #${id} 详情`,
        fileColumn: '文件',
        versionColumn: '版本',
        sizeColumn: '大小',
      }
    : {
        title: 'Project Snapshots',
        subtitle: 'Each upload or delete creates a project-level snapshot you can roll back to.',
        empty: 'No snapshots yet',
        loading: 'Loading...',
        current: 'Current',
        files: (n: number) => `${n} files`,
        rollback: 'Roll back to this snapshot',
        rollbackConfirm: (n: number) =>
          `Roll back to this snapshot? All files (including assemblies) return to that moment. Deleted files are restored; files added later are hidden. History is preserved.`,
        rollbackDone: 'Rolled back to this snapshot',
        download: 'Download this snapshot',
        detailTitle: (id: number) => `Snapshot #${id}`,
        fileColumn: 'File',
        versionColumn: 'Version',
        sizeColumn: 'Size',
      };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<SnapshotListItem[]>(`/projects/${pid}/snapshots`);
      setSnapshots(res.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [pid]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await api.get<Snapshot>(`/projects/${pid}/snapshots/${id}`);
      setDetail(res.data);
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const rollback = async (id: number) => {
    setRollingBack(id);
    try {
      await api.post(`/projects/${pid}/snapshots/${id}/rollback`);
      message.success(text.rollbackDone);
      await load();
      onChanged();
    } catch (error) {
      message.error(extractError(error));
    } finally {
      setRollingBack(null);
    }
  };

  const download = async (id: number) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/projects/${pid}/snapshots/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      saveBlob(blob, `project-${pid}-snapshot-${id}.zip`);
    } catch (error) {
      message.error(String(error));
    }
  };

  const timelineItems = snapshots.map((s) => ({
    color: s.is_head ? 'green' : 'gray',
    children: (
      <div style={{ paddingBottom: 8 }}>
        <Space wrap align="center" style={{ marginBottom: 4 }}>
          <Typography.Text strong>#{s.id}</Typography.Text>
          {s.is_head && <Tag color="green">{text.current}</Tag>}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {s.author_username} · {formatDateTime(s.created_at)} · {text.files(s.file_count)}
          </Typography.Text>
        </Space>
        <div style={{ marginBottom: 8 }}>
          <Typography.Text>{s.message}</Typography.Text>
        </div>
        <Space wrap>
          <Button size="small" className="apple-outline-button" onClick={() => openDetail(s.id)}>
            {text.detailTitle(s.id)}
          </Button>
          {canRollback && !s.is_head && (
            <Popconfirm
              title={text.rollbackConfirm(s.id)}
              onConfirm={() => rollback(s.id)}
              okText={text.rollback}
              okButtonProps={{ danger: true }}
              cancelText={isZh ? '取消' : 'Cancel'}
            >
              <Button
                size="small"
                className="apple-outline-button"
                icon={<RollbackOutlined />}
                loading={rollingBack === s.id}
              >
                {text.rollback}
              </Button>
            </Popconfirm>
          )}
          <Button
            size="small"
            className="apple-outline-button"
            icon={<DownloadOutlined />}
            onClick={() => download(s.id)}
          >
            {text.download}
          </Button>
        </Space>
      </div>
    ),
  }));

  return (
    <div>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {text.subtitle}
      </Typography.Paragraph>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin tip={text.loading} />
        </div>
      ) : snapshots.length === 0 ? (
        <Empty className="apple-empty" description={text.empty} />
      ) : (
        <Timeline items={timelineItems} />
      )}

      <Drawer
        title={detail ? text.detailTitle(detail.id) : text.title}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
      >
        {detailLoading || !detail ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : (
          <div>
            <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
              <Typography.Text strong>{detail.message}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {detail.author_username} · {formatDateTime(detail.created_at)} · {text.files(detail.file_count)}
              </Typography.Text>
            </Space>
            <Table
              rowKey="file_id"
              dataSource={detail.files}
              pagination={false}
              size="small"
              columns={[
                {
                  title: text.fileColumn,
                  dataIndex: 'file_name',
                  render: (name: string) => <Typography.Text>{name}</Typography.Text>,
                },
                {
                  title: text.versionColumn,
                  dataIndex: 'version_no',
                  width: 80,
                  render: (v: number) => <Tag color="blue">v{v}</Tag>,
                },
                {
                  title: text.sizeColumn,
                  dataIndex: 'size_bytes',
                  width: 100,
                  render: (n: number) => {
                    if (n < 1024) return `${n} B`;
                    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
                    return `${(n / 1024 / 1024).toFixed(2)} MB`;
                  },
                },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
