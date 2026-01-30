import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { DatabaseSchema, DatabaseRow, PropertyMeta, DataSourceMeta, DatabaseSyncStatus } from "../types/index.js";

const DEFAULT_DATABASES_DIR = join(homedir(), ".lumifyhub", "databases");

export function getDatabasesDir(): string {
  return DEFAULT_DATABASES_DIR;
}

export function getDatabasePath(workspaceSlug: string, dbSlug: string): string {
  return join(getDatabasesDir(), workspaceSlug, dbSlug);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Hash content for change detection (SHA256, first 16 chars)
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Compute hash of schema (properties + data sources)
 */
export function hashSchema(properties: PropertyMeta[], dataSources: DataSourceMeta[]): string {
  const sortedProps = [...properties].sort((a, b) => a.property_id.localeCompare(b.property_id));
  const sortedSources = [...dataSources].sort((a, b) => a.id.localeCompare(b.id));
  const content = JSON.stringify({ properties: sortedProps, dataSources: sortedSources });
  return hashContent(content);
}

/**
 * Compute hash of row data
 */
export function hashData(rows: DatabaseRow[]): string {
  const sortedRows = [...rows].sort((a, b) => a._id.localeCompare(b._id));
  const content = JSON.stringify(sortedRows);
  return hashContent(content);
}

/**
 * Combined hash of schema + data
 */
export function computeDatabaseHash(schema: DatabaseSchema, rows: DatabaseRow[]): string {
  const schemaHash = hashSchema(schema.properties, schema.data_sources);
  const dataHash = hashData(rows);
  return hashContent(schemaHash + dataHash);
}

// Simple YAML parser/writer for our schema format
function parseYaml(content: string): DatabaseSchema {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  let currentKey = "";
  let currentArray: Record<string, unknown>[] = [];
  let inArray = false;
  let arrayItemIndent = 0;
  let currentItem: Record<string, unknown> = {};
  let inNestedObject = false;
  let nestedKey = "";
  let nestedObject: Record<string, unknown> = {};

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const currentIndent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Check for array items
    if (trimmed.startsWith("- ")) {
      if (inArray && Object.keys(currentItem).length > 0) {
        if (inNestedObject && nestedKey) {
          currentItem[nestedKey] = nestedObject;
          nestedObject = {};
          inNestedObject = false;
        }
        currentArray.push(currentItem);
        currentItem = {};
      }
      inArray = true;
      arrayItemIndent = currentIndent;

      // Parse inline object in array item: - key: value
      const itemContent = trimmed.slice(2);
      if (itemContent.includes(":")) {
        const colonIndex = itemContent.indexOf(":");
        const key = itemContent.slice(0, colonIndex).trim();
        const value = itemContent.slice(colonIndex + 1).trim();
        currentItem[key] = parseYamlValue(value);
      }
      continue;
    }

    // Key-value pair
    if (trimmed.includes(":")) {
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (inArray) {
        if (currentIndent > arrayItemIndent) {
          // Property of current array item
          if (value === "" || value === "{}") {
            // Nested object starts
            inNestedObject = true;
            nestedKey = key;
            nestedObject = {};
          } else if (inNestedObject && currentIndent > arrayItemIndent + 4) {
            // Property of nested object
            nestedObject[key] = parseYamlValue(value);
          } else if (inNestedObject && currentIndent <= arrayItemIndent + 4) {
            // End nested object, start new property
            if (Object.keys(nestedObject).length > 0) {
              currentItem[nestedKey] = nestedObject;
            }
            inNestedObject = false;
            nestedKey = "";
            nestedObject = {};
            currentItem[key] = parseYamlValue(value);
          } else {
            currentItem[key] = parseYamlValue(value);
          }
        } else {
          // New top-level key, end array
          if (Object.keys(currentItem).length > 0) {
            if (inNestedObject && nestedKey) {
              currentItem[nestedKey] = nestedObject;
              nestedObject = {};
              inNestedObject = false;
            }
            currentArray.push(currentItem);
            currentItem = {};
          }
          result[currentKey] = currentArray;
          currentArray = [];
          inArray = false;

          if (value === "") {
            // New array starts
            currentKey = key;
          } else {
            result[key] = parseYamlValue(value);
          }
        }
      } else {
        if (value === "") {
          // Array or object starts
          currentKey = key;
        } else {
          result[key] = parseYamlValue(value);
        }
      }
    }
  }

  // Handle final array item
  if (inArray) {
    if (Object.keys(currentItem).length > 0) {
      if (inNestedObject && nestedKey) {
        currentItem[nestedKey] = nestedObject;
      }
      currentArray.push(currentItem);
    }
    result[currentKey] = currentArray;
  }

  return result as unknown as DatabaseSchema;
}

