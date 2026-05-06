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

// Direct CRUD types

export interface BoardSummary {
  id: string;
  page_id: string;
  workspace_id: string;
  workspace_slug?: string;
  title: string;
  slug: string;
  updated_at?: string;
}

export interface BoardList {
  id: string;
  board_id: string;
  user_id: string | null;
  name: string;
  position: number;
  is_completed_list?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BoardCard {
  id: string;
  board_id?: string;
  list_id: string;
  list_name?: string | null;
  title: string;
  description?: unknown;
  labels?: string[];
  due_date?: string | null;
  completed?: boolean;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface BoardWithDetails extends BoardSummary {
  lists: BoardList[];
  cards: BoardCard[];
}

export interface CreatedDatabase {
  id: string;
  title: string;
  slug: string;
  workspace_id: string;
  workspace_slug: string;
  default_data_source_id: string;
}

export interface DeletedResource {
  id: string;
  deleted: true;
}

export interface DatabaseView {
  id: string;
  container_id: string;
  view_name: string;
  view_type: "table" | "board" | "form";
  data_source_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  id: string;
  container_id: string;
  name: string;
  is_linked: boolean;
  source_database_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RelationValue {
  id: string;
  row_id: string;
  property_id: string;
  related_row_id: string;
  created_at: string;
}

export interface ViewFilter {
  id: string;
  propertyId: string;
  operator:
    | "equals" | "not_equals" | "contains" | "not_contains"
    | "starts_with" | "ends_with" | "is_empty" | "is_not_empty"
    | "greater_than" | "less_than" | "greater_than_or_equal" | "less_than_or_equal"
    | "is_checked" | "is_not_checked" | "before" | "after" | "on_or_before" | "on_or_after";
  value?: unknown;
  logic?: "and" | "or";
}

export interface ViewSort {
  propertyId: string;
  direction: "asc" | "desc";
}

export interface ViewBoardSettings {
  groupByPropertyId?: string | null;
  cardDisplayProperties?: string[];
  columnOrder?: string[];
  hideEmptyColumns?: boolean;
  cardSize?: "small" | "medium" | "large";
}

export interface ViewSettings {
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  boardSettings?: ViewBoardSettings;
}
