import { useState } from 'react';
import { Button, Space, Typography, message } from 'antd';
import { getToken } from '../../api';
import { useI18n } from '../../i18n';

interface Props {
  pid: number;
  fid: number;
  vid: number;
  filename: string;
}

async function readErrorDetail(response: Response, fallback: string) {
  let detail = fallback;
  try {
    const body = (await response.json()) as { detail?: string };
    if (body?.detail) detail = String(body.detail);
  } catch {
    // ignore malformed error payloads
  }
  return detail;
}

export default function SolidWorksPreview({ pid, fid, vid, filename }: Props) {
  const { isZh } = useI18n();
  const [externalLoading, setExternalLoading] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const text = isZh
    ? {
        jlcMissingUrl: '嘉立创未返回预览地址',
        localOpened: '已调用本机 eDrawings 打开当前版本',
        title: 'SolidWorks 文件预览',
        hint: '请选择本机 eDrawings 或嘉立创在线预览打开当前文件版本。',
        openLocal: '使用本机 eDrawings 打开',
        openJlc: '使用嘉立创在线预览',
      }
    : {
        jlcMissingUrl: 'JLC did not return a preview URL',
        localOpened: 'Opened the current version with local eDrawings',
        title: 'SolidWorks Preview',
        hint: 'Open the current file version with local eDrawings or JLC Online Preview.',
        openLocal: 'Open with Local eDrawings',
        openJlc: 'Open JLC Online Preview',
      };

  const openJlcPreview = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    setExternalLoading(true);
    try {
      const response = await fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/jlc-preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        throw new Error(await readErrorDetail(response, `HTTP ${response.status}`));
      }
      const body = (await response.json()) as { url?: string };
      if (!body.url) throw new Error(text.jlcMissingUrl);
      if (previewWindow) {
        previewWindow.location.href = body.url;
      } else {
        window.open(body.url, '_blank');
      }
    } catch (e) {
      previewWindow?.close();
      message.error((e as Error).message || String(e));
    } finally {
      setExternalLoading(false);
    }
  };

  const openLocalEDrawings = async () => {
    setLocalLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${pid}/files/${fid}/versions/${vid}/edrawings-open`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        },
      );
      if (!response.ok) {
        throw new Error(await readErrorDetail(response, `HTTP ${response.status}`));
      }
      message.success(text.localOpened);
    } catch (e) {
      message.error((e as Error).message || String(e));
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 16,
        minHeight: '60vh',
      }}
    >
      <Typography.Title level={5} style={{ margin: 0 }}>
        {text.title}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ maxWidth: 520, textAlign: 'center' }}>
        {filename}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ maxWidth: 520, textAlign: 'center' }}>
        {text.hint}
      </Typography.Text>
      <Space wrap>
        <Button
          className="apple-pill-button"
          type="primary"
          loading={localLoading}
          onClick={() => void openLocalEDrawings()}
        >
          {text.openLocal}
        </Button>
        <Button
          className="apple-pill-button apple-outline-button"
          loading={externalLoading}
          onClick={() => void openJlcPreview()}
        >
          {text.openJlc}
        </Button>
      </Space>
    </div>
  );
}
