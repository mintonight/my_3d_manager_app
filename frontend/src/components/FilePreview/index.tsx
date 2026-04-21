import { lazy, Suspense, useMemo, Component, type ReactNode } from 'react';
import { Alert, Spin } from 'antd';
import { useI18n } from '../../i18n';
import { getPreviewKind, type PreviewKind } from './utils';

export interface PreviewProps {
  blob: Blob;
  filename: string;
}

export interface SolidWorksPreviewProps {
  pid: number;
  fid: number;
  vid: number;
  filename: string;
}

const JitViewerPreview = lazy(() => import('./JitViewerPreview'));
const StepPreview = lazy(() => import('./StepPreview'));
const UnsupportedPreview = lazy(() => import('./UnsupportedPreview'));
const SolidWorksPreview = lazy(() => import('./SolidWorksPreview'));

const BLOB_MAP: Record<
  Exclude<PreviewKind, 'solidworks'>,
  React.LazyExoticComponent<React.ComponentType<PreviewProps>>
> = {
  jit: JitViewerPreview,
  step: StepPreview,
  unsupported: UnsupportedPreview,
};

class ErrorBoundary extends Component<
  { filename: string; errorTitle: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[FilePreview] error rendering', this.props.filename, error);
  }

  render() {
    if (this.state.error) {
      return (
        <Alert
          type="error"
          showIcon
          message={this.props.errorTitle}
          description={`${this.props.filename}: ${this.state.error.message}`}
          style={{ margin: 24 }}
        />
      );
    }
    return this.props.children;
  }
}

function PreviewFallback() {
  const { isZh } = useI18n();
  return (
    <div style={{ padding: 80, textAlign: 'center' }}>
      <Spin tip={isZh ? '加载预览模块...' : 'Loading preview module...'} size="large" />
    </div>
  );
}

export default function FilePreview({ blob, filename }: PreviewProps) {
  const { isZh } = useI18n();
  const kind = useMemo(() => getPreviewKind(filename), [filename]);
  const Comp = BLOB_MAP[kind as Exclude<PreviewKind, 'solidworks'>];
  return (
    <Suspense fallback={<PreviewFallback />}>
      <ErrorBoundary filename={filename} errorTitle={isZh ? '预览失败' : 'Preview Failed'}>
        <Comp blob={blob} filename={filename} />
      </ErrorBoundary>
    </Suspense>
  );
}

export function SolidWorksPreviewLauncher(props: SolidWorksPreviewProps) {
  const { isZh } = useI18n();
  return (
    <Suspense fallback={<PreviewFallback />}>
      <ErrorBoundary filename={props.filename} errorTitle={isZh ? '预览失败' : 'Preview Failed'}>
        <SolidWorksPreview {...props} />
      </ErrorBoundary>
    </Suspense>
  );
}
