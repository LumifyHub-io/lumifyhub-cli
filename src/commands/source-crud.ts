/**
 * Database data source CRUD commands.
 * Registered as: lh source <ls|create|link|update|delete>
 */

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";

async function sourceList(databaseId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const sources = await api.getSources(databaseId);
    printResult(sources, (list) => {
      if (list.length === 0) { console.log("No data sources."); return; }
      for (const s of list) {
        const tag = s.is_linked ? chalk.yellow("[linked]") : chalk.gray("[owned]");
        console.log(`${chalk.cyan(s.id)} ${chalk.bold(s.name)} ${tag} sort=${s.sort_order}`);
      }
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list data sources", opts);
  }
}

interface SourceCreateOpts {
  sortOrder?: number;
  json?: boolean;
}

async function sourceCreate(databaseId: string, name: string, opts: SourceCreateOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const source = await api.createSource(databaseId, {
      name,
      ...(opts.sortOrder !== undefined ? { sort_order: opts.sortOrder } : {}),
    });
    printResult(source, (s) =>
      console.log(`${chalk.green("Created source")} ${chalk.cyan(s.id)}: ${chalk.bold(s.name)}`),
    opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create data source", opts);
  }
}

interface SourceLinkOpts {
  sortOrder?: number;
  json?: boolean;
}

async function sourceLink(
  databaseId: string,
  name: string,
  sourceDatabaseId: string,
  opts: SourceLinkOpts
): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const source = await api.linkSource(databaseId, {
      name,
      source_database_id: sourceDatabaseId,
      ...(opts.sortOrder !== undefined ? { sort_order: opts.sortOrder } : {}),
    });
    printResult(source, (s) =>
      console.log(`${chalk.green("Linked source")} ${chalk.cyan(s.id)}: ${chalk.bold(s.name)} → ${sourceDatabaseId}`),
    opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to link data source", opts);
  }
}

interface SourceUpdateOpts {
  name?: string;
  sortOrder?: number;
  json?: boolean;
}

async function sourceUpdate(databaseId: string, sourceId: string, opts: SourceUpdateOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  const payload: { name?: string; sort_order?: number } = {};
  if (opts.name) payload.name = opts.name;
  if (opts.sortOrder !== undefined) payload.sort_order = opts.sortOrder;
  if (Object.keys(payload).length === 0) { printError("Provide --name or --sort-order", opts); return; }
  try {
    const source = await api.updateSource(databaseId, sourceId, payload);
    printResult(source, () => console.log(chalk.green(`Updated source ${sourceId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update data source", opts);
  }
}

async function sourceDelete(databaseId: string, sourceId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const result = await api.deleteSource(databaseId, sourceId);
    printResult(result, () => console.log(chalk.green(`Deleted source ${sourceId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete data source", opts);
  }
}

export function registerSourceCommands(program: Command): void {
  const source = program.command("source").description("Manage database data sources");

  source
    .command("ls <db-id>")
    .alias("list")
    .description("List data sources for a database")
    .option("--json", "Output JSON")
    .action(sourceList);

  source
    .command("create <db-id> <name>")
    .description("Create a new (owned) data source in a database")
    .option("--sort-order <n>", "Sort order (integer)", (v) => parseInt(v, 10))
    .option("--json", "Output JSON")
    .action(sourceCreate);

  source
    .command("link <db-id> <name> <source-db-id>")
    .description("Link an existing data source into a database")
    .option("--sort-order <n>", "Sort order (integer)", (v) => parseInt(v, 10))
    .option("--json", "Output JSON")
    .action(sourceLink);

  source
    .command("update <db-id> <source-id>")
    .description("Update a data source's name or sort order")
    .option("-n, --name <name>", "New name")
    .option("--sort-order <n>", "New sort order", (v) => parseInt(v, 10))
    .option("--json", "Output JSON")
    .action(sourceUpdate);

  source
    .command("delete <db-id> <source-id>")
    .alias("rm")
    .description("Delete a data source")
    .option("--json", "Output JSON")
    .action(sourceDelete);
}
