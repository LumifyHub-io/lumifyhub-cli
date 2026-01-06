import chalk from "chalk";
import { getConfig, setApiUrl, setPagesDir } from "../lib/config.js";

interface ConfigOptions {
  apiUrl?: string;
  pagesDir?: string;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  if (options.apiUrl) {
    setApiUrl(options.apiUrl);
    console.log(chalk.green(`API URL set to: ${options.apiUrl}`));
  }

  if (options.pagesDir) {
    setPagesDir(options.pagesDir);
    console.log(chalk.green(`Pages directory set to: ${options.pagesDir}`));
  }

  // If no options, show current config
  if (!options.apiUrl && !options.pagesDir) {
    const config = getConfig();
    console.log(chalk.blue("\nCurrent configuration:\n"));
    console.log(`  API URL:    ${chalk.cyan(config.apiUrl)}`);
    console.log(`  Pages dir:  ${chalk.cyan(config.pagesDir)}`);
    console.log(`  Logged in:  ${config.token ? chalk.green(config.email) : chalk.gray("No")}`);
    console.log("");
  }
}
