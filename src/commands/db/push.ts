import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../../lib/config.js";
import { api } from "../../lib/api.js";
import {
  getAllLocalDatabases,
  getLocalDatabase,
  saveDatabase,
  computeDatabaseHash,
  detectRowChanges,
  localRowToApi,
  apiRowToLocal,
} from "../../lib/db-files.js";
import { initGitIfNeeded, commitChanges } from "../../lib/git.js";
import type { DatabaseRow } from "../../types/index.js";

interface DbPushOptions {
  workspace?: string;
  force?: boolean;
}

export async function dbPushCommand(databaseSlug?: string, options: DbPushOptions = {}): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Checking for local changes...").start();

  try {
    // Get all local databases
    let localDatabases = getAllLocalDatabases();

    // Filter by workspace if specified
    if (options.workspace) {
      localDatabases = localDatabases.filter((db) => db.workspaceSlug === options.workspace);
    }

    // Filter by slug if specified
    if (databaseSlug) {
      localDatabases = localDatabases.filter(
        (db) => db.dbSlug === databaseSlug || db.dbSlug.startsWith(databaseSlug)
      );
    }

    if (localDatabases.length === 0) {
      spinner.info("No local databases found");
      return;
    }

    // Find databases with changes
    const modifiedDatabases = localDatabases.filter((db) => {
      const currentHash = computeDatabaseHash(db.schema, db.rows);
      return currentHash !== db.schema.local_hash;
    });

    if (modifiedDatabases.length === 0) {
      spinner.info("No local changes to push");
      return;
    }

    spinner.text = `Found ${modifiedDatabases.length} modified database(s)`;

    let pushed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    let failed = 0;

    for (const localDb of modifiedDatabases) {
      spinner.text = `Pushing ${localDb.workspaceSlug}/${localDb.dbSlug}...`;

      try {
        // Fetch current remote state
        const remoteDb = await api.getDatabase(localDb.schema.id);

        // Convert remote rows to local format for comparison
        const remoteRows: DatabaseRow[] = remoteDb.rows.map((row) =>
          apiRowToLocal(
            {
              id: row._id,
              title: row._title,
              data_source_id: row._data_source_id,
              properties: extractProperties(row, remoteDb.properties),
            },
            remoteDb.properties
          )
        );

        // Detect changes
        const changes = detectRowChanges(localDb.rows, remoteRows, localDb.schema.properties);

        if (changes.create.length === 0 && changes.update.length === 0 && changes.delete.length === 0) {
          // Schema might have changed but no row changes
          console.log(chalk.gray(`  Skipped: ${localDb.workspaceSlug}/${localDb.dbSlug} (no row changes)`));
          continue;
        }

        // Prepare batch operations
        const operations = {
          create: changes.create.map((row) => {
            const apiRow = localRowToApi(row, localDb.schema.properties);
            return {
              title: apiRow.title,
              data_source_id: apiRow.data_source_id,
              properties: apiRow.properties,
            };
          }),
          update: changes.update.map((row) => {
            const apiRow = localRowToApi(row, localDb.schema.properties);
            return {
              id: apiRow.id,
              title: apiRow.title,
              data_source_id: apiRow.data_source_id,
              properties: apiRow.properties,
            };
          }),
          delete: changes.delete,
        };

        // Execute batch operations
        const result = await api.batchUpdateRows(localDb.schema.id, operations);

        if (result.errors.length > 0) {
          console.log(chalk.yellow(`\n  Warnings for ${localDb.workspaceSlug}/${localDb.dbSlug}:`));
          for (const error of result.errors) {
            console.log(chalk.gray(`    ${error}`));
          }
        }

        // Update local state with new remote state
        const updatedRemoteDb = await api.getDatabase(localDb.schema.id);
        const updatedRemoteRows: DatabaseRow[] = updatedRemoteDb.rows.map((row) =>
          apiRowToLocal(
            {
              id: row._id,
              title: row._title,
              data_source_id: row._data_source_id,
              properties: extractProperties(row, updatedRemoteDb.properties),
            },
            updatedRemoteDb.properties
          )
        );

        const newRemoteHash = computeDatabaseHash(
          {
            ...localDb.schema,
            local_hash: "",
            remote_hash: "",
          },
          updatedRemoteRows
        );

        // Save updated state
        saveDatabase(
          localDb.workspaceSlug,
          localDb.dbSlug,
          {
            id: localDb.schema.id,
            title: localDb.schema.title,
            workspace_id: localDb.schema.workspace_id,
            workspace_slug: localDb.schema.workspace_slug,
            slug: localDb.schema.slug,
            updated_at: updatedRemoteDb.updated_at,
            data_sources: localDb.schema.data_sources,
            properties: localDb.schema.properties,
          },
          updatedRemoteRows,
          newRemoteHash
        );

        pushed++;
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalDeleted += result.deleted;

        const changes_summary = [];
        if (result.created > 0) changes_summary.push(`${result.created} created`);
        if (result.updated > 0) changes_summary.push(`${result.updated} updated`);
        if (result.deleted > 0) changes_summary.push(`${result.deleted} deleted`);

        console.log(
          chalk.green(`  Pushed: ${localDb.workspaceSlug}/${localDb.dbSlug} (${changes_summary.join(", ")})`)
        );
      } catch (error) {
        failed++;
        console.log(chalk.red(`  Failed: ${localDb.workspaceSlug}/${localDb.dbSlug}`));
        console.log(chalk.gray(`    ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }

    if (failed === 0) {
      spinner.succeed("Push complete");
    } else {
      spinner.warn("Push complete with errors");
    }

    const summary = [];
    if (pushed > 0) summary.push(`${pushed} database(s)`);
    if (totalCreated > 0) summary.push(`${totalCreated} rows created`);
    if (totalUpdated > 0) summary.push(`${totalUpdated} rows updated`);
    if (totalDeleted > 0) summary.push(`${totalDeleted} rows deleted`);
    if (failed > 0) summary.push(`${failed} failed`);

    if (summary.length > 0) {
      console.log(chalk.gray(`  Summary: ${summary.join(", ")}`));
    }

    // Auto-commit if changes were made
    if (pushed > 0) {
      initGitIfNeeded();
      if (commitChanges("Push databases to LumifyHub")) {
        console.log(chalk.gray("  Committed to local git"));
      }
    }
  } catch (error) {
    spinner.fail("Failed to push databases");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}

/**
 * Extract property values from a flat row object
 */
function extractProperties(
  row: Record<string, unknown>,
  properties: Array<{ property_id: string }>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const prop of properties) {
    if (prop.property_id in row) {
      result[prop.property_id] = row[prop.property_id];
    }
  }
  return result;
}
