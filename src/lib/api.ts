import { getConfig } from "./config.js";
import type {
  Page,
  Workspace,
  ApiResponse,
  DatabaseListItem,
  DatabaseWithDetails,
  DatabaseRow,
  BoardSummary,
  BoardList,
  BoardCard,
  BoardWithDetails,
  CreatedDatabase,
  DeletedResource,
} from "../types/index.js";

class ApiClient {
  private getHeaders(): HeadersInit {
    const config = getConfig();
    if (!config.token) {
      throw new Error("Not authenticated. Run 'lh login' first.");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    };
  }

  private getBaseUrl(): string {
    const config = getConfig();
    return `${config.apiUrl}/api/cli`;
  }

  async validateToken(): Promise<{ valid: boolean; email?: string; userId?: string }> {
    const response = await fetch(`${this.getBaseUrl()}/auth/validate`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    return { valid: true, email: data.email, userId: data.userId };
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const response = await fetch(`${this.getBaseUrl()}/workspaces`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
    }

    const data: ApiResponse<Workspace[]> = await response.json();
    return data.data;
  }

  async getPages(workspaceSlug?: string): Promise<Page[]> {
    const url = new URL(`${this.getBaseUrl()}/pages`);
    if (workspaceSlug) {
      url.searchParams.set("workspace", workspaceSlug);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.statusText}`);
    }

    const data: ApiResponse<Page[]> = await response.json();
    return data.data;
  }

  async getPage(pageId: string): Promise<Page> {
    const response = await fetch(`${this.getBaseUrl()}/pages/${pageId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const data: ApiResponse<Page> = await response.json();
    return data.data;
  }

  async updatePage(
    pageId: string,
    content: string,
    title?: string
  ): Promise<Page> {
    const response = await fetch(`${this.getBaseUrl()}/pages/${pageId}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify({ content, title }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update page: ${response.statusText}`);
    }

    const data: ApiResponse<Page> = await response.json();
    return data.data;
  }

  async getPageHashes(): Promise<Record<string, string>> {
    const response = await fetch(`${this.getBaseUrl()}/pages/hashes`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page hashes: ${response.statusText}`);
    }

    const data: ApiResponse<Record<string, string>> = await response.json();
    return data.data;
  }

  async createPage(
    title: string,
    content: string,
    workspaceSlug: string,
    parentId?: string
  ): Promise<Page> {
    const body: Record<string, string> = { title, content, workspace_slug: workspaceSlug };
    if (parentId) {
      body.parent_id = parentId;
    }

    const response = await fetch(`${this.getBaseUrl()}/pages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to create page: ${response.statusText}`);
    }

    const data: ApiResponse<Page> = await response.json();
    return data.data;
  }

  async createWorkspace(name: string): Promise<Workspace & { existing?: boolean }> {
    const response = await fetch(`${this.getBaseUrl()}/workspaces`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to create workspace: ${response.statusText}`);
    }

    const data = await response.json();
    return { ...data.data, existing: data.existing };
  }

  // Database API methods

