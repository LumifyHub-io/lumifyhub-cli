/**
 * Database view CRUD commands.
 * Registered as: lh view <ls|create|update|delete>
 */

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";

async function viewList(databaseId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const views = await api.getViews(databaseId);
    printResult(views, (list) => {
      if (list.length === 0) { console.log("No views."); return; }
      for (const v of list) {
        console.log(`${chalk.cyan(v.id)} ${chalk.bold(v.view_name)} [${v.view_type}] sort=${v.sort_order}`);
      }
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list views", opts);
  }
}

interface ViewCreateOpts {
  type: "table" | "board" | "form";
  dataSourceId: string;
  sortOrder?: number;
  json?: boolean;
}

async function viewCreate(databaseId: string, name: string, opts: ViewCreateOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const view = await api.createView(databaseId, {
      name,
      type: opts.type,
      data_source_id: opts.dataSourceId,
      ...(opts.sortOrder !== undefined ? { sort_order: opts.sortOrder } : {}),
    });
    printResult(view, (v) =>
      console.log(`${chalk.green("Created view")} ${chalk.cyan(v.id)}: ${chalk.bold(v.view_name)} [${v.view_type}]`),
    opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create view", opts);
  }
}

interface ViewUpdateOpts {
  name?: string;
  type?: "table" | "board" | "form";
  dataSourceId?: string;
  sortOrder?: number;
  json?: boolean;
}

async function viewUpdate(databaseId: string, viewId: string, opts: ViewUpdateOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  const payload: Parameters<typeof api.updateView>[2] = {};
  if (opts.name) payload.name = opts.name;
  if (opts.type) payload.type = opts.type;
  if (opts.dataSourceId) payload.data_source_id = opts.dataSourceId;
  if (opts.sortOrder !== undefined) payload.sort_order = opts.sortOrder;
  if (Object.keys(payload).length === 0) { printError("Provide at least one field to update", opts); return; }
  try {
    const view = await api.updateView(databaseId, viewId, payload);
    printResult(view, () => console.log(chalk.green(`Updated view ${viewId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update view", opts);
  }
}

async function viewDelete(databaseId: string, viewId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const result = await api.deleteView(databaseId, viewId);
    printResult(result, () => console.log(chalk.green(`Deleted view ${viewId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete view", opts);
  }
}

export function registerViewCommands(program: Command): void {
  const view = program.command("view").description("Manage database views");

  view
    .command("ls <db-id>")
    .alias("list")
    .description("List views for a database")
    .option("--json", "Output JSON")
    .action(viewList);

  view
    .command("create <db-id> <name>")
    .description("Create a new view")
    .requiredOption("-t, --type <type>", "View type: table|board|form")
    .requiredOption("-s, --data-source-id <id>", "Data source UUID this view displays")
    .option("--sort-order <n>", "Sort order (integer)", (v) => parseInt(v, 10))
    .option("--json", "Output JSON")
    .action(viewCreate);

  view
    .command("update <db-id> <view-id>")
    .description("Update a view")
    .option("-n, --name <name>", "New view name")
    .option("-t, --type <type>", "New view type: table|board|form")
    .option("-s, --data-source-id <id>", "New data source UUID")
    .option("--sort-order <n>", "New sort order", (v) => parseInt(v, 10))
    .option("--json", "Output JSON")
    .action(viewUpdate);

  view
    .command("delete <db-id> <view-id>")
    .alias("rm")
    .description("Delete a view")
    .option("--json", "Output JSON")
    .action(viewDelete);
}
