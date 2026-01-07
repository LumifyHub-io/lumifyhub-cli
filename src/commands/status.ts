import chalk from "chalk";
import { isAuthenticated, getConfig } from "../lib/config.js";
import { getAllLocalPages, hashContent } from "../lib/files.js";

export async function statusCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const config = getConfig();
  const localPages = getAllLocalPages();

  if (localPages.length === 0) {
    console.log(chalk.yellow("No local pages found."));
    console.log(chalk.gray(`Run 'lh pull' to fetch pages from LumifyHub.`));
    console.log(chalk.gray(`Pages directory: ${config.pagesDir}`));
    return;
  }

  console.log(chalk.blue(`\nLocal pages (${config.pagesDir}):\n`));

  // Group by workspace
  const byWorkspace = new Map<string, typeof localPages>();
  for (const page of localPages) {
    const workspace = page.meta.workspace_slug;
    if (!byWorkspace.has(workspace)) {
      byWorkspace.set(workspace, []);
    }
    byWorkspace.get(workspace)!.push(page);
  }

  let totalModified = 0;

  for (const [workspace, pages] of byWorkspace) {
    console.log(chalk.cyan(`  ${workspace}/`));

    for (const page of pages) {
      const currentHash = hashContent(page.content);
      const isModified = currentHash !== page.meta.local_hash;

      if (isModified) {
        totalModified++;
        console.log(chalk.yellow(`    M ${page.meta.slug}.md`));
      } else {
        console.log(chalk.gray(`      ${page.meta.slug}.md`));
      }
    }
  }

  console.log("");

  if (totalModified > 0) {
    console.log(chalk.yellow(`${totalModified} modified file(s). Run 'lh push' to sync.`));
  } else {
    console.log(chalk.green("All files are synced."));
  }
}