function parseYamlValue(value: string): unknown {
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  // Handle JSON values
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, treat as string
    }
  }
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  }
  return value;
}

function stringifyYaml(schema: DatabaseSchema): string {
  const lines: string[] = [];

  // Top-level simple properties
  lines.push(`id: "${schema.id}"`);
  lines.push(`title: "${escapeYamlString(schema.title)}"`);
  lines.push(`workspace_id: "${schema.workspace_id}"`);
  lines.push(`workspace_slug: "${schema.workspace_slug}"`);
  lines.push(`slug: "${schema.slug}"`);
  lines.push(`updated_at: "${schema.updated_at}"`);
  lines.push(`local_hash: "${schema.local_hash}"`);
  lines.push(`remote_hash: "${schema.remote_hash}"`);
  lines.push("");

  // Data sources array
  lines.push("data_sources:");
  if (schema.data_sources.length === 0) {
    lines.push("  []");
  } else {
    for (const ds of schema.data_sources) {
      lines.push(`  - id: "${ds.id}"`);
      lines.push(`    name: "${escapeYamlString(ds.name)}"`);
      lines.push(`    sort_order: ${ds.sort_order}`);
    }
  }
  lines.push("");

  // Properties array
  lines.push("properties:");
  if (schema.properties.length === 0) {
    lines.push("  []");
  } else {
    for (const prop of schema.properties) {
      lines.push(`  - property_id: "${prop.property_id}"`);
      lines.push(`    property_name: "${escapeYamlString(prop.property_name)}"`);
      lines.push(`    property_type: "${prop.property_type}"`);
      lines.push(`    data_source_id: ${prop.data_source_id ? `"${prop.data_source_id}"` : "null"}`);
      lines.push(`    sort_order: ${prop.sort_order}`);
      lines.push(`    config: ${JSON.stringify(prop.config)}`);
    }
  }

  return lines.join("\n") + "\n";
}

function escapeYamlString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// Simple CSV parser/writer
function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || "";
    }
    records.push(record);
  }

  return records;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

function stringifyCsv(records: Record<string, string>[], columns: string[]): string {
  const lines: string[] = [];

  // Header
  lines.push(columns.map(escapeCsvValue).join(","));

  // Rows
  for (const record of records) {
    const values = columns.map((col) => escapeCsvValue(record[col] || ""));
    lines.push(values.join(","));
  }

  return lines.join("\n") + "\n";
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Read schema.yaml from a database directory
 */
export function readDatabaseSchema(dbPath: string): DatabaseSchema | null {
  const schemaPath = join(dbPath, "schema.yaml");
  if (!existsSync(schemaPath)) {
    return null;
  }

  try {
    const content = readFileSync(schemaPath, "utf-8");
    return parseYaml(content);
  } catch {
    return null;
  }
}

/**
 * Write schema.yaml to a database directory
 */
export function writeDatabaseSchema(dbPath: string, schema: DatabaseSchema): void {
  ensureDir(dbPath);
  const schemaPath = join(dbPath, "schema.yaml");
  const content = stringifyYaml(schema);
  writeFileSync(schemaPath, content, "utf-8");
}

/**
 * Read data.csv from a database directory
 */
export function readDatabaseRows(dbPath: string, properties: PropertyMeta[]): DatabaseRow[] {
  const dataPath = join(dbPath, "data.csv");
  if (!existsSync(dataPath)) {
    return [];
  }

  try {
    const content = readFileSync(dataPath, "utf-8");
    if (!content.trim()) {
      return [];
    }

    const records = parseCsv(content);

    return records.map((record) => {
      const row: DatabaseRow = {
        _id: record._id || "",
        _title: record._title || "",
        _data_source_id: record._data_source_id || null,
      };

      // Add property columns
      for (const prop of properties) {
        const value = record[prop.property_id];
        row[prop.property_id] = value === "" ? null : value ?? null;
      }

      return row;
    });
  } catch {
    return [];
  }
}

/**
 * Write data.csv to a database directory
 */
export function writeDatabaseRows(dbPath: string, rows: DatabaseRow[], properties: PropertyMeta[]): void {
  ensureDir(dbPath);
  const dataPath = join(dbPath, "data.csv");

  // Build column headers: _id, _title, _data_source_id, then properties in sort order
  const sortedProps = [...properties].sort((a, b) => a.sort_order - b.sort_order);
  const columns = ["_id", "_title", "_data_source_id", ...sortedProps.map((p) => p.property_id)];

  // Convert rows to records
  const records = rows.map((row) => {
    const record: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col];
      record[col] = value === null || value === undefined ? "" : String(value);
    }
    return record;
  });

  const content = stringifyCsv(records, columns);
  writeFileSync(dataPath, content, "utf-8");
}

