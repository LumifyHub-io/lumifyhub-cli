import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { savePage, readLocalPage, getPagePath, hashContent } from "../lib/files.js";

interface PullOptions {
  workspace?: string;
  force?: boolean;
}

export async function pullCommand(options: PullOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Fetching pages from LumifyHub...").start();

  try {
    const pages = await api.getPages(options.workspace);
    spinner.text = `Found ${pages.length} pages`;

    let pulled = 0;
    let skipped = 0;
    let conflicts = 0;

    for (const page of pages) {
      const pagePath = getPagePath(page.workspace_slug, page.slug);
      const local = readLocalPage(pagePath);

      if (local && !options.force) {
        const localContentHash = hashContent(local.content);
        const isLocalModified = localContentHash !== local.meta.local_hash;

        if (isLocalModified) {
          conflicts++;
          console.log(chalk.yellow(`\n  Conflict: ${page.workspace_slug}/${page.slug}`));
          console.log(chalk.gray("    Use --force to overwrite local changes"));
          continue;
        }

        // Check if remote is same as what we have
        const remoteHash = hashContent(page.content);
        if (remoteHash === local.meta.remote_hash) {
          skipped++;
          continue;
        }
      }

      savePage(page);
      pulled++;
    }

    spinner.succeed(`Pull complete`);
    console.log(chalk.green(`  Pulled: ${pulled}`));
    if (skipped > 0) console.log(chalk.gray(`  Unchanged: ${skipped}`));
    if (conflicts > 0) console.log(chalk.yellow(`  Conflicts: ${conflicts}`));
  } catch (error) {
    spinner.fail("Failed to pull pages");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
