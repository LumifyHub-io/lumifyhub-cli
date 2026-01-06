import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { getConfig } from "./config.js";

function hasGit(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

function runGit(args: string[], cwd: string): boolean {
  try {
    execSync(`git ${args.join(" ")}`, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function initGitIfNeeded(): boolean {
  if (!hasGit()) return false;

  const { pagesDir } = getConfig();

  if (!isGitRepo(pagesDir)) {
    if (!runGit(["init"], pagesDir)) return false;
    // Create .gitignore for any temp files
    runGit(["config", "user.email", "cli@lumifyhub.io"], pagesDir);
    runGit(["config", "user.name", "LumifyHub CLI"], pagesDir);
  }

  return true;
}

export function commitChanges(message: string): boolean {
  if (!hasGit()) return false;

  const { pagesDir } = getConfig();

  if (!isGitRepo(pagesDir)) return false;

  // Stage all changes
  runGit(["add", "-A"], pagesDir);

  // Check if there are changes to commit
  try {
    execSync("git diff --cached --quiet", { cwd: pagesDir, stdio: "ignore" });
    // No changes staged
    return false;
  } catch {
    // Changes exist, commit them
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    runGit(["commit", "-m", `${message} - ${timestamp}`], pagesDir);
    return true;
  }
}
