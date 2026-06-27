import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Spin, Tag, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { getToken } from '../../api';
import { useI18n } from '../../i18n';
import FilePreview, { SolidWorksPreviewLauncher } from './index';
import { getPreviewKind, prettyBytes } from './utils';
import type { FileVersion } from '../../types';

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
  const [versionInfo, setVersionInfo] = useState<FileVersion | null>(null);
  const [stepTimedOut, setStepTimedOut] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const STEP_POLL_MAX = 30; // ~90s at 3s interval; then give up and degrade

  const kind = getPreviewKind(filename);
  const isSwFile = kind === 'solidworks';
  const hasStepDerivative = versionInfo?.step_blob_hash != null;
  const effectiveNeedsBlob = !isSwFile || hasStepDerivative;

  const text = isZh
    ? {
        downloadCurrentVersion: '下载此版本',
        loadingFile: '正在加载文件...',
        convertingStep: '正在转换 STEP 格式...',
        unableToLoadFile: '无法加载文件',
      }
    : {
        downloadCurrentVersion: 'Download This Version',
        loadingFile: 'Loading file...',
        convertingStep: 'Converting to STEP...',
        unableToLoadFile: 'Unable to Load File',
      };

  useEffect(() => {
    if (!open || !vid) {
      setBlob(null);
      setError(null);
      setVersionInfo(null);
      setStepTimedOut(false);
      pollCountRef.current = 0;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (!isSwFile) {
      setVersionInfo(null);
      const controller = new AbortController();
      setLoading(true);
      setError(null);

      fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/content`, {
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
    }

    const fetchVersionInfo = async () => {
      try {
        const response = await fetch(`/api/projects/${pid}/files/${fid}/versions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!response.ok) return;
        const versions = (await response.json()) as FileVersion[];
        const v = versions.find((x) => x.id === vid);
        if (v) setVersionInfo(v);
      } catch {
        // ignore
      }
    };

    fetchVersionInfo();

    pollingRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= STEP_POLL_MAX) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setStepTimedOut(true);
        return;
      }
      fetchVersionInfo();
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [open, pid, fid, vid, isSwFile]);

  useEffect(() => {
    if (!isSwFile || !hasStepDerivative || !vid) return;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/step-content`, {
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
  }, [isSwFile, hasStepDerivative, pid, fid, vid]);

  const triggerDownload = async () => {
    if (!vid) return;
    try {
      const response = await fetch(
        `/api/projects/${pid}/files/${fid}/versions/${vid}/download`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

  const displayKind = isSwFile && hasStepDerivative ? 'step' : kind;

  return (
    <Modal
      className="apple-preview-modal"
      title={
        <span>
          <Typography.Text strong>{filename}</Typography.Text>{' '}
          {versionNo != null && <Tag color="blue">v{versionNo}</Tag>}
          {blob && (
            <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
              {prettyBytes(blob.size)} · {displayKind}
            </Typography.Text>
          )}
          {!effectiveNeedsBlob && (
            <Typography.Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
              {displayKind}
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
          disabled={effectiveNeedsBlob && !blob}
        >
          {text.downloadCurrentVersion}
        </Button>
      }
      destroyOnClose
    >
      <div className="apple-preview-stage">
        {isSwFile && !hasStepDerivative && !stepTimedOut && !error && (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <Spin tip={text.convertingStep} size="large" />
          </div>
        )}
        {effectiveNeedsBlob && loading && (
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
        {effectiveNeedsBlob && blob && !loading && !error && (
          <FilePreview blob={blob} filename={hasStepDerivative ? 'model.step' : filename} />
        )}
        {!effectiveNeedsBlob && vid != null && !error && (
          <SolidWorksPreviewLauncher pid={pid} fid={fid} vid={vid} filename={filename} />
        )}
      </div>
    </Modal>
  );
}
