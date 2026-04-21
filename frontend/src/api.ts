import axios from 'axios';
import { readStoredUiLanguage } from './preferences';

const TOKEN_KEY = 'zgg_token';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function extractError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as { detail?: unknown } | undefined;
    if (typeof d?.detail === 'string') return localizeBackendError(d.detail);
    if (Array.isArray(d?.detail)) {
      return (d.detail as Array<{ msg?: string }>)
        .map((x) => localizeBackendError(x.msg ?? String(x)))
        .join('; ');
    }
    return e.message;
  }
  return String(e);
}

function localizeBackendError(message: string): string {
  if (readStoredUiLanguage() !== 'zh-CN') return message;

  const exact: Record<string, string> = {
    'missing token': '缺少登录令牌',
    'invalid token': '登录令牌无效',
    'user not found': '用户不存在',
    'username already taken': '用户名已被占用',
    'email already registered': '邮箱已被注册',
    'invalid username or password': '用户名或密码错误',
    'project not found': '项目不存在',
    'file not found': '文件不存在',
    'version not found': '版本不存在',
    'member not found': '成员不存在',
    'notification not found': '通知不存在',
    'comment not found': '评论不存在',
    'comment author not found': '评论作者不存在',
    'not a project member': '您不是该项目成员',
    'requires viewer role': '需要查看者权限',
    'requires editor role': '需要编辑者权限',
    'requires owner role': '需要所有者权限',
    'admin only': '仅管理员可操作',
    'user is already a member': '该用户已经是项目成员',
    'cannot add another owner': '不能再添加新的所有者',
    'cannot change owner role': '不能修改所有者角色',
    'cannot promote to owner': '不能提升为所有者',
    'cannot remove owner': '不能移除所有者',
    'cannot delete this comment': '不能删除这条评论',
    'cannot update this notification': '不能更新这条通知',
    'blob missing from storage': '文件存储缺失',
    'no embedded thumbnail found': '文件内未找到嵌入缩略图',
    'eDrawings launch is only available on Windows': 'eDrawings 仅支持在 Windows 环境下调用',
  };

  if (exact[message]) return exact[message];
  if (message.startsWith('eDrawings executable not found: ')) {
    return `未找到 eDrawings 可执行文件: ${message.slice('eDrawings executable not found: '.length)}`;
  }
  if (message.startsWith('failed to launch eDrawings: ')) {
    return `启动 eDrawings 失败: ${message.slice('failed to launch eDrawings: '.length)}`;
  }
  if (message.startsWith('restore failed: ')) {
    return `恢复数据失败: ${message.slice('restore failed: '.length)}`;
  }
  const missingUser = message.match(/^user '(.+)' not found$/);
  if (missingUser) {
    return `用户 ${missingUser[1]} 不存在`;
  }
  const existingFile = message.match(
    /^file '(.+)' already exists; use commit endpoint to add a new version$/,
  );
  if (existingFile) {
    return `文件 ${existingFile[1]} 已存在，请使用提交新版本功能`;
  }
  if (message.startsWith('backup missing blobs: ')) {
    return `备份缺少 blob 文件: ${message.slice('backup missing blobs: '.length)}`;
  }
  return message;
}
