/**
 * Direct database + row CRUD commands (no filesystem sync).
 * Registered as: lh db <create|get|delete> and lh row <list|get|create|update|delete>
 */

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError, parsePropFlags, collect } from "../lib/output.js";

interface DbCreateOpts {
  workspace: string;
  parentId?: string;
  json?: boolean;
}

async function dbCreate(title: string, opts: DbCreateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  if (!opts.workspace) {
    printError("--workspace required", opts);
    return;
  }
  try {
    const db = await api.createDatabase(title, opts.workspace, opts.parentId);
    printResult(
      db,
      (d) =>
        console.log(
          `${chalk.green("Created database")} ${chalk.cyan(d.id)}: ${d.title}\n` +
          chalk.gray(`default_data_source_id=${d.default_data_source_id}`)
        ),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create database", opts);
  }
}

async function dbGet(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const db = await api.getDatabase(id);
    printResult(
      db,
      (d) => {
        console.log(chalk.bold(d.title));
        console.log(chalk.gray(`${d.id}  workspace=${d.workspace_slug}`));
        console.log(chalk.gray(`Properties: ${d.properties.map((p) => p.property_name).join(", ")}`));
        console.log(chalk.gray(`Rows: ${d.rows.length}`));
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get database", opts);
  }
}

async function dbDelete(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteDatabase(id);
    printResult(result, () => console.log(chalk.green(`Deleted database ${id}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete database", opts);
  }
}

interface RowCreateOpts {
  title: string;
  dataSourceId?: string;
  prop: string[];
  json?: boolean;
}

async function rowCreate(databaseId: string, opts: RowCreateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  if (!opts.title) {
    printError("--title required", opts);
    return;
  }
  let properties: Record<string, unknown> = {};
  try {
    properties = parsePropFlags(opts.prop || []);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Invalid --prop", opts);
    return;
  }
  try {
    const row = await api.createRow(databaseId, {
      title: opts.title,
      data_source_id: opts.dataSourceId ?? null,
      properties,
    });
    printResult(
      row,
      (r) => console.log(`${chalk.green("Created row")} ${chalk.cyan(r.id)}: ${r.title}`),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create row", opts);
  }
}

async function rowList(databaseId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const db = await api.getDatabase(databaseId);
    printResult(
      db.rows,
      (rows) => {
        if (rows.length === 0) {
          console.log(chalk.gray("No rows."));
          return;
        }
        for (const r of rows) {
          console.log(`${chalk.cyan(r._id)}  ${r._title || chalk.gray("(untitled)")}`);
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list rows", opts);
  }
}

async function rowGet(databaseId: string, rowId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const row = await api.getRow(databaseId, rowId);
    printResult(
      row,
      (r) => {
        console.log(chalk.bold(r.title));
        console.log(chalk.gray(`${r.id}`));
        console.log(JSON.stringify(r.properties, null, 2));
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get row", opts);
  }
}

interface RowUpdateOpts {
  title?: string;
  dataSourceId?: string;
  prop: string[];
  json?: boolean;
}

async function rowUpdate(databaseId: string, rowId: string, opts: RowUpdateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  let properties: Record<string, unknown> | undefined;
  if (opts.prop && opts.prop.length > 0) {
    try {
      properties = parsePropFlags(opts.prop);
    } catch (err) {
      printError(err instanceof Error ? err.message : "Invalid --prop", opts);
      return;
    }
  }
  if (opts.title === undefined && opts.dataSourceId === undefined && !properties) {
    printError("Provide --title, --data-source-id, or --prop", opts);
    return;
  }
  try {
    const row = await api.updateRow(databaseId, rowId, {
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.dataSourceId !== undefined ? { data_source_id: opts.dataSourceId } : {}),
      ...(properties ? { properties } : {}),
    });
    printResult(row, (r) => console.log(chalk.green(`Updated row ${r.id}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update row", opts);
  }
}

async function rowDelete(databaseId: string, rowId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteRow(databaseId, rowId);
    printResult(result, () => console.log(chalk.green(`Deleted row ${rowId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete row", opts);
  }
}

export function registerDatabaseCrudCommands(dbCommand: Command): void {
  dbCommand
    .command("create <title>")
    .description("Create a new database in a workspace")
    .option("-w, --workspace <slug>", "Workspace slug (required)")
    .option("--parent-id <id>", "Parent page ID")
    .option("--json", "Output JSON")
    .action(dbCreate);

  dbCommand
    .command("get <id>")
    .description("Show database with rows + properties")
    .option("--json", "Output JSON")
    .action(dbGet);

  dbCommand
    .command("delete <id>")
    .alias("rm")
    .description("Soft-delete a database")
    .option("--json", "Output JSON")
    .action(dbDelete);
}

export function registerRowCommands(program: Command): void {
  const row = program.command("row").description("Manage database rows directly");

  row
    .command("list <db-id>")
    .alias("ls")
    .description("List rows in a database")
    .option("--json", "Output JSON")
    .action(rowList);

  row
    .command("get <db-id> <row-id>")
    .description("Show a single row")
    .option("--json", "Output JSON")
    .action(rowGet);

  row
    .command("create <db-id>")
    .description("Create a row in a database")
    .requiredOption("-t, --title <title>", "Row title")
    .option("-d, --data-source-id <id>", "Data source (defaults to first)")
    .option("--prop <kv>", "Property key=value (repeatable)", collect, [])
    .option("--json", "Output JSON")
    .action(rowCreate);

  row
    .command("update <db-id> <row-id>")
    .description("Update a row's title / data source / properties")
    .option("-t, --title <title>", "New title")
    .option("-d, --data-source-id <id>", "Move to data source")
    .option("--prop <kv>", "Property key=value (repeatable)", collect, [])
    .option("--json", "Output JSON")
    .action(rowUpdate);

  row
    .command("delete <db-id> <row-id>")
    .alias("rm")
    .description("Soft-delete a row")
    .option("--json", "Output JSON")
    .action(rowDelete);
}
