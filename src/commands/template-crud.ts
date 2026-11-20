/**
 * Admin template page fields.
 * Registered as: lh templates <list|get|set>
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { isAuthenticated } from "../lib/config.js";
import { api, type TemplatePublicFields } from "../lib/api.js";
import { printResult, printError } from "../lib/output.js";

const read = (path: string) => (path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8"));

async function templatesList(opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const list = await api.getTemplates();
    printResult(list, (items) => {
      if (items.length === 0) { console.log("No templates."); return; }
      for (const t of items) {
        const slug = t.public_slug ? chalk.green(t.public_slug) : chalk.gray("(not public)");
        console.log(`${chalk.cyan(t.id)} ${chalk.bold(t.name ?? "")} ${slug}`);
      }
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to list templates", opts);
  }
}

async function templatesGet(id: string, opts: { json?: boolean }): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const t = await api.getTemplate(id);
    printResult(t, (x) => {
      console.log(`${chalk.bold(x.name ?? x.id)} ${chalk.gray(x.id)}`);
      console.log(`slug: ${x.public_slug ?? "(not public)"}`);
      console.log(`industries: ${(x.industries ?? []).join(", ") || "-"}`);
      console.log(`description: ${x.description ?? "-"}`);
      console.log(`preview_image_url: ${x.preview_image_url ?? "-"}`);
      console.log(`faq: ${(x.faq ?? []).length} item(s)`);
      console.log(`\n${x.guide ?? "(no guide)"}`);
    }, opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to get template", opts);
  }
}

interface SetOpts {
  guide?: string;
  guideFile?: string;
  faq?: string;
  faqFile?: string;
  industries?: string;
  description?: string;
  previewImageUrl?: string;
  publicSlug?: string;
  json?: boolean;
}

async function templatesSet(id: string, opts: SetOpts): Promise<void> {
  if (!isAuthenticated()) { printError("Not authenticated. Run 'lh login' first.", opts); return; }
  try {
    const payload: Partial<TemplatePublicFields> = {};
    if (opts.guide !== undefined && opts.guideFile) throw new Error("Use --guide or --guide-file, not both");
    if (opts.faq !== undefined && opts.faqFile) throw new Error("Use --faq or --faq-file, not both");
    if (opts.guide !== undefined) payload.guide = opts.guide;
    if (opts.guideFile) payload.guide = read(opts.guideFile);
    const faqRaw = opts.faqFile ? read(opts.faqFile) : opts.faq;
    if (faqRaw !== undefined) {
      let faq: unknown;
      try { faq = JSON.parse(faqRaw); } catch (e) { throw new Error(`Invalid JSON for faq: ${(e as Error).message}`); }
      const ok = Array.isArray(faq) && faq.every((f) => f && typeof f.q === "string" && typeof f.a === "string");
      if (!ok) throw new Error('faq must be a JSON array of {"q": "...", "a": "..."}');
      payload.faq = faq as { q: string; a: string }[];
    }
    if (opts.industries !== undefined) {
      payload.industries = opts.industries.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (opts.description !== undefined) payload.description = opts.description;
    if (opts.previewImageUrl !== undefined) payload.preview_image_url = opts.previewImageUrl || null;
    if (opts.publicSlug !== undefined) payload.public_slug = opts.publicSlug || null;
    if (Object.keys(payload).length === 0) {
      throw new Error("Provide at least one of --guide/--guide-file, --faq/--faq-file, --industries, --description, --preview-image-url, --public-slug");
    }
    const t = await api.updateTemplate(id, payload);
    printResult(t, () => console.log(chalk.green(`Updated template ${id}: ${Object.keys(payload).join(", ")}`)), opts);
  } catch (err) {
    printError(err instanceof Error ? err.message : "Failed to update template", opts);
  }
}

export function registerTemplateCommands(program: Command): void {
  const tpl = program.command("templates").description("Manage public template pages (admin)");

  tpl.command("list").alias("ls").description("List templates")
    .option("--json", "Output JSON").action(templatesList);

  tpl.command("get <id>").description("Show a template's public-page fields")
    .option("--json", "Output JSON").action(templatesGet);

  tpl.command("set <id>")
    .description("Update public-page fields. --public-slug makes the page public (empty string unpublishes)")
    .option("--guide <markdown>", "Guide markdown")
    .option("--guide-file <path>", "Read guide markdown from a file ('-' for stdin)")
    .option("--faq <json>", 'FAQ as JSON array of {"q","a"}')
    .option("--faq-file <path>", "Read FAQ JSON from a file ('-' for stdin)")
    .option("--industries <list>", "Comma-separated industries (e.g. real-estate,insurance); empty clears")
    .option("--description <text>", "Description")
    .option("--preview-image-url <url>", "Preview image URL; empty clears")
    .option("--public-slug <slug>", "Public slug; empty clears")
    .option("--json", "Output JSON")
    .action(templatesSet);
}
