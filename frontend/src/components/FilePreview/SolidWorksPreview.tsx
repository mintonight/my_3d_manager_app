import { useEffect, useState } from 'react';
import { Alert, Button, Spin, Typography, message } from 'antd';
import { getToken } from '../../api';

interface Props {
  pid: number;
  fid: number;
  vid: number;
  filename: string;
}

export default function SolidWorksPreview({ pid, fid, vid, filename }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [externalLoading, setExternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setUrl(null);

    fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/thumbnail`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          let detail = '文件内未找到嵌入的预览缩略图';
          try {
            const body = await response.json();
            if (body?.detail) detail = String(body.detail);
          } catch {
            // ignore
          }
          throw new Error(detail);
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message || String(e));
      })
      .finally(() => setLoading(false));

    return () => {
      controller.abort();
    };
  }, [pid, fid, vid]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const openJlcPreview = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    setExternalLoading(true);
    try {
      const response = await fetch(`/api/projects/${pid}/files/${fid}/versions/${vid}/jlc-preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body?.detail) detail = String(body.detail);
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      const body = (await response.json()) as { url?: string };
      if (!body.url) throw new Error('嘉立创未返回预览地址');
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

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin tip="正在提取嵌入缩略图..." size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          showIcon
          message={`无法从 ${filename} 中提取缩略图`}
          description={
            <div>
              <Typography.Paragraph style={{ marginTop: 8, marginBottom: 4 }}>
                {error}
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                SolidWorks 文件通常会在保存时写入 PNG 预览；若保存时关闭了"保存缩略图"选项，或文件为极简模式，则无法提取。可下载文件后用 SolidWorks 打开，或另存为 STEP/STL 用于在线预览。
              </Typography.Paragraph>
              <Button
                className="apple-pill-button"
                type="primary"
                loading={externalLoading}
                onClick={() => void openJlcPreview()}
              >
                使用嘉立创在线预览
              </Button>
            </div>
          }
        />
      </div>
    );
  }

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
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        此预览来自 SolidWorks 文件内嵌的缩略图
      </Typography.Text>
      <Button
        className="apple-pill-button apple-outline-button"
        loading={externalLoading}
        onClick={() => void openJlcPreview()}
      >
        使用嘉立创在线预览
      </Button>
      {url && (
        <img
          src={url}
          alt={filename}
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            background: '#fff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 8,
          }}
        />
      )}
    </div>
  );
}