  async getDatabases(workspaceSlug?: string): Promise<DatabaseListItem[]> {
    const url = new URL(`${this.getBaseUrl()}/databases`);
    if (workspaceSlug) {
      url.searchParams.set("workspace", workspaceSlug);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch databases: ${response.statusText}`);
    }

    const data: ApiResponse<DatabaseListItem[]> = await response.json();
    return data.data;
  }

  async getDatabase(databaseId: string): Promise<DatabaseWithDetails> {
    const response = await fetch(`${this.getBaseUrl()}/databases/${databaseId}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.statusText}`);
    }

    const data: ApiResponse<DatabaseWithDetails> = await response.json();
    return data.data;
  }

  async batchUpdateRows(
    databaseId: string,
    operations: {
      create: Array<{
        title: string;
        data_source_id: string | null;
        properties: Record<string, unknown>;
      }>;
      update: Array<{
        id: string;
        title: string;
        data_source_id: string | null;
        properties: Record<string, unknown>;
      }>;
      delete: string[];
    }
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
  }> {
    const response = await fetch(`${this.getBaseUrl()}/databases/${databaseId}/rows/batch`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(operations),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to batch update rows: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  // ===== Direct CRUD: pages =====

  async deletePage(pageId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/pages/${pageId}`, { method: "DELETE" });
  }

  // ===== Direct CRUD: databases =====

  async createDatabase(
    title: string,
    workspaceSlug: string,
    parentId?: string
  ): Promise<CreatedDatabase> {
    return this.request<CreatedDatabase>(`/databases`, {
      method: "POST",
      body: JSON.stringify({
        title,
        workspace_slug: workspaceSlug,
        ...(parentId ? { parent_id: parentId } : {}),
      }),
    });
  }

  async deleteDatabase(databaseId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/databases/${databaseId}`, { method: "DELETE" });
  }

  // ===== Direct CRUD: properties =====

  async createProperty(
    databaseId: string,
    payload: {
      name: string;
      type: string;
      data_source_id?: string;
      options?: Array<string | { name: string; color?: string }>;
    }
  ): Promise<{
    property_id: string;
    property_name: string;
    property_type: string;
    data_source_id: string;
  }> {
    return this.request(`/databases/${databaseId}/properties`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateProperty(
    databaseId: string,
    propertyId: string,
    payload: {
      name?: string;
      type?: string;
      options?: Array<string | { id?: string; name: string; color?: string }>;
    }
  ): Promise<unknown> {
    return this.request(`/databases/${databaseId}/properties/${propertyId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteProperty(
    databaseId: string,
    propertyId: string
  ): Promise<DeletedResource & { property_id: string }> {
    return this.request(`/databases/${databaseId}/properties/${propertyId}`, {
      method: "DELETE",
    });
  }

  // ===== Direct CRUD: rows =====

  async createRow(
    databaseId: string,
    payload: { title: string; data_source_id?: string | null; properties?: Record<string, unknown> }
  ): Promise<{ id: string; title: string }> {
    return this.request(`/databases/${databaseId}/rows`, {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        data_source_id: payload.data_source_id ?? null,
        properties: payload.properties ?? {},
      }),
    });
  }

  async getRow(databaseId: string, rowId: string): Promise<DatabaseRow> {
    return this.request<DatabaseRow>(`/databases/${databaseId}/rows/${rowId}`);
  }

  async updateRow(
    databaseId: string,
    rowId: string,
    payload: { title?: string; data_source_id?: string | null; properties?: Record<string, unknown> }
  ): Promise<DatabaseRow> {
    return this.request<DatabaseRow>(`/databases/${databaseId}/rows/${rowId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteRow(databaseId: string, rowId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/databases/${databaseId}/rows/${rowId}`, {
      method: "DELETE",
    });
  }

  // ===== Direct CRUD: boards =====

  async getBoards(workspaceSlug?: string): Promise<BoardSummary[]> {
    const qs = workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : "";
    return this.request<BoardSummary[]>(`/boards${qs}`);
  }

  async createBoard(
    title: string,
    workspaceSlug: string,
    options: { parentId?: string; isPrivate?: boolean } = {}
  ): Promise<BoardSummary> {
    return this.request<BoardSummary>(`/boards`, {
      method: "POST",
      body: JSON.stringify({
        title,
        workspace_slug: workspaceSlug,
        ...(options.parentId ? { parent_id: options.parentId } : {}),
        ...(options.isPrivate ? { is_private: true } : {}),
      }),
    });
  }

  async getBoard(boardId: string): Promise<BoardWithDetails> {
    return this.request<BoardWithDetails>(`/boards/${boardId}`);
  }

  async deleteBoard(boardId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/boards/${boardId}`, { method: "DELETE" });
  }

  // ===== Direct CRUD: lists =====

  async getLists(boardId: string): Promise<BoardList[]> {
    return this.request<BoardList[]>(`/boards/${boardId}/lists`);
  }

  async createList(
    boardId: string,
    payload: { name: string; position?: number }
  ): Promise<BoardList> {
    return this.request<BoardList>(`/boards/${boardId}/lists`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateList(
    boardId: string,
    listId: string,
    payload: { name?: string; position?: number; is_completed_list?: boolean }
  ): Promise<BoardList> {
    return this.request<BoardList>(`/boards/${boardId}/lists/${listId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteList(boardId: string, listId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/boards/${boardId}/lists/${listId}`, {
      method: "DELETE",
    });
  }

  // ===== Direct CRUD: cards =====

  async getCards(boardId: string, listId?: string): Promise<BoardCard[]> {
    const qs = listId ? `?list_id=${encodeURIComponent(listId)}` : "";
    return this.request<BoardCard[]>(`/boards/${boardId}/cards${qs}`);
  }

  async createCard(
    boardId: string,
    payload: { list_id: string; title: string; description?: string; position?: number }
  ): Promise<BoardCard> {
    return this.request<BoardCard>(`/boards/${boardId}/cards`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getCard(boardId: string, cardId: string): Promise<BoardCard> {
    return this.request<BoardCard>(`/boards/${boardId}/cards/${cardId}`);
  }

  async updateCard(
    boardId: string,
    cardId: string,
    payload: Partial<{
      title: string;
      description: string;
      list_id: string;
      position: number;
      labels: string[];
      due_date: string | null;
      completed: boolean;
      assigned_to: string | null;
    }>
  ): Promise<BoardCard> {
    return this.request<BoardCard>(`/boards/${boardId}/cards/${cardId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async deleteCard(boardId: string, cardId: string): Promise<DeletedResource> {
    return this.request<DeletedResource>(`/boards/${boardId}/cards/${cardId}`, {
      method: "DELETE",
    });
  }

  // ===== Internal helpers =====

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      ...init,
      headers: { ...this.getHeaders(), ...(init.headers || {}) },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `${init.method ?? "GET"} ${path} failed: ${response.statusText}`);
    }

    const json = (await response.json()) as ApiResponse<T>;
    return json.data;
  }
}

export const api = new ApiClient();
