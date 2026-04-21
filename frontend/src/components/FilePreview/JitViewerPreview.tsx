import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';
import { createViewer, type FileType, type ViewerInstance } from 'jit-viewer';
import 'jit-viewer/style.css';
import { useAuth } from '../../auth';
import { useI18n } from '../../i18n';
import type { PreviewProps } from './index';
import { getExt } from './utils';

const EXT_TO_JIT_TYPE: Record<string, FileType> = {
  pdf: 'pdf',
  docx: 'docx',
  xlsx: 'xlsx',
  xls: 'xls',
  csv: 'csv',
  pptx: 'pptx',
  ppt: 'ppt',
  ofd: 'ofd',
  txt: 'txt',
  md: 'md',
  markdown: 'markdown',
  html: 'html',
  htm: 'html',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  ico: 'image',
  tif: 'image',
  tiff: 'image',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  m4v: 'video',
  ogv: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  aac: 'audio',
  m4a: 'audio',
  dxf: 'cad',
  stl: 'model3d',
  obj: 'model3d',
  gltf: 'model3d',
  glb: 'model3d',
  ply: 'model3d',
};

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
};

export default function JitViewerPreview({ blob, filename }: PreviewProps) {
  const { user } = useAuth();
  const { language, isZh } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { file, fileType } = useMemo(() => {
    const ext = getExt(filename);
    const mime = EXT_TO_MIME[ext] || blob.type || 'application/octet-stream';
    const normalizedBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });
    const wrapped = new File([normalizedBlob], filename, { type: mime });
    return { file: wrapped, fileType: EXT_TO_JIT_TYPE[ext] };
  }, [blob, filename]);

  const text = isZh
    ? {
        loadingViewer: '加载预览器...',
        previewFailed: '预览失败',
      }
    : {
        loadingViewer: 'Loading viewer...',
        previewFailed: 'Preview failed',
      };

  useEffect(() => {
    let viewer: ViewerInstance | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      if (!containerRef.current) return;
      try {
        viewer = createViewer({
          target: containerRef.current,
          file,
          filename,
          type: fileType,
          theme: user?.ui_theme === 'dark' ? 'dark' : 'light',
          toolbar: true,
          locale: language === 'zh-CN' ? 'zh-CN' : 'en',
          width: '100%',
          height: '100%',
          onReady: () => {
            if (!cancelled) setLoading(false);
          },
          onLoad: () => {
            if (!cancelled) setLoading(false);
          },
          onError: (e: Error) => {
            if (!cancelled) {
              setError(e.message || String(e));
              setLoading(false);
            }
          },
        });
        await viewer.mount();
        if (cancelled) {
          viewer.destroy();
          viewer = null;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        viewer?.destroy();
      } catch {
        // ignore
      }
      viewer = null;
    };
  }, [file, fileType, filename, language, user?.ui_theme]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '75vh',
        background: 'var(--ln-preview-surface)',
      }}
    >
      {loading && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            pointerEvents: 'none',
            background: 'var(--ln-preview-overlay)',
          }}
        >
          <Spin tip={text.loadingViewer} size="large" />
        </div>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message={text.previewFailed}
          description={error}
          style={{ margin: 16 }}
        />
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
