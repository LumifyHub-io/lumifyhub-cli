import chalk from "chalk";
import ora from "ora";
import { readFileSync, existsSync } from "fs";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { savePage } from "../lib/files.js";
import { initGitIfNeeded, commitChanges } from "../lib/git.js";
import { getCliConfig, setCliConfig } from "../lib/cli-config.js";

interface NewOptions {
  workspace?: string;
  content?: string;
  fromFile?: string;
  fromClipboard?: boolean;
}

const CLI_PAGES_TITLE = "CLI Pages";
const CLI_NOTES_WORKSPACE = "CLI Notes";

/**
 * Get or create the destination for CLI pages.
 * - Single workspace: create "CLI Pages" parent page, nest under it
 * - Multiple workspaces: create "CLI Notes" workspace
 */
async function getCliDestination(): Promise<{
  workspaceSlug: string;
  parentId?: string;
}> {
  const cliConfig = getCliConfig();

  // Check if we have a cached destination
  if (cliConfig.destinationWorkspace) {
    return {
      workspaceSlug: cliConfig.destinationWorkspace,
      parentId: cliConfig.destinationParentId,
    };
  }

  const workspaces = await api.getWorkspaces();

  if (workspaces.length === 0) {
    // No workspaces - create CLI Notes workspace
    const ws = await api.createWorkspace(CLI_NOTES_WORKSPACE);
    setCliConfig({
      destinationWorkspace: ws.slug,
      destinationType: "workspace",
    });
    return { workspaceSlug: ws.slug };
  }

  if (workspaces.length === 1) {
    // Single workspace - create CLI Pages parent
    const ws = workspaces[0];

    // Check if CLI Pages parent already exists
    const pages = await api.getPages(ws.slug);
    const cliPagesParent = pages.find((p) => p.title === CLI_PAGES_TITLE);

    if (cliPagesParent) {
      setCliConfig({
        destinationWorkspace: ws.slug,
        destinationParentId: cliPagesParent.id,
        destinationType: "parent",
      });
      return { workspaceSlug: ws.slug, parentId: cliPagesParent.id };
    }

    // Create CLI Pages parent
    const parent = await api.createPage(CLI_PAGES_TITLE, "", ws.slug);
    savePage({ ...parent, workspace_slug: ws.slug });

    setCliConfig({
      destinationWorkspace: ws.slug,
      destinationParentId: parent.id,
      destinationType: "parent",
    });

    return { workspaceSlug: ws.slug, parentId: parent.id };
  }

  // Multiple workspaces - create/find CLI Notes workspace
  const existingCliNotes = workspaces.find(
    (ws) => ws.name === CLI_NOTES_WORKSPACE || ws.slug === "cli-notes"
  );

  if (existingCliNotes) {
    setCliConfig({
      destinationWorkspace: existingCliNotes.slug,
      destinationType: "workspace",
    });
    return { workspaceSlug: existingCliNotes.slug };
  }

  // Create CLI Notes workspace
  const ws = await api.createWorkspace(CLI_NOTES_WORKSPACE);
  setCliConfig({
    destinationWorkspace: ws.slug,
    destinationType: "workspace",
  });

  return { workspaceSlug: ws.slug };
}

export async function newCommand(
  title: string,
  options: NewOptions
): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  // Determine content
  let content = "";

  if (options.content) {
    content = options.content;
  } else if (options.fromFile) {
    if (!existsSync(options.fromFile)) {
      console.log(chalk.red(`File not found: ${options.fromFile}`));
      return;
    }
    content = readFileSync(options.fromFile, "utf-8");
  } else if (options.fromClipboard) {
    try {
      const { execSync } = await import("child_process");
      content = execSync("pbpaste", { encoding: "utf-8" });
    } catch {
      console.log(chalk.red("Failed to read from clipboard"));
      return;
    }
  }

  const spinner = ora("Creating page...").start();

  try {
    let workspaceSlug: string;
    let parentId: string | undefined;

    if (options.workspace) {
      // Explicit workspace specified
      workspaceSlug = options.workspace;
    } else {
      // Smart destination
      const dest = await getCliDestination();
      workspaceSlug = dest.workspaceSlug;
      parentId = dest.parentId;
    }

    const page = await api.createPage(title, content, workspaceSlug, parentId);
    savePage({ ...page, workspace_slug: workspaceSlug });

    spinner.succeed(`Created: ${chalk.cyan(title)}`);
    console.log(chalk.gray(`  Workspace: ${workspaceSlug}`));
    console.log(chalk.gray(`  Path: ${workspaceSlug}/${page.slug}.md`));

    // Auto-commit if git available
    initGitIfNeeded();
    if (commitChanges(`New page: ${title}`)) {
      console.log(chalk.gray("  Committed to local git"));
    }
  } catch (error) {
    spinner.fail("Failed to create page");
    console.error(
      chalk.red(error instanceof Error ? error.message : "Unknown error")
    );
  }
}
