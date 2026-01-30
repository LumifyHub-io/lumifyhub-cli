import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { savePage, readLocalPage, getPagePath, hashContent } from "../lib/files.js";
import { initGitIfNeeded, commitChanges } from "../lib/git.js";
import { pullDatabases } from "./db/index.js";

interface PullOptions {
  workspace?: string;
  force?: boolean;
}

export async function pullCommand(options: PullOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Pulling from LumifyHub...").start();

  try {
    // Pull pages
    spinner.text = "Fetching pages...";
    const pages = await api.getPages(options.workspace);

    let pagesPulled = 0;
    let pagesSkipped = 0;
    let pagesConflicts = 0;

    for (const page of pages) {
      const pagePath = getPagePath(page.workspace_slug, page.slug);
      const local = readLocalPage(pagePath);

      if (local && !options.force) {
        const localContentHash = hashContent(local.content);
        const isLocalModified = localContentHash !== local.meta.local_hash;

        if (isLocalModified) {
          pagesConflicts++;
          console.log(chalk.yellow(`\n  Page Conflict: ${page.workspace_slug}/${page.slug}`));
          console.log(chalk.gray("    Use --force to overwrite local changes"));
          continue;
        }

        if (local.meta.updated_at === page.updated_at) {
          pagesSkipped++;
          continue;
        }
      }

      savePage(page);
      pagesPulled++;
    }

    // Pull databases
    spinner.text = "Fetching databases...";
    const dbResult = await pullDatabases(options, undefined, spinner);

    spinner.succeed("Pull complete");

    // Summary
    const totalPulled = pagesPulled + dbResult.pulled;
    const totalSkipped = pagesSkipped + dbResult.skipped;
    const totalConflicts = pagesConflicts + dbResult.conflicts;

    if (pagesPulled > 0) console.log(chalk.green(`  Pages: ${pagesPulled}`));
    if (dbResult.pulled > 0) console.log(chalk.green(`  Databases: ${dbResult.pulled}`));
    if (totalSkipped > 0) console.log(chalk.gray(`  Unchanged: ${totalSkipped}`));
    if (totalConflicts > 0) console.log(chalk.yellow(`  Conflicts: ${totalConflicts}`));

    // Auto-commit changes if git is available
    if (totalPulled > 0) {
      initGitIfNeeded();
      if (commitChanges("Pull from LumifyHub")) {
        console.log(chalk.gray("  Committed to local git"));
      }
    }
  } catch (error) {
    spinner.fail("Failed to pull");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
