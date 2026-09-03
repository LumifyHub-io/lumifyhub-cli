/**
 * Direct page CRUD commands (no filesystem sync).
 * Registered as: lh page <list|get|create|update|delete>
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import { isAuthenticated } from "../lib/config.js";
import { api, ROOT_PARENT } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";

interface PageListOpts {
  workspace?: string;
  /** Page id, slug path, or "root" for top-level pages. */
  parent?: string;
  json?: boolean;
}

async function pageList(opts: PageListOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const parentId =
      opts.parent === undefined ? undefined : await api.resolvePageId(opts.parent, opts.workspace);
    const pages = await api.getPages(opts.workspace, parentId);
    printResult(
      pages,
      (rows) => {
        if (rows.length === 0) {
          console.log(chalk.gray("No pages found."));
          return;
        }
        for (const p of rows) {
          // The path, not the title: three pages called "Development" are
          // only told apart by which parent they sit under.
          console.log(`${chalk.cyan(p.id)}  ${p.workspace_slug}/${p.path}  ${chalk.gray(p.title)}`);
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list pages", opts);
  }
}

interface PageGetOpts {
  workspace?: string;
  json?: boolean;
}

async function pageGet(ref: string, opts: PageGetOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const page = await api.getPage(ref, opts.workspace);
    printResult(
      page,
      (p) => {
        console.log(chalk.bold(p.title));
        console.log(chalk.gray(`${p.id}  workspace=${p.workspace_slug}  updated=${p.updated_at}`));
        console.log(chalk.gray(`path=${p.path}  parent=${p.parent_page_id ?? ROOT_PARENT}`));
        console.log();
        console.log(p.content);
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get page", opts);
  }
}

interface PageCreateOpts {
  workspace: string;
  content?: string;
  fromFile?: string;
  /** Page id or slug path. */
  parent?: string;
  /** Older spelling of --parent; kept so existing scripts keep working. */
  parentId?: string;
  json?: boolean;
}

async function pageCreate(title: string, opts: PageCreateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  if (!opts.workspace) {
    printError("--workspace required", opts);
    return;
  }
  let content = opts.content ?? "";
  if (opts.fromFile) {
    try {
      content = readFileSync(opts.fromFile, "utf-8");
    } catch (err) {
      printError(`Failed to read ${opts.fromFile}: ${err instanceof Error ? err.message : err}`, opts);
      return;
    }
  }
  try {
    const parentRef = opts.parent ?? opts.parentId;
    const parentId =
      parentRef === undefined ? undefined : await api.resolvePageId(parentRef, opts.workspace);
    const page = await api.createPage(title, content, opts.workspace, parentId);
    printResult(
      page,
      (p) => console.log(chalk.green(`Created page ${p.id}: ${p.workspace_slug}/${p.path}`)),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create page", opts);
  }
}

interface PageUpdateOpts {
  title?: string;
  content?: string;
  fromFile?: string;
  json?: boolean;
}

async function pageUpdate(id: string, opts: PageUpdateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  let content = opts.content;
  if (opts.fromFile) {
    try {
      content = readFileSync(opts.fromFile, "utf-8");
    } catch (err) {
      printError(`Failed to read ${opts.fromFile}: ${err instanceof Error ? err.message : err}`, opts);
      return;
    }
  }
  if (content === undefined && opts.title === undefined) {
    printError("Provide --content, --from-file, or --title", opts);
    return;
  }
  try {
    // updatePage requires a content string; fall back to current remote content if only title changes
    let newContent = content;
    if (newContent === undefined) {
      const current = await api.getPage(id);
      newContent = current.content;
    }
    const page = await api.updatePage(id, newContent, opts.title);
    printResult(
      page,
      (p) => console.log(chalk.green(`Updated page ${p.id}: ${p.title}`)),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update page", opts);
  }
}

async function pageDelete(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deletePage(id);
    printResult(
      result,
      () => console.log(chalk.green(`Deleted page ${id}`)),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete page", opts);
  }
}

export function registerPageCommands(program: Command): void {
  const page = program.command("page").description("Manage pages directly (no filesystem sync)");

  page
    .command("list")
    .alias("ls")
    .description("List pages with their slug paths")
    .option("-w, --workspace <slug>", "Filter by workspace")
    .option(
      "--parent <id|path|root>",
      "Only children of this page (id or slug path), or 'root' for top-level pages"
    )
    .option("--json", "Output JSON")
    .action(pageList);

  page
    .command("get <id|path>")
    .description("Show a page by ID or slug path (e.g. cornerlot/development)")
    .option("-w, --workspace <slug>", "Workspace to resolve a path in (when it exists in several)")
    .option("--json", "Output JSON")
    .action(pageGet);

  page
    .command("create <title>")
    .description("Create a new page")
    .option("-w, --workspace <slug>", "Workspace slug (required)")
    .option("-c, --content <text>", "Page content (markdown)")
    .option("--from-file <path>", "Read content from a file")
    .option("--parent <id|path>", "Parent page (id or slug path, e.g. cornerlot)")
    .option("--parent-id <id>", "Alias of --parent (kept for older scripts)")
    .option("--json", "Output JSON")
    .action(pageCreate);

  page
    .command("update <id>")
    .description("Update a page's title or content")
    .option("-t, --title <title>", "New title")
    .option("-c, --content <text>", "New content (markdown)")
    .option("--from-file <path>", "Read content from a file")
    .option("--json", "Output JSON")
    .action(pageUpdate);

  page
    .command("delete <id>")
    .alias("rm")
    .description("Soft-delete a page")
    .option("--json", "Output JSON")
    .action(pageDelete);
}
