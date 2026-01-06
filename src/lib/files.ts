import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";
import matter from "gray-matter";
import { getConfig } from "./config.js";
import type { Page, PageMeta, SyncStatus } from "../types/index.js";

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getPagePath(workspaceSlug: string, pageSlug: string): string {
  const config = getConfig();
  return join(config.pagesDir, workspaceSlug, `${pageSlug}.md`);
}

export function savePage(page: Page): void {
  const pagePath = getPagePath(page.workspace_slug, page.slug);
  ensureDir(dirname(pagePath));

  const contentHash = hashContent(page.content);

  const frontmatter: PageMeta = {
    id: page.id,
    title: page.title,
    workspace_id: page.workspace_id,
    workspace_slug: page.workspace_slug,
    slug: page.slug,
    updated_at: page.updated_at,
    local_hash: contentHash,
    remote_hash: contentHash,
  };

  const fileContent = matter.stringify(page.content, frontmatter);
  writeFileSync(pagePath, fileContent, "utf-8");
}

export function readLocalPage(pagePath: string): { meta: PageMeta; content: string } | null {
  if (!existsSync(pagePath)) {
    return null;
  }

  const fileContent = readFileSync(pagePath, "utf-8");
  const { data, content } = matter(fileContent);

  return {
    meta: data as PageMeta,
    content: content.trim(),
  };
}

export function getAllLocalPages(): Array<{ path: string; meta: PageMeta; content: string }> {
  const config = getConfig();
  const pages: Array<{ path: string; meta: PageMeta; content: string }> = [];

  if (!existsSync(config.pagesDir)) {
    return pages;
  }

  const workspaces = readdirSync(config.pagesDir);

  for (const workspace of workspaces) {
    const workspacePath = join(config.pagesDir, workspace);
    if (!statSync(workspacePath).isDirectory()) continue;

    const files = readdirSync(workspacePath);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const pagePath = join(workspacePath, file);
      const page = readLocalPage(pagePath);
      if (page) {
        pages.push({ path: pagePath, ...page });
      }
    }
  }

  return pages;
}

export function getLocalChanges(): SyncStatus[] {
  const pages = getAllLocalPages();
  const statuses: SyncStatus[] = [];

  for (const page of pages) {
    const currentHash = hashContent(page.content);
    const isModified = currentHash !== page.meta.local_hash;

    statuses.push({
      path: page.path,
      status: isModified ? "modified" : "synced",
      localUpdatedAt: page.meta.updated_at,
    });
  }

  return statuses;
}

export function searchPages(query: string, workspaceSlug?: string): Array<{
  path: string;
  title: string;
  workspace: string;
  matches: string[];
}> {
  const pages = getAllLocalPages();
  const results: Array<{
    path: string;
    title: string;
    workspace: string;
    matches: string[];
  }> = [];

  const lowerQuery = query.toLowerCase();

  for (const page of pages) {
    if (workspaceSlug && page.meta.workspace_slug !== workspaceSlug) {
      continue;
    }

    const titleMatch = page.meta.title.toLowerCase().includes(lowerQuery);
    const contentMatches: string[] = [];

    const lines = page.content.split("\n");
    for (const line of lines) {
      if (line.toLowerCase().includes(lowerQuery)) {
        contentMatches.push(line.trim().slice(0, 100));
      }
    }

    if (titleMatch || contentMatches.length > 0) {
      results.push({
        path: page.path,
        title: page.meta.title,
        workspace: page.meta.workspace_slug,
        matches: contentMatches.slice(0, 3),
      });
    }
  }

  return results;
}
