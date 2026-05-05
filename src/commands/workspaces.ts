import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";

interface WorkspacesOpts {
  json?: boolean;
}

export async function workspacesCommand(opts: WorkspacesOpts = {}): Promise<void> {
  if (!isAuthenticated()) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: "Not authenticated" }) + "\n");
      process.exit(1);
    }
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = opts.json ? null : ora("Fetching workspaces...").start();

  try {
    const workspaces = await api.getWorkspaces();
    spinner?.stop();

    if (opts.json) {
      process.stdout.write(JSON.stringify(workspaces, null, 2) + "\n");
      return;
    }

    if (workspaces.length === 0) {
      console.log(chalk.yellow("No workspaces found."));
      return;
    }

    console.log(chalk.bold("\nYour workspaces:\n"));
    for (const ws of workspaces) {
      const slug = ws.slug || ws.name.toLowerCase().replace(/\s+/g, "-");
      console.log(`  ${chalk.cyan(ws.name)}`);
      console.log(`    ${chalk.gray(`-w ${slug}`)}\n`);
    }
  } catch (error) {
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }) + "\n"
      );
      process.exit(1);
    }
    spinner?.fail("Failed to fetch workspaces");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
