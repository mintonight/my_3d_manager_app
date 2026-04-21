import { lazy, Suspense, useMemo, Component, type ReactNode } from 'react';
import { Alert, Spin } from 'antd';
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
  { filename: string; children: ReactNode },
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
          message="预览失败"
          description={`${this.props.filename}: ${this.state.error.message}`}
          style={{ margin: 24 }}
        />
      );
    }
    return this.props.children;
  }
}

const FALLBACK = (
  <div style={{ padding: 80, textAlign: 'center' }}>
    <Spin tip="加载预览模块..." size="large" />
  </div>
);

export default function FilePreview({ blob, filename }: PreviewProps) {
  const kind = useMemo(() => getPreviewKind(filename), [filename]);
  const Comp = BLOB_MAP[kind as Exclude<PreviewKind, 'solidworks'>];
  return (
    <Suspense fallback={FALLBACK}>
      <ErrorBoundary filename={filename}>
        <Comp blob={blob} filename={filename} />
      </ErrorBoundary>
    </Suspense>
  );
}

export function SolidWorksPreviewLauncher(props: SolidWorksPreviewProps) {
  return (
    <Suspense fallback={FALLBACK}>
      <ErrorBoundary filename={props.filename}>
        <SolidWorksPreview {...props} />
      </ErrorBoundary>
    </Suspense>
  );
}
