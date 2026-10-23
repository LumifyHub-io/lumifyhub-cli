/**
 * File commands. Registered as: lh file <get|info>
 */

import { Command } from "commander";
import chalk from "chalk";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";
import { parseFileRef, safeFilename } from "../lib/file-ref.js";

interface FileOpts {
  json?: boolean;
  output?: string;
}

async function fileInfo(ref: string, opts: FileOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const info = await api.getFileInfo(parseFileRef(ref));
    printResult(info, (f) => {
      console.log(`${chalk.cyan(f.id)} ${chalk.bold(f.original_filename ?? "(unnamed)")}`);
      console.log(`  ${f.content_type ?? "unknown type"}, ${f.size ?? "?"} bytes, ${f.storage_type}`);
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get file info", opts);
  }
}

async function fileGet(ref: string, opts: FileOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const id = parseFileRef(ref);
    const toStdout = opts.output === "-";
    // Metadata first: the filename and type come from it, not from the CDN.
    const info = await api.getFileInfo(id);
    const { bytes, contentType } = await api.downloadFile(id);
    const filename = safeFilename(info.original_filename, id);
    const result = {
      ok: true,
      path: toStdout ? "-" : resolve(opts.output ?? filename),
      filename,
      content_type: info.content_type ?? contentType,
      bytes: bytes.length,
    };

    if (toStdout) {
      process.stdout.write(bytes);
      return;
    }
    writeFileSync(result.path, bytes);
    printResult(result, (r) => console.log(`${chalk.green("Saved")} ${r.path} (${r.bytes} bytes)`), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to download file", opts);
  }
}

export function registerFileCommands(program: Command): void {
  const file = program.command("file").description("Download files and read their metadata");

  file
    .command("get <id>")
    .description("Download a file (id, /api/files/<id>/raw path, or lumifyhub.io URL)")
    .option("-o, --output <path>", "Where to save it ('-' for stdout); default ./<original filename>")
    .option("--json", "Output JSON")
    .action(fileGet);

  file
    .command("info <id>")
    .description("Show a file's metadata")
    .option("--json", "Output JSON")
    .action(fileInfo);
}
