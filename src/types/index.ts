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

// Database sync types
export interface DatabaseSchema {
  id: string;
  title: string;
  workspace_id: string;
  workspace_slug: string;
  slug: string;
  updated_at: string;
  local_hash: string;
  remote_hash: string;
  data_sources: DataSourceMeta[];
  properties: PropertyMeta[];
}

export interface DataSourceMeta {
  id: string;
  name: string;
  sort_order: number;
}

export interface PropertyMeta {
  property_id: string;
  property_name: string;
  property_type: string;
  data_source_id: string | null;
  sort_order: number;
  config: Record<string, unknown>;
}

export interface DatabaseRow {
  _id: string;
  _title: string;
  _data_source_id: string | null;
  [property_id: string]: string | null;
}

export interface DatabaseListItem {
  id: string;
  title: string;
  slug: string;
  workspace_id: string;
  workspace_slug: string;
  updated_at: string;
}

export interface DatabaseWithDetails extends DatabaseListItem {
  data_sources: DataSourceMeta[];
  properties: PropertyMeta[];
  rows: DatabaseRow[];
}

export interface DatabaseSyncStatus {
  path: string;
  databaseSlug: string;
  workspaceSlug: string;
  status: "synced" | "modified" | "conflict";
  localHash?: string;
  remoteHash?: string;
}
