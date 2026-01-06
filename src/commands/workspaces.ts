import chalk from "chalk";
import ora from "ora";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";

export async function workspacesCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const spinner = ora("Fetching workspaces...").start();

  try {
    const workspaces = await api.getWorkspaces();
    spinner.stop();

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
    spinner.fail("Failed to fetch workspaces");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}