/**
 * Save a complete database (schema + rows)
 */
export function saveDatabase(
  workspaceSlug: string,
  dbSlug: string,
  schema: Omit<DatabaseSchema, "local_hash" | "remote_hash">,
  rows: DatabaseRow[],
  remoteHash: string
): void {
  const dbPath = getDatabasePath(workspaceSlug, dbSlug);
  ensureDir(dbPath);

  // Compute local hash
  const fullSchema: DatabaseSchema = {
    ...schema,
    local_hash: remoteHash,
    remote_hash: remoteHash,
  };

  writeDatabaseSchema(dbPath, fullSchema);
  writeDatabaseRows(dbPath, rows, schema.properties);
}

/**
 * Delete a database directory
 */
export function deleteDatabase(workspaceSlug: string, dbSlug: string): void {
  const dbPath = getDatabasePath(workspaceSlug, dbSlug);
  if (existsSync(dbPath)) {
    rmSync(dbPath, { recursive: true });
  }
}

/**
 * Get all local databases
 */
export function getAllLocalDatabases(): Array<{
  path: string;
  workspaceSlug: string;
  dbSlug: string;
  schema: DatabaseSchema;
  rows: DatabaseRow[];
}> {
  const databases: Array<{
    path: string;
    workspaceSlug: string;
    dbSlug: string;
    schema: DatabaseSchema;
    rows: DatabaseRow[];
  }> = [];

  const dbDir = getDatabasesDir();
  if (!existsSync(dbDir)) {
    return databases;
  }

  // Iterate workspaces
  const workspaces = readdirSync(dbDir);
  for (const workspace of workspaces) {
    const workspacePath = join(dbDir, workspace);
    if (!statSync(workspacePath).isDirectory()) continue;

    // Iterate databases in workspace
    const dbs = readdirSync(workspacePath);
    for (const db of dbs) {
      const dbPath = join(workspacePath, db);
      if (!statSync(dbPath).isDirectory()) continue;

      const schema = readDatabaseSchema(dbPath);
      if (!schema) continue;

      const rows = readDatabaseRows(dbPath, schema.properties);
      databases.push({
        path: dbPath,
        workspaceSlug: workspace,
        dbSlug: db,
        schema,
        rows,
      });
    }
  }

  return databases;
}

/**
 * Get local database by workspace and slug
 */
export function getLocalDatabase(
  workspaceSlug: string,
  dbSlug: string
): { schema: DatabaseSchema; rows: DatabaseRow[] } | null {
  const dbPath = getDatabasePath(workspaceSlug, dbSlug);
  const schema = readDatabaseSchema(dbPath);
  if (!schema) return null;

  const rows = readDatabaseRows(dbPath, schema.properties);
  return { schema, rows };
}

/**
 * Check if local database has been modified
 */
export function isDatabaseModified(workspaceSlug: string, dbSlug: string): boolean {
  const local = getLocalDatabase(workspaceSlug, dbSlug);
  if (!local) return false;

  const currentHash = computeDatabaseHash(local.schema, local.rows);
  return currentHash !== local.schema.local_hash;
}

/**
 * Get sync status for all local databases
 */
export function getDatabaseSyncStatuses(): DatabaseSyncStatus[] {
  const databases = getAllLocalDatabases();
  return databases.map((db) => {
    const currentHash = computeDatabaseHash(db.schema, db.rows);
    const isModified = currentHash !== db.schema.local_hash;

    return {
      path: db.path,
      databaseSlug: db.dbSlug,
      workspaceSlug: db.workspaceSlug,
      status: isModified ? "modified" : "synced",
      localHash: currentHash,
      remoteHash: db.schema.remote_hash,
    };
  });
}

