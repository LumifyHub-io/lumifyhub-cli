import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../../lib/config.js";
import { api } from "../../lib/api.js";
import {
  getDatabasePath,
  getLocalDatabase,
  saveDatabase,
  computeDatabaseHash,
  apiRowToLocal,
} from "../../lib/db-files.js";
import { initGitIfNeeded, commitChanges } from "../../lib/git.js";
import type { DatabaseRow, PropertyMeta, DataSourceMeta } from "../../types/index.js";

interface DbPullOptions {
  workspace?: string;
  force?: boolean;
}

export async function dbPullCommand(databaseSlug?: string, options: DbPullOptions = {}): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Fetching databases from LumifyHub...").start();

  try {
    // Fetch database list
    const databases = await api.getDatabases(options.workspace);

    if (databases.length === 0) {
      spinner.info("No databases found");
      return;
    }

    // Filter by slug if specified
    let databasesToSync = databases;
    if (databaseSlug) {
      databasesToSync = databases.filter(
        (db) => db.slug === databaseSlug || db.slug.startsWith(databaseSlug)
      );
      if (databasesToSync.length === 0) {
        spinner.fail(`Database not found: ${databaseSlug}`);
        return;
      }
    }

    spinner.text = `Found ${databasesToSync.length} database(s)`;

    let pulled = 0;
    let skipped = 0;
    let conflicts = 0;

    for (const dbInfo of databasesToSync) {
      spinner.text = `Pulling ${dbInfo.workspace_slug}/${dbInfo.slug}...`;

      // Fetch full database details
      const database = await api.getDatabase(dbInfo.id);

      // Convert API rows to local format
      const rows: DatabaseRow[] = database.rows.map((row) =>
        apiRowToLocal(
          {
            id: row._id,
            title: row._title,
            data_source_id: row._data_source_id,
            properties: extractProperties(row, database.properties),
          },
          database.properties
        )
      );

      // Compute remote hash
      const remoteSchema = {
        id: database.id,
        title: database.title,
        workspace_id: database.workspace_id,
        workspace_slug: database.workspace_slug,
        slug: database.slug,
        updated_at: database.updated_at,
        data_sources: database.data_sources,
        properties: database.properties,
        local_hash: "",
        remote_hash: "",
      };
      const remoteHash = computeDatabaseHash(remoteSchema, rows);

      // Check local state
      const local = getLocalDatabase(database.workspace_slug, database.slug);

      if (local && !options.force) {
        // Check if local has been modified
        const currentLocalHash = computeDatabaseHash(local.schema, local.rows);
        const isLocalModified = currentLocalHash !== local.schema.local_hash;

        if (isLocalModified) {
          conflicts++;
          console.log(chalk.yellow(`\n  Conflict: ${database.workspace_slug}/${database.slug}`));
          console.log(chalk.gray("    Use --force to overwrite local changes"));
          continue;
        }

        // Check if remote has changed since last pull
        if (local.schema.remote_hash === remoteHash) {
          skipped++;
          continue;
        }
      }

      // Save database locally
      saveDatabase(
        database.workspace_slug,
        database.slug,
        {
          id: database.id,
          title: database.title,
          workspace_id: database.workspace_id,
          workspace_slug: database.workspace_slug,
          slug: database.slug,
          updated_at: database.updated_at,
          data_sources: database.data_sources,
          properties: database.properties,
        },
        rows,
        remoteHash
      );

      pulled++;
      console.log(chalk.green(`  Pulled: ${database.workspace_slug}/${database.slug} (${rows.length} rows)`));
    }

    spinner.succeed("Pull complete");
    if (pulled > 0) console.log(chalk.green(`  Pulled: ${pulled}`));
    if (skipped > 0) console.log(chalk.gray(`  Unchanged: ${skipped}`));
    if (conflicts > 0) console.log(chalk.yellow(`  Conflicts: ${conflicts}`));

    // Auto-commit if changes were made
    if (pulled > 0) {
      initGitIfNeeded();
      if (commitChanges("Pull databases from LumifyHub")) {
        console.log(chalk.gray("  Committed to local git"));
      }
    }
  } catch (error) {
    spinner.fail("Failed to pull databases");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Extract property values from a flat row object
 */
function extractProperties(
  row: Record<string, unknown>,
  properties: PropertyMeta[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const prop of properties) {
    if (prop.property_id in row) {
      result[prop.property_id] = row[prop.property_id];
    }
  }
  return result;
}
