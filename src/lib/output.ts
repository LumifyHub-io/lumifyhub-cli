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
 * Commander `.option()` collector for repeatable flags. Use as:
 *   .option("--prop <kv...>", "Property", collect, [])
 */
export function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
