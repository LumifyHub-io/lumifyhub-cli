import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../../lib/config.js";
import { getAllLocalDatabases, computeDatabaseHash } from "../../lib/db-files.js";

export async function dbListCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Loading local databases...").start();

  try {
    const databases = getAllLocalDatabases();

    if (databases.length === 0) {
      spinner.info("No local databases found. Run 'lh db pull' to sync databases.");
      return;
    }

    spinner.succeed(`Found ${databases.length} local database(s):`);

    // Group by workspace
    const byWorkspace = new Map<string, typeof databases>();
    for (const db of databases) {
      const existing = byWorkspace.get(db.workspaceSlug) || [];
      existing.push(db);
      byWorkspace.set(db.workspaceSlug, existing);
    }

    for (const [workspace, dbs] of byWorkspace) {
      console.log(chalk.blue(`\n  ${workspace}/`));

      for (const db of dbs) {
        const currentHash = computeDatabaseHash(db.schema, db.rows);
        const isModified = currentHash !== db.schema.local_hash;
        const modifiedIndicator = isModified ? chalk.yellow(" *") : "";

        console.log(`    ${chalk.cyan(db.schema.title)}${modifiedIndicator}`);
        console.log(chalk.gray(`      Slug: ${db.dbSlug}`));
        console.log(chalk.gray(`      Rows: ${db.rows.length}`));
        console.log(chalk.gray(`      Properties: ${db.schema.properties.length}`));

        if (db.schema.data_sources.length > 1) {
          console.log(chalk.gray(`      Data Sources: ${db.schema.data_sources.length}`));
        }
      }
    }

    console.log("");
  } catch (error) {
    spinner.fail("Failed to list databases");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
