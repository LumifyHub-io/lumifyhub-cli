import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { getAllLocalPages, hashContent, savePage } from "../lib/files.js";

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

    if (options.workspace) {
      const filtered = localPages.filter(
        (p) => p.meta.workspace_slug === options.workspace
      );
      if (filtered.length === 0) {
        spinner.info(`No pages found for workspace: ${options.workspace}`);
        return;
      }
    }

    // Find pages with local modifications
    const modifiedPages = localPages.filter((page) => {
      if (options.workspace && page.meta.workspace_slug !== options.workspace) {
        return false;
      }
      const currentHash = hashContent(page.content);
      return currentHash !== page.meta.local_hash;
    });

    if (modifiedPages.length === 0) {
      spinner.info("No local changes to push");
      return;
    }

    spinner.text = `Pushing ${modifiedPages.length} modified pages...`;

    let pushed = 0;
    let failed = 0;

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
        console.log(chalk.green(`  Pushed: ${page.meta.workspace_slug}/${page.meta.slug}`));
      } catch (error) {
        failed++;
        console.log(chalk.red(`  Failed: ${page.meta.workspace_slug}/${page.meta.slug}`));
        console.log(chalk.gray(`    ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }

    if (failed === 0) {
      spinner.succeed(`Push complete: ${pushed} pages updated`);
    } else {
      spinner.warn(`Push complete: ${pushed} succeeded, ${failed} failed`);
    }
  } catch (error) {
    spinner.fail("Failed to push pages");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
