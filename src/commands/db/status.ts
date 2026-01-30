import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../../lib/config.js";
import {
  getAllLocalDatabases,
  getDatabaseSyncStatuses,
  computeDatabaseHash,
} from "../../lib/db-files.js";

export async function dbStatusCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Checking database status...").start();

  try {
    const statuses = getDatabaseSyncStatuses();

    if (statuses.length === 0) {
      spinner.info("No local databases found. Run 'lh db pull' to sync databases.");
      return;
    }

    spinner.succeed("Database sync status:");

    // Group by workspace
    const byWorkspace = new Map<string, typeof statuses>();
    for (const status of statuses) {
      const existing = byWorkspace.get(status.workspaceSlug) || [];
      existing.push(status);
      byWorkspace.set(status.workspaceSlug, existing);
    }

    let totalSynced = 0;
    let totalModified = 0;

    for (const [workspace, dbs] of byWorkspace) {
      console.log(chalk.blue(`\n  ${workspace}/`));

      for (const db of dbs) {
        let statusText: string;
        let statusColor: (s: string) => string;

        switch (db.status) {
          case "synced":
            statusText = "synced";
            statusColor = chalk.green;
            totalSynced++;
            break;
          case "modified":
            statusText = "modified";
            statusColor = chalk.yellow;
            totalModified++;
            break;
          case "conflict":
            statusText = "conflict";
            statusColor = chalk.red;
            totalModified++;
            break;
          default:
            statusText = db.status;
            statusColor = chalk.gray;
        }

        console.log(`    ${db.databaseSlug} ${statusColor(`[${statusText}]`)}`);
      }
    }

    console.log("");
    console.log(chalk.gray(`  Total: ${statuses.length} database(s)`));
    if (totalSynced > 0) console.log(chalk.green(`  Synced: ${totalSynced}`));
    if (totalModified > 0) console.log(chalk.yellow(`  Modified: ${totalModified}`));

    if (totalModified > 0) {
      console.log(chalk.gray("\n  Run 'lh db push' to sync your changes."));
    }
  } catch (error) {
    spinner.fail("Failed to check status");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
