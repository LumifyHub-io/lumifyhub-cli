/**
 * Direct database-property CRUD commands.
 * Registered as: lh prop <create|update|delete>
 *
 * Read paths live under `lh db get` (which already returns `properties`),
 * so no `prop list` is needed here.
 */

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError, collect } from "../lib/output.js";

interface PropCreateOpts {
  type: string;
  dataSourceId?: string;
  option: string[];
  // formula
  expression?: string;
  outputType?: string;
  // relation
  targetDatabaseId?: string;
  targetDataSourceId?: string;
  // rollup
  relationPropertyId?: string;
  targetPropertyId?: string;
  aggregation?: string;
  json?: boolean;
}

async function propCreate(databaseId: string, name: string, opts: PropCreateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }

  try {
    const payload: Parameters<typeof api.createProperty>[1] = {
      name,
      type: opts.type,
      ...(opts.dataSourceId ? { data_source_id: opts.dataSourceId } : {}),
      ...(opts.option.length > 0 ? { options: opts.option } : {}),
    };

    if (opts.type === "formula") {
      if (!opts.expression) { printError("--expression required for formula type", opts); return; }
      Object.assign(payload, { expression: opts.expression, output_type: opts.outputType ?? "text" });
    }

    if (opts.type === "relation") {
      if (!opts.targetDatabaseId) { printError("--target-database-id required for relation type", opts); return; }
      Object.assign(payload, {
        target_database_id: opts.targetDatabaseId,
        ...(opts.targetDataSourceId ? { target_data_source_id: opts.targetDataSourceId } : {}),
      });
    }

    if (opts.type === "rollup") {
      if (!opts.relationPropertyId || !opts.targetPropertyId || !opts.aggregation) {
        printError("--relation-property-id, --target-property-id, and --aggregation required for rollup", opts);
        return;
      }
      Object.assign(payload, {
        relation_property_id: opts.relationPropertyId,
        target_property_id: opts.targetPropertyId,
        aggregation: opts.aggregation,
      });
    }

    const result = await api.createProperty(databaseId, payload);
    printResult(
      result,
      (r) =>
        console.log(
          `${chalk.green("Created property")} ${chalk.cyan(r.property_id)}: ${r.property_name} (${r.property_type})`
        ),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create property", opts);
  }
}

interface PropUpdateOpts {
  name?: string;
  type?: string;
  option: string[];
  json?: boolean;
}

async function propUpdate(
  databaseId: string,
  propId: string,
  opts: PropUpdateOpts
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }

  const payload: Parameters<typeof api.updateProperty>[2] = {};
  if (opts.name !== undefined) payload.name = opts.name;
  if (opts.type !== undefined) payload.type = opts.type;
  if (opts.option && opts.option.length > 0) payload.options = opts.option;

  if (Object.keys(payload).length === 0) {
    printError("Provide --name, --type, or --option", opts);
    return;
  }

  try {
    const result = await api.updateProperty(databaseId, propId, payload);
    printResult(result, () => console.log(chalk.green(`Updated property ${propId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update property", opts);
  }
}

async function propDelete(
  databaseId: string,
  propId: string,
  opts: { json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteProperty(databaseId, propId);
    printResult(result, () => console.log(chalk.green(`Deleted property ${propId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete property", opts);
  }
}

export function registerPropertyCommands(program: Command): void {
  const prop = program.command("prop").description("Manage database property columns");

  prop
    .command("create <db-id> <name>")
    .description("Create a new property column")
    .requiredOption(
      "-t, --type <type>",
      "Property type (text|number|date|select|multi_select|checkbox|url|email|formula|relation|rollup|...)"
    )
    .option("-d, --data-source-id <id>", "Data source (defaults to first)")
    .option("--option <name>", "Select / multi_select option name (repeatable)", collect, [])
    // formula
    .option("--expression <expr>", "Formula expression (required for formula type)")
    .option("--output-type <type>", "Formula output type: number|text|date|boolean (default: text)")
    // relation
    .option("--target-database-id <id>", "Target database UUID (required for relation type)")
    .option("--target-data-source-id <id>", "Target data source UUID (optional for relation type)")
    // rollup
    .option("--relation-property-id <id>", "Relation property ID (required for rollup type)")
    .option("--target-property-id <id>", "Target property ID to aggregate (required for rollup type)")
    .option("--aggregation <fn>", "Aggregation function: count|sum|avg|min|max (required for rollup type)")
    .option("--json", "Output JSON")
    .action(propCreate);

  prop
    .command("update <db-id> <prop-id>")
    .description("Update a property's name, type, or options")
    .option("-n, --name <name>", "New display name")
    .option("-t, --type <type>", "New property type")
    .option(
      "--option <name>",
      "Replace options list with these (repeatable)",
      collect,
      []
    )
    .option("--json", "Output JSON")
    .action(propUpdate);

  prop
    .command("delete <db-id> <prop-id>")
    .alias("rm")
    .description("Delete a property column")
    .option("--json", "Output JSON")
    .action(propDelete);
}
