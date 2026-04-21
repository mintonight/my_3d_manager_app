export type PreviewKind = 'jit' | 'step' | 'solidworks' | 'unsupported';

// SolidWorks / OLE-based CAD files use external viewer launch actions.
const SOLIDWORKS_EXTENSIONS = new Set(['sldprt', 'sldasm', 'slddrw']);

// Everything jit-viewer handles natively — office docs, 2D CAD (DXF), common 3D
// meshes (STL/OBJ/GLTF/GLB), images, video, audio, code, markdown, csv, html.
const JIT_EXTENSIONS = new Set([
  // office
  'pdf',
  'docx',
  'xlsx', 'xls',
  'pptx', 'ppt',
  'ofd',
  'csv',
  // text / markup / code
  'txt', 'md', 'markdown',
  'html', 'htm',
  'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'toml',
  'js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'rb', 'php', 'sh', 'sql', 'css', 'scss', 'less', 'swift', 'kt',
  'dockerfile',
  // images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico',
  // video / audio
  'mp4', 'webm', 'mov', 'm4v', 'mkv',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
  // 3D mesh
  'stl', 'obj', 'gltf', 'glb',
  // 2D CAD
  'dxf',
]);

export function getExt(filename: string): string {
  const name = filename.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

export function getPreviewKind(filename: string): PreviewKind {
  const ext = getExt(filename);
  if (ext === 'step' || ext === 'stp') return 'step';
  if (SOLIDWORKS_EXTENSIONS.has(ext)) return 'solidworks';
  if (JIT_EXTENSIONS.has(ext)) return 'jit';
  return 'unsupported';
}

export function isPreviewable(filename: string): boolean {
  return getPreviewKind(filename) !== 'unsupported';
}

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
