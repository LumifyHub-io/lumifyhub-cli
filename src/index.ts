#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand, logoutCommand, whoamiCommand } from "./commands/auth.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { searchCommand } from "./commands/search.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("lh")
  .description("LumifyHub CLI - sync and manage your pages locally")
  .version("0.1.0");

// Auth commands
program
  .command("login")
  .description("Authenticate with LumifyHub")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out and clear credentials")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Show current authenticated user")
  .action(whoamiCommand);

// Sync commands
program
  .command("pull")
  .description("Pull pages from LumifyHub to local")
  .option("-w, --workspace <slug>", "Pull only from specific workspace")
  .option("-f, --force", "Force overwrite local changes")
  .action(pullCommand);

program
  .command("push")
  .description("Push local changes to LumifyHub")
  .option("-w, --workspace <slug>", "Push only from specific workspace")
  .option("-f, --force", "Force overwrite remote changes")
  .action(pushCommand);

program
  .command("status")
  .description("Show sync status of local pages")
  .action(statusCommand);

// Search
program
  .command("search <query>")
  .description("Search through local pages")
  .option("-w, --workspace <slug>", "Search only in specific workspace")
  .action(searchCommand);

program.parse();
