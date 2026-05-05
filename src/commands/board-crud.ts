/**
 * Direct board / list / card CRUD commands (no filesystem sync).
 * Registered as: lh board <...>, lh list <...>, lh card <...>
 */

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated } from "../lib/config.js";
import { api } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";

// ===== boards =====

interface BoardListOpts {
  workspace?: string;
  json?: boolean;
}

async function boardList(opts: BoardListOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const boards = await api.getBoards(opts.workspace);
    printResult(
      boards,
      (rows) => {
        if (rows.length === 0) {
          console.log(chalk.gray("No boards."));
          return;
        }
        for (const b of rows) {
          console.log(`${chalk.cyan(b.id)}  ${b.title}  ${chalk.gray(`(${b.workspace_slug ?? b.workspace_id})`)}`);
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list boards", opts);
  }
}

interface BoardCreateOpts {
  workspace: string;
  parentId?: string;
  private?: boolean;
  json?: boolean;
}

async function boardCreate(title: string, opts: BoardCreateOpts): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  if (!opts.workspace) {
    printError("--workspace required", opts);
    return;
  }
  try {
    const board = await api.createBoard(title, opts.workspace, {
      parentId: opts.parentId,
      isPrivate: opts.private,
    });
    printResult(
      board,
      (b) => console.log(`${chalk.green("Created board")} ${chalk.cyan(b.id)}: ${b.title}`),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create board", opts);
  }
}

async function boardGet(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const board = await api.getBoard(id);
    printResult(
      board,
      (b) => {
        console.log(chalk.bold(b.title));
        console.log(chalk.gray(`${b.id}`));
        for (const list of b.lists) {
          const cards = b.cards.filter((c) => c.list_id === list.id);
          console.log(`\n${chalk.cyan(list.name)} ${chalk.gray(`(${cards.length})`)}`);
          for (const card of cards) {
            console.log(`  ${chalk.gray(card.id.slice(0, 8))}  ${card.title}`);
          }
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get board", opts);
  }
}

async function boardDelete(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteBoard(id);
    printResult(result, () => console.log(chalk.green(`Deleted board ${id}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete board", opts);
  }
}

// ===== lists =====

async function listList(boardId: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const lists = await api.getLists(boardId);
    printResult(
      lists,
      (rows) => {
        if (rows.length === 0) {
          console.log(chalk.gray("No lists."));
          return;
        }
        for (const l of rows) {
          console.log(`${chalk.cyan(l.id)}  ${l.name}  ${chalk.gray(`pos=${l.position}`)}`);
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list lists", opts);
  }
}

async function listCreate(
  boardId: string,
  opts: { name: string; position?: string; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const list = await api.createList(boardId, {
      name: opts.name,
      ...(opts.position !== undefined ? { position: Number(opts.position) } : {}),
    });
    printResult(
      list,
      (l) => console.log(`${chalk.green("Created list")} ${chalk.cyan(l.id)}: ${l.name}`),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create list", opts);
  }
}

async function listUpdate(
  boardId: string,
  listId: string,
  opts: { name?: string; position?: string; completed?: boolean; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  const payload: { name?: string; position?: number; is_completed_list?: boolean } = {};
  if (opts.name !== undefined) payload.name = opts.name;
  if (opts.position !== undefined) payload.position = Number(opts.position);
  if (opts.completed !== undefined) payload.is_completed_list = opts.completed;

  if (Object.keys(payload).length === 0) {
    printError("Provide --name, --position, or --completed", opts);
    return;
  }

  try {
    const list = await api.updateList(boardId, listId, payload);
    printResult(list, (l) => console.log(chalk.green(`Updated list ${l.id}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update list", opts);
  }
}

async function listDelete(
  boardId: string,
  listId: string,
  opts: { json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteList(boardId, listId);
    printResult(result, () => console.log(chalk.green(`Deleted list ${listId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete list", opts);
  }
}

// ===== cards =====

async function cardList(
  boardId: string,
  opts: { list?: string; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const cards = await api.getCards(boardId, opts.list);
    printResult(
      cards,
      (rows) => {
        if (rows.length === 0) {
          console.log(chalk.gray("No cards."));
          return;
        }
        for (const c of rows) {
          const list = c.list_name ? chalk.gray(`[${c.list_name}]`) : "";
          console.log(`${chalk.cyan(c.id)}  ${c.title}  ${list}`);
        }
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list cards", opts);
  }
}

async function cardCreate(
  boardId: string,
  opts: { list: string; title: string; description?: string; position?: string; json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const card = await api.createCard(boardId, {
      list_id: opts.list,
      title: opts.title,
      ...(opts.description !== undefined ? { description: opts.description } : {}),
      ...(opts.position !== undefined ? { position: Number(opts.position) } : {}),
    });
    printResult(
      card,
      (c) => console.log(`${chalk.green("Created card")} ${chalk.cyan(c.id)}: ${c.title}`),
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to create card", opts);
  }
}

async function cardGet(
  boardId: string,
  cardId: string,
  opts: { json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const card = await api.getCard(boardId, cardId);
    printResult(
      card,
      (c) => {
        console.log(chalk.bold(c.title));
        console.log(chalk.gray(`${c.id}  list=${c.list_id}`));
        if (c.description) console.log("\n" + JSON.stringify(c.description, null, 2));
      },
      opts
    );
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get card", opts);
  }
}

async function cardUpdate(
  boardId: string,
  cardId: string,
  opts: {
    title?: string;
    description?: string;
    list?: string;
    position?: string;
    due?: string;
    completed?: boolean;
    json?: boolean;
  }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  const payload: Parameters<typeof api.updateCard>[2] = {};
  if (opts.title !== undefined) payload.title = opts.title;
  if (opts.description !== undefined) payload.description = opts.description;
  if (opts.list !== undefined) payload.list_id = opts.list;
  if (opts.position !== undefined) payload.position = Number(opts.position);
  if (opts.due !== undefined) payload.due_date = opts.due === "" ? null : opts.due;
  if (opts.completed !== undefined) payload.completed = opts.completed;

  if (Object.keys(payload).length === 0) {
    printError("Provide at least one field to update", opts);
    return;
  }

  try {
    const card = await api.updateCard(boardId, cardId, payload);
    printResult(card, (c) => console.log(chalk.green(`Updated card ${c.id}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update card", opts);
  }
}

async function cardDelete(
  boardId: string,
  cardId: string,
  opts: { json?: boolean }
): Promise<void> {
  if (!isAuthenticated()) {
    printError("Not authenticated. Run 'lh login' first.", opts);
    return;
  }
  try {
    const result = await api.deleteCard(boardId, cardId);
    printResult(result, () => console.log(chalk.green(`Deleted card ${cardId}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to delete card", opts);
  }
}

// ===== registration =====

export function registerBoardCommands(program: Command): void {
  const board = program.command("board").description("Manage Kanban boards directly");

  board
    .command("list")
    .alias("ls")
    .description("List boards")
    .option("-w, --workspace <slug>", "Filter by workspace")
    .option("--json", "Output JSON")
    .action(boardList);

  board
    .command("create <title>")
    .description("Create a board in a workspace")
    .requiredOption("-w, --workspace <slug>", "Workspace slug")
    .option("--parent-id <id>", "Parent page ID")
    .option("--private", "Private board")
    .option("--json", "Output JSON")
    .action(boardCreate);

  board
    .command("get <id>")
    .description("Show a board with its lists and cards")
    .option("--json", "Output JSON")
    .action(boardGet);

  board
    .command("delete <id>")
    .alias("rm")
    .description("Soft-delete a board")
    .option("--json", "Output JSON")
    .action(boardDelete);
}

export function registerListCommands(program: Command): void {
  const list = program.command("list").description("Manage board lists (Kanban columns)");

  list
    .command("ls <board-id>")
    .description("List lists on a board")
    .option("--json", "Output JSON")
    .action(listList);

  list
    .command("create <board-id>")
    .description("Create a list on a board")
    .requiredOption("-n, --name <name>", "List name")
    .option("-p, --position <n>", "Position")
    .option("--json", "Output JSON")
    .action(listCreate);

  list
    .command("update <board-id> <list-id>")
    .description("Update a list")
    .option("-n, --name <name>", "New name")
    .option("-p, --position <n>", "New position")
    .option("--completed", "Mark as the completed list")
    .option("--json", "Output JSON")
    .action(listUpdate);

  list
    .command("delete <board-id> <list-id>")
    .alias("rm")
    .description("Soft-delete a list")
    .option("--json", "Output JSON")
    .action(listDelete);
}

export function registerCardCommands(program: Command): void {
  const card = program.command("card").description("Manage board cards");

  card
    .command("list <board-id>")
    .alias("ls")
    .description("List cards on a board")
    .option("-l, --list <list-id>", "Filter by list ID")
    .option("--json", "Output JSON")
    .action(cardList);

  card
    .command("create <board-id>")
    .description("Create a card on a list")
    .requiredOption("-l, --list <list-id>", "List ID")
    .requiredOption("-t, --title <title>", "Card title")
    .option("-d, --description <text>", "Description")
    .option("-p, --position <n>", "Position")
    .option("--json", "Output JSON")
    .action(cardCreate);

  card
    .command("get <board-id> <card-id>")
    .description("Show a single card")
    .option("--json", "Output JSON")
    .action(cardGet);

  card
    .command("update <board-id> <card-id>")
    .description("Update a card (title/desc/list/etc)")
    .option("-t, --title <title>", "New title")
    .option("-d, --description <text>", "Description")
    .option("-l, --list <list-id>", "Move to list")
    .option("-p, --position <n>", "Position")
    .option("--due <date>", "Due date (ISO) or empty string to clear")
    .option("--completed", "Mark completed")
    .option("--no-completed", "Mark not completed")
    .option("--json", "Output JSON")
    .action(cardUpdate);

  card
    .command("delete <board-id> <card-id>")
    .alias("rm")
    .description("Soft-delete a card")
    .option("--json", "Output JSON")
    .action(cardDelete);
}
