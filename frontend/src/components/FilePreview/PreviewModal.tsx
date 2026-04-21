import { useEffect, useState } from 'react';
import { Alert, Button, Modal, Spin, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { getToken } from '../../api';
import { useI18n } from '../../i18n';
import FilePreview, { SolidWorksPreviewLauncher } from './index';
import { getPreviewKind, prettyBytes } from './utils';

interface Props {
  open: boolean;
  onClose: () => void;
  pid: number;
  fid: number;
  vid: number | null;
  filename: string;
  versionNo?: number | null;
}

export default function PreviewModal({
  open,
  onClose,
  pid,
  fid,
  vid,
  filename,
  versionNo,
}: Props) {
  const { isZh } = useI18n();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = getPreviewKind(filename);
  const needsBlob = kind !== 'solidworks';
  const text = isZh
    ? {
        downloadCurrentVersion: '下载此版本',
        loadingFile: '正在加载文件...',
        unableToLoadFile: '无法加载文件',
      }
    : {
        downloadCurrentVersion: 'Download This Version',
        loadingFile: 'Loading file...',
        unableToLoadFile: 'Unable to Load File',
      };

  useEffect(() => {
    if (!open || !vid) {
      setBlob(null);
      setError(null);
      return;
    }

    if (!needsBlob) {
      setBlob(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/download?preview=1`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((nextBlob) => setBlob(nextBlob))
      .catch((nextError) => {
        if (nextError.name !== 'AbortError') setError(String(nextError));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, pid, fid, vid, needsBlob]);

  const triggerDownload = async () => {
    if (!vid) return;
    try {
      const response = await fetch(
        `/api/projects/${pid}/files/${fid}/versions/${vid}/download`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const fetched = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(fetched);
      link.download = versionNo ? `${filename}.v${versionNo}` : filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Modal
      className="apple-preview-modal"
      title={
        <span>
          <Typography.Text strong>{filename}</Typography.Text>{' '}
          {versionNo != null && <Tag color="blue">v{versionNo}</Tag>}
          {blob && (
            <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
              {prettyBytes(blob.size)} · {kind}
            </Typography.Text>
          )}
          {!needsBlob && (
            <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
              {kind}
            </Typography.Text>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      width="90vw"
      style={{ top: 20 }}
      footer={
        <Button
          className="apple-pill-button"
          icon={<DownloadOutlined />}
          onClick={triggerDownload}
          disabled={needsBlob && !blob}
        >
          {text.downloadCurrentVersion}
        </Button>
      }
      destroyOnClose
    >
      <div className="apple-preview-stage">
        {needsBlob && loading && (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <Spin tip={text.loadingFile} size="large" />
          </div>
        )}
        {error && (
          <Alert
            type="error"
            showIcon
            message={text.unableToLoadFile}
            description={error}
            style={{ margin: 24 }}
          />
        )}
        {needsBlob && blob && !loading && !error && (
          <FilePreview blob={blob} filename={filename} />
        )}
        {!needsBlob && vid != null && !error && (
          <SolidWorksPreviewLauncher pid={pid} fid={fid} vid={vid} filename={filename} />
        )}
      </div>
    </Modal>
  );
}
