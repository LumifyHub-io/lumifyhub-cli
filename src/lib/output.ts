/**
 * Output helpers for CLI commands.
 *
 * `printResult` emits machine-readable JSON when --json is set so agentic
 * callers (Claude Code, scripts) can parse output reliably. Otherwise it
 * defers to a caller-supplied human formatter.
 */

import chalk from "chalk";

export interface OutputOptions {
  json?: boolean;
}

export function printResult<T>(
  data: T,
  human: (value: T) => void,
  opts: OutputOptions = {}
): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    return;
  }
  human(data);
}

/**
 * Render a row value for human/CSV output. Servers may send typed JSON values
 * (numbers, booleans, null, arrays, objects) or plain strings; never throws.
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const hasObject = value.some((v) => v !== null && typeof v === "object");
    return hasObject ? JSON.stringify(value) : value.map(cellToString).join(",");
  }
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

export function printError(message: string, opts: OutputOptions = {}): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify({ error: message }, null, 2) + "\n");
  } else {
    console.error(chalk.red(message));
  }
  process.exit(1);
}

/**
 * Parse repeated --prop key=value flags into an object.
 *   --prop status=Done --prop priority=High
 *   -> { status: "Done", priority: "High" }
 *
 * Values that are JSON literals (arrays, true/false, numbers) are parsed; all
 * others stay as strings so option-name resolution can run server-side.
 */
export function parsePropFlags(values: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const raw of values) {
    const eq = raw.indexOf("=");
    if (eq === -1) {
      throw new Error(`Invalid --prop "${raw}" — expected key=value`);
    }
    const key = raw.slice(0, eq).trim();
    const rawValue = raw.slice(eq + 1);
    if (!key) {
      throw new Error(`Invalid --prop "${raw}" — empty key`);
    }
    out[key] = parseScalar(rawValue);
  }
  return out;
}

function parseScalar(raw: string): unknown {
  if (raw === "") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Parse a JSON-object flag value (--config, --settings). Throws a readable
 * error on invalid JSON or a non-object.
 */
export function parseJsonObjectFlag(flag: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON for ${flag}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${flag} must be a JSON object, e.g. '{"key":"value"}'`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Commander `.option()` collector for repeatable flags. Use as:
 *   .option("--prop <kv...>", "Property", collect, [])
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
