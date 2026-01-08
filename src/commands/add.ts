import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { savePage } from "../lib/files.js";
import { initGitIfNeeded, commitChanges } from "../lib/git.js";
import { getCliConfig, setCliConfig, clearCliConfig } from "../lib/cli-config.js";

const CLI_PAGES_TITLE = "CLI Pages";
const CLI_NOTES_WORKSPACE = "CLI Notes";
const QUICK_NOTES_TITLE = "Quick Notes";

/**
 * Get or create the destination for CLI pages.
 */
async function getCliDestination(skipCache = false): Promise<{
  workspaceSlug: string;
  parentId?: string;
}> {
  const cliConfig = getCliConfig();

  if (!skipCache && cliConfig.destinationWorkspace) {
    return {
      workspaceSlug: cliConfig.destinationWorkspace,
      parentId: cliConfig.destinationParentId,
    };
  }

  const workspaces = await api.getWorkspaces();

  if (workspaces.length === 0) {
    const ws = await api.createWorkspace(CLI_NOTES_WORKSPACE);
    setCliConfig({
      destinationWorkspace: ws.slug,
      destinationType: "workspace",
    });
    return { workspaceSlug: ws.slug };
  }

  if (workspaces.length === 1) {
    const ws = workspaces[0];
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

    const parent = await api.createPage(CLI_PAGES_TITLE, "", ws.slug);
    savePage({ ...parent, workspace_slug: ws.slug });

    setCliConfig({
      destinationWorkspace: ws.slug,
      destinationParentId: parent.id,
      destinationType: "parent",
    });

    return { workspaceSlug: ws.slug, parentId: parent.id };
  }

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

  const ws = await api.createWorkspace(CLI_NOTES_WORKSPACE);
  setCliConfig({
    destinationWorkspace: ws.slug,
    destinationType: "workspace",
  });

  return { workspaceSlug: ws.slug };
}

/**
 * Quick add - creates a timestamped note or appends to Quick Notes page
 */
export async function addCommand(text: string): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Adding note...").start();

  try {
    let dest = await getCliDestination();

    // Generate a title from the first few words
    const words = text.split(/\s+/).slice(0, 5).join(" ");
    const title = words.length > 30 ? words.slice(0, 30) + "..." : words;

    let page;
    try {
      page = await api.createPage(title, text, dest.workspaceSlug, dest.parentId);
    } catch (error) {
      // If workspace not found, clear cache and retry
      if (error instanceof Error && error.message.includes("Workspace not found")) {
        clearCliConfig();
        dest = await getCliDestination(true);
        page = await api.createPage(title, text, dest.workspaceSlug, dest.parentId);
      } else {
        throw error;
      }
    }

    savePage({ ...page, workspace_slug: dest.workspaceSlug });

    spinner.succeed(chalk.green("Added!"));
    console.log(chalk.gray(`  ${dest.workspaceSlug}/${page.slug}.md`));

    // Auto-commit if git available
    initGitIfNeeded();
    commitChanges(`Quick note: ${title}`);
  } catch (error) {
    spinner.fail("Failed to add note");
    console.error(
      chalk.red(error instanceof Error ? error.message : "Unknown error")
    );
  }
}
