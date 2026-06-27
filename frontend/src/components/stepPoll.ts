import { api } from '../api';
import { getPreviewKind } from './FilePreview/utils';
import type { FileVersion } from '../types';

interface PollOptions {
  pid: number;
  fid: number;
  vid: number;
  filename: string;
  intervalMs?: number;
  maxAttempts?: number;
  onDone: (filename: string) => void;
}

/**
 * Poll a SolidWorks file version until its STEP derivative is ready
 * (step_blob_hash becomes non-null), then fire onDone.
 * Stops automatically on success, timeout, or auth failure.
 *
 * The SolidWorks -> STEP conversion runs as a background task on the server;
 * this lets the UI notify the user the moment the derivative is available.
 */
export function pollStepDerivative({
  pid,
  fid,
  vid,
  filename,
  intervalMs = 3000,
  maxAttempts = 60,
  onDone,
}: PollOptions): void {
  // Only SolidWorks files have a STEP conversion pending.
  if (getPreviewKind(filename) !== 'solidworks') return;

  let attempt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const check = async () => {
    attempt += 1;
    if (attempt > maxAttempts) {
      stop();
      return;
    }
    try {
      const res = await api.get<FileVersion[]>(`/projects/${pid}/files/${fid}/versions`);
      const v = res.data.find((item) => item.id === vid);
      if (v && v.step_blob_hash) {
        stop();
        onDone(filename);
      }
    } catch {
      // Network/auth error — keep trying until timeout; don't spam console.
    }
  };

  timer = setInterval(() => {
    void check();
  }, intervalMs);
}
