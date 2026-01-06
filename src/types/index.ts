export interface Config {
  apiUrl: string;
  token: string | null;
  userId: string | null;
  email: string | null;
  pagesDir: string;
}

export interface PageMeta {
  id: string;
  title: string;
  workspace_id: string;
  workspace_slug: string;
  slug: string;
  updated_at: string;
  local_hash: string;
  remote_hash: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  workspace_id: string;
  workspace_slug: string;
  updated_at: string;
  page_type: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface SyncStatus {
  path: string;
  status: "synced" | "modified" | "new" | "deleted" | "conflict";
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
}
