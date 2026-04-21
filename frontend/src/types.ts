export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  created_at: string;
  my_role: Role;
}

export interface Member {
  user_id: number;
  username: string;
  email: string;
  role: Role;
}

export interface FileItem {
  id: number;
  name: string;
  current_version_no: number | null;
  current_version_id: number | null;
  created_at: string;
}

export interface FileVersion {
  id: number;
  version_no: number;
  blob_hash: string;
  size_bytes: number;
  commit_message: string;
  author_id: number;
  author_username: string;
  created_at: string;
  is_current: boolean;
}

export interface SearchProjectItem {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  created_at: string;
  my_role: Role;
}

export interface SearchFileItem {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  current_version_no: number | null;
  current_version_id: number | null;
  created_at: string;
}

export interface SearchResult {
  projects: SearchProjectItem[];
  files: SearchFileItem[];
}

export interface Comment {
  id: number;
  project_id: number;
  file_id: number;
  file_version_id: number | null;
  author_id: number;
  author_username: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  comment_id: number;
  project_id: number;
  file_id: number;
  file_version_id: number | null;
  type: string;
  is_read: boolean;
  comment_content: string;
  author_username: string;
  created_at: string;
}
