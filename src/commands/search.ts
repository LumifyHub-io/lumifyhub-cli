import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { searchPages } from "../lib/files.js";

interface SearchOptions {
  workspace?: string;
}

export async function searchCommand(
  query: string,
  options: SearchOptions
): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.red("Not logged in. Run 'lh login' first."));
    return;
  }

  const results = searchPages(query, options.workspace);

  if (results.length === 0) {
    console.log(chalk.yellow(`No results found for "${query}"`));
    return;
  }

  console.log(chalk.blue(`\nFound ${results.length} result(s) for "${query}":\n`));

  for (const result of results) {
    console.log(chalk.cyan(`  ${result.workspace}/${result.title}`));
    console.log(chalk.gray(`    ${result.path}`));

    if (result.matches.length > 0) {
      for (const match of result.matches) {
        // Highlight the query in the match
        const highlighted = match.replace(
          new RegExp(`(${escapeRegex(query)})`, "gi"),
          chalk.yellow("$1")
        );
        console.log(chalk.gray(`    ... ${highlighted}`));
      }
    }
    console.log("");
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