/**
 * Convert API row format to local DatabaseRow format
 */
export function apiRowToLocal(
  apiRow: {
    id: string;
    title: string;
    data_source_id: string | null;
    properties: Record<string, unknown>;
  },
  properties: PropertyMeta[]
): DatabaseRow {
  const row: DatabaseRow = {
    _id: apiRow.id,
    _title: apiRow.title || "",
    _data_source_id: apiRow.data_source_id,
  };

  // Convert property values to strings
  for (const prop of properties) {
    const value = apiRow.properties?.[prop.property_id];
    if (value === null || value === undefined) {
      row[prop.property_id] = null;
    } else if (typeof value === "object") {
      // For complex types (arrays, objects), JSON stringify
      row[prop.property_id] = JSON.stringify(value);
    } else {
      row[prop.property_id] = String(value);
    }
  }

  return row;
}

interface SelectOption {
  id: string;
  name: string;
  color: string;
}

/**
 * Convert local DatabaseRow to API format for updates
 * Handles converting select option names back to IDs
 */
export function localRowToApi(
  row: DatabaseRow,
  properties: PropertyMeta[]
): {
  id: string;
  title: string;
  data_source_id: string | null;
  properties: Record<string, unknown>;
} {
  const apiProperties: Record<string, unknown> = {};

  for (const prop of properties) {
    const value = row[prop.property_id];
    if (value === null || value === undefined || value === "") {
      apiProperties[prop.property_id] = null;
      continue;
    }

    // Handle select - convert option name back to ID
    if (prop.property_type === "select") {
      const options = (prop.config?.options as SelectOption[]) || [];
      const option = options.find((o) => o.name === value || o.id === value);
      apiProperties[prop.property_id] = option?.id || value;
      continue;
    }

    // Handle multi-select - convert comma-separated names back to ID array
    if (prop.property_type === "multi_select") {
      const options = (prop.config?.options as SelectOption[]) || [];
      const names = value.split(",").map((n) => n.trim()).filter(Boolean);
      const ids = names.map((name) => {
        const option = options.find((o) => o.name === name || o.id === name);
        return option?.id || name;
      });
      apiProperties[prop.property_id] = ids.length > 0 ? ids : null;
      continue;
    }

    // Try to parse JSON for other complex types
    try {
      apiProperties[prop.property_id] = JSON.parse(value);
    } catch {
      apiProperties[prop.property_id] = value;
    }
  }

  return {
    id: row._id,
    title: row._title,
    data_source_id: row._data_source_id,
    properties: apiProperties,
  };
}

/**
 * Detect changes between local and remote rows
 */
export function detectRowChanges(
  localRows: DatabaseRow[],
  remoteRows: DatabaseRow[],
  properties: PropertyMeta[]
): {
  create: DatabaseRow[];
  update: DatabaseRow[];
  delete: string[];
} {
  const remoteById = new Map(remoteRows.map((r) => [r._id, r]));
  const localById = new Map(localRows.map((r) => [r._id, r]));

  const create: DatabaseRow[] = [];
  const update: DatabaseRow[] = [];
  const deleteIds: string[] = [];

  // Find new and updated rows
  for (const localRow of localRows) {
    const remoteRow = remoteById.get(localRow._id);
    if (!remoteRow) {
      // New row (ID doesn't exist remotely)
      create.push(localRow);
    } else {
      // Check if updated
      if (isRowModified(localRow, remoteRow, properties)) {
        update.push(localRow);
      }
    }
  }

  // Find deleted rows (in remote but not in local)
  for (const remoteRow of remoteRows) {
    if (!localById.has(remoteRow._id)) {
      deleteIds.push(remoteRow._id);
    }
  }

  return { create, update, delete: deleteIds };
}

/**
 * Check if a row has been modified
 */
function isRowModified(local: DatabaseRow, remote: DatabaseRow, properties: PropertyMeta[]): boolean {
  if (local._title !== remote._title) return true;
  if (local._data_source_id !== remote._data_source_id) return true;

  for (const prop of properties) {
    const localVal = local[prop.property_id];
    const remoteVal = remote[prop.property_id];

    // Normalize for comparison
    const normalizedLocal = localVal === "" ? null : localVal;
    const normalizedRemote = remoteVal === "" ? null : remoteVal;

    if (normalizedLocal !== normalizedRemote) {
      return true;
    }
  }

  return false;
}
