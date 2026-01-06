import { getConfig } from "./config.js";
import type { Page, Workspace, ApiResponse } from "../types/index.js";

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
}

export const api = new ApiClient();
