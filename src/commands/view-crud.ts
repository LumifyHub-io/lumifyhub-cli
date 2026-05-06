/**
 * Database view CRUD commands.
 * Registered as: lh view <ls|create|update|delete|settings|set-filters|set-sorts|set-group>
 *
 * Note: filters/sorts/group-by are user-specific settings (stored in user_preferences).
 * They apply only to the CLI-authenticated user, not the whole workspace.
 */

import { Command } from "commander";
import chalk from "chalk";
import { randomUUID } from "crypto";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError, collect } from "../lib/output.js";
import type { ViewFilter } from "../types/index.js";

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

async function viewSettings(databaseId: string, viewId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const settings = await api.getViewSettings(databaseId, viewId);
    printResult(settings, (s) => {
      const filters = (s.filters ?? []) as ViewFilter[];
      const sorts = s.sorts ?? [];
      const board = s.boardSettings;
      console.log(chalk.bold("Filters:"), filters.length === 0 ? chalk.gray("none") : "");
      for (const f of filters) {
        console.log(`  ${chalk.cyan(f.propertyId)} ${f.operator} ${f.value ?? ""} [${f.logic ?? "and"}]`);
      }
      console.log(chalk.bold("Sorts:"), sorts.length === 0 ? chalk.gray("none") : "");
      for (const s of sorts) {
        console.log(`  ${chalk.cyan(s.propertyId)} ${s.direction}`);
      }
      if (board?.groupByPropertyId) {
        console.log(chalk.bold("Group by:"), chalk.cyan(board.groupByPropertyId));
      }
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get view settings", opts);
  }
}

// --filter "propId:operator:value" or "propId:is_empty"
function parseFilterFlag(raw: string): ViewFilter {
  const parts = raw.split(":");
  if (parts.length < 2) throw new Error(`Invalid filter "${raw}" — use "propId:operator[:value]"`);
  const [propertyId, operator, ...valueParts] = parts;
  const value = valueParts.length > 0 ? valueParts.join(":") : undefined;
  return { id: randomUUID(), propertyId, operator: operator as ViewFilter["operator"], value };
}

async function viewSetFilters(
  databaseId: string,
  viewId: string,
  opts: { filter: string[]; logic?: string; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  let filters: ViewFilter[];
  try {
    filters = opts.filter.map((f, i) => ({
      ...parseFilterFlag(f),
      logic: i < opts.filter.length - 1 ? ((opts.logic ?? "and") as "and" | "or") : undefined,
    }));
  } catch (err) {
    printError(err instanceof Error ? err.message : "Invalid filter flag", opts);
    return;
  }
  try {
    const result = await api.updateViewSettings(databaseId, viewId, { filters });
    printResult(result, () => console.log(chalk.green(`Set ${filters.length} filter(s)`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to set filters", opts);
  }
}

// --sort "propId:asc|desc"
function parseSortFlag(raw: string): { propertyId: string; direction: "asc" | "desc" } {
  const [propertyId, direction = "asc"] = raw.split(":");
  if (direction !== "asc" && direction !== "desc") throw new Error(`Invalid direction "${direction}" — use asc or desc`);
  return { propertyId, direction };
}

async function viewSetSorts(
  databaseId: string,
  viewId: string,
  opts: { sort: string[]; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  let sorts: { propertyId: string; direction: "asc" | "desc" }[];
  try {
    sorts = opts.sort.map(parseSortFlag);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Invalid sort flag", opts);
    return;
  }
  try {
    const result = await api.updateViewSettings(databaseId, viewId, { sorts });
    printResult(result, () => console.log(chalk.green(`Set ${sorts.length} sort(s)`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to set sorts", opts);
  }
}

async function viewSetGroup(
  databaseId: string,
  viewId: string,
  propId: string,
  opts: { cardProp: string[]; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const result = await api.updateViewSettings(databaseId, viewId, {
      boardSettings: {
        groupByPropertyId: propId === "none" ? null : propId,
        ...(opts.cardProp.length > 0 ? { cardDisplayProperties: opts.cardProp } : {}),
      },
    });
    printResult(result, () =>
      console.log(chalk.green(`Group by: ${propId === "none" ? "cleared" : propId}`)),
    opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to set group", opts);
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

  view
    .command("settings <db-id> <view-id>")
    .description("Show your current filters, sorts, and group-by for a view")
    .option("--json", "Output JSON")
    .action(viewSettings);

  view
    .command("set-filters <db-id> <view-id>")
    .description(
      'Set filters on a view (user-specific). Use --filter "propId:operator[:value]" (repeatable). Clears existing filters.'
    )
    .option(
      "--filter <spec>",
      'Filter spec: "propId:operator[:value]" — operators: equals|not_equals|contains|not_contains|starts_with|ends_with|is_empty|is_not_empty|greater_than|less_than|in_checked|before|after|...',
      collect,
      []
    )
    .option("--logic <and|or>", "Logic between filters (default: and)", "and")
    .option("--json", "Output JSON")
    .action(viewSetFilters);

  view
    .command("set-sorts <db-id> <view-id>")
    .description(
      'Set sorts on a view (user-specific). Use --sort "propId:asc|desc" (repeatable). Clears existing sorts.'
    )
    .option(
      "--sort <spec>",
      'Sort spec: "propId:asc" or "propId:desc"',
      collect,
      []
    )
    .option("--json", "Output JSON")
    .action(viewSetSorts);

  view
    .command("set-group <db-id> <view-id> <prop-id>")
    .description(
      "Set group-by property for a board view (user-specific). Pass \"none\" to clear grouping."
    )
    .option(
      "--card-prop <id>",
      "Property ID to display on cards (repeatable)",
      collect,
      []
    )
    .option("--json", "Output JSON")
    .action(viewSetGroup);
}
