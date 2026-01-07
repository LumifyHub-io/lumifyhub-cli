import chalk from "chalk";
import ora from "ora";
import { createInterface } from "readline";
import { getConfig, setToken, clearAuth, isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function loginCommand(): Promise<void> {
  if (isAuthenticated()) {
    const config = getConfig();
    console.log(chalk.yellow(`Already logged in as ${config.email}`));
    const confirm = await prompt("Do you want to log in with a different account? (y/n) ");
    if (confirm.toLowerCase() !== "y") {
      return;
    }
  }

  console.log(chalk.blue("\nTo authenticate, you need a CLI token from LumifyHub."));
  console.log(chalk.gray("Go to lumifyhub.io/p → click your avatar → Account Settings → CLI tab\n"));

  const token = await prompt("Enter your API token: ");

  if (!token) {
    console.log(chalk.red("No token provided. Aborting."));
    return;
  }

  const spinner = ora("Validating token...").start();

  try {
    // Temporarily set token to validate
    setToken(token, "", "");

    const result = await api.validateToken();

    if (!result.valid) {
      clearAuth();
      spinner.fail("Invalid token");
      return;
    }

    setToken(token, result.userId!, result.email!);
    spinner.succeed(`Logged in as ${chalk.green(result.email)}`);
  } catch (error) {
    clearAuth();
    spinner.fail("Failed to validate token");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
  }
}

export async function logoutCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow("Not logged in."));
    return;
  }

  clearAuth();
  console.log(chalk.green("Logged out successfully."));
}

export async function whoamiCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow("Not logged in. Run 'lh login' to authenticate."));
    return;
  }

  const config = getConfig();
  console.log(chalk.blue("Logged in as:"), chalk.green(config.email));
  console.log(chalk.gray(`API: ${config.apiUrl}`));
  console.log(chalk.gray(`Pages: ${config.pagesDir}`));
}
