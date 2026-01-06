import chalk from "chalk";
import ora from "ora";
import { basename, dirname } from "path";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { getAllLocalPages, hashContent, savePage } from "../lib/files.js";
import { initGitIfNeeded, commitChanges } from "../lib/git.js";

interface PushOptions {
  workspace?: string;
  force?: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Checking for local changes...").start();

  try {
    const localPages = getAllLocalPages();

    // Filter by workspace if specified
    let filteredPages = localPages;
    if (options.workspace) {
      filteredPages = localPages.filter(
        (p) => p.meta.workspace_slug === options.workspace
      );
      if (filteredPages.length === 0) {
        spinner.info(`No pages found for workspace: ${options.workspace}`);
        return;
      }
    }

    // Separate into modified (existing) and new pages
    const modifiedPages = filteredPages.filter((page) => {
      // Has an ID means it exists on remote
      if (!page.meta.id) return false;
      const currentHash = hashContent(page.content);
      return currentHash !== page.meta.local_hash;
    });

    const newPages = filteredPages.filter((page) => {
      // No ID or ID is empty means it's a new page
      return !page.meta.id;
    });

    const totalChanges = modifiedPages.length + newPages.length;

    if (totalChanges === 0) {
      spinner.info("No local changes to push");
      return;
    }

    spinner.text = `Pushing ${totalChanges} pages (${modifiedPages.length} modified, ${newPages.length} new)...`;

    let pushed = 0;
    let created = 0;
    let failed = 0;

    // Push modified pages
    for (const page of modifiedPages) {
      try {
        const updatedPage = await api.updatePage(
          page.meta.id,
          page.content,
          page.meta.title
        );

        // Update local file with new metadata
        savePage({
          ...updatedPage,
          workspace_slug: page.meta.workspace_slug,
        });

        pushed++;
        console.log(chalk.green(`  Updated: ${page.meta.workspace_slug}/${page.meta.slug}`));
      } catch (error) {
        failed++;
        console.log(chalk.red(`  Failed: ${page.meta.workspace_slug}/${page.meta.slug}`));
        console.log(chalk.gray(`    ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }

    // Create new pages - first check if we need to create any workspaces
    if (newPages.length > 0) {
      // Get all unique workspace slugs from new pages
      const newWorkspaceSlugs = new Set<string>();
      for (const page of newPages) {
        const workspaceSlug = page.meta.workspace_slug || basename(dirname(page.path));
        newWorkspaceSlugs.add(workspaceSlug);
      }

      // Fetch existing workspaces
      const existingWorkspaces = await api.getWorkspaces();
      const existingSlugs = new Set(
        existingWorkspaces.flatMap((ws) => [
          ws.slug,
          ws.name.toLowerCase().replace(/\s+/g, "-"),
        ].filter(Boolean))
      );

      // Create any missing workspaces
      for (const slug of newWorkspaceSlugs) {
        if (!existingSlugs.has(slug)) {
          try {
            // Convert slug to readable name
            const workspaceName = slug
              .split("-")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            console.log(chalk.blue(`  Creating workspace: ${workspaceName}`));
            const newWs = await api.createWorkspace(workspaceName);
            existingSlugs.add(newWs.slug);
          } catch (error) {
            console.log(chalk.red(`  Failed to create workspace: ${slug}`));
            console.log(chalk.gray(`    ${error instanceof Error ? error.message : "Unknown error"}`));
          }
        }
      }
    }

    for (const page of newPages) {
      try {
        // Extract workspace slug from the file path
        const workspaceSlug = page.meta.workspace_slug || basename(dirname(page.path));

        // Use title from frontmatter or derive from filename
        const title = page.meta.title || basename(page.path, ".md").replace(/-/g, " ");

        const createdPage = await api.createPage(
          title,
          page.content,
          workspaceSlug
        );

        // Save with the new ID from server
        savePage({
          ...createdPage,
          workspace_slug: workspaceSlug,
        });

        created++;
        console.log(chalk.cyan(`  Created: ${workspaceSlug}/${createdPage.slug}`));
      } catch (error) {
        failed++;
        const displayPath = page.meta.workspace_slug
          ? `${page.meta.workspace_slug}/${page.meta.slug || basename(page.path)}`
          : page.path;
        console.log(chalk.red(`  Failed: ${displayPath}`));
        console.log(chalk.gray(`    ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }

    if (failed === 0) {
      const parts = [];
      if (pushed > 0) parts.push(`${pushed} updated`);
      if (created > 0) parts.push(`${created} created`);
      spinner.succeed(`Push complete: ${parts.join(", ")}`);
    } else {
      const parts = [];
      if (pushed > 0) parts.push(`${pushed} updated`);
      if (created > 0) parts.push(`${created} created`);
      parts.push(`${failed} failed`);
      spinner.warn(`Push complete: ${parts.join(", ")}`);
    }

    // Auto-commit changes if git is available
    if (pushed > 0 || created > 0) {
      initGitIfNeeded();
      if (commitChanges("Push to LumifyHub")) {
        console.log(chalk.gray("  Committed to local git"));
      }
    }
  } catch (error) {
    spinner.fail("Failed to push pages");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
