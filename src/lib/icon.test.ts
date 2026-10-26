import { test } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import {
  splitEmojiTitle, withIcon, ICON_FLAG, ICON_UPDATE_FLAG, resolveUpdateContent, pageWriteBody,
} from "./icon.ts";

test("splits a leading emoji off the title", () => {
  assert.deepEqual(splitEmojiTitle("🔥 Roadmap  "), { title: "Roadmap", icon: "🔥" });
  assert.deepEqual(splitEmojiTitle("👨‍👩‍👧 Family plans"), { title: "Family plans", icon: "👨‍👩‍👧" });
  assert.deepEqual(splitEmojiTitle("🇺🇸 Taxes"), { title: "Taxes", icon: "🇺🇸" });
});

test("leaves titles alone when it is not emoji + space + text", () => {
  for (const t of ["Roadmap", "🔥", "🔥 ", "🔥Roadmap", "🔥🔥 Two", "Plan 🔥 later", "1 Plan"]) {
    assert.deepEqual(splitEmojiTitle(t), { title: t }, t);
  }
});

test("an explicit icon, even empty, wins", () => {
  assert.deepEqual(splitEmojiTitle("🔥 Roadmap", "📌"), { title: "🔥 Roadmap", icon: "📌" });
  assert.deepEqual(splitEmojiTitle("🔥 Roadmap", ""), { title: "🔥 Roadmap", icon: "" });
});

test("withIcon prefixes only when set", () => {
  assert.equal(withIcon("🔥"), "🔥 ");
  assert.equal(withIcon(""), "");
  assert.equal(withIcon(null), "");
});

test("--icon flag parses, including the empty string", () => {
  const cmd = new Command().exitOverride().option(...ICON_UPDATE_FLAG);
  cmd.parse(["--icon", ""], { from: "user" });
  assert.equal(cmd.opts().icon, "");
  const cmd2 = new Command().exitOverride().option(...ICON_FLAG);
  cmd2.parse(["--icon", "🔥"], { from: "user" });
  assert.equal(cmd2.opts().icon, "🔥");
  const cmd3 = new Command().exitOverride().option(...ICON_FLAG);
  cmd3.parse([], { from: "user" });
  assert.equal(cmd3.opts().icon, undefined);
});

test("an icon-only update keeps the current content", async () => {
  let fetched = 0;
  const current = async () => (fetched++, "existing content");
  assert.equal(await resolveUpdateContent(undefined, current), "existing content");
  assert.equal(await resolveUpdateContent("new", current), "new");
  assert.equal(fetched, 1);
  assert.deepEqual(pageWriteBody(undefined, "🔥"), { icon: "🔥" });
  assert.deepEqual(pageWriteBody("🔥 Plan", undefined), { title: "Plan", icon: "🔥" });
  assert.deepEqual(pageWriteBody("Plan", ""), { title: "Plan", icon: "" });
});
