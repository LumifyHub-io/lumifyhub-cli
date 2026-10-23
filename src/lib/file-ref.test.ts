import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFileRef, safeFilename } from "./file-ref.ts";

const ID = "12bf480b-2abe-45da-9b0a-f53b8508617a";

test("parseFileRef accepts a bare id", () => {
  assert.equal(parseFileRef(ID), ID);
  assert.equal(parseFileRef(ID.toUpperCase()), ID);
});

test("parseFileRef accepts the card-description path and full URLs", () => {
  assert.equal(parseFileRef(`/api/files/${ID}/raw`), ID);
  assert.equal(parseFileRef(`https://lumifyhub.io/api/files/${ID}/raw`), ID);
  assert.equal(parseFileRef(`https://www.lumifyhub.io/api/cli/files/${ID}?x=1`), ID);
  assert.equal(parseFileRef(`/files/${ID}`), ID);
});

test("parseFileRef rejects anything else", () => {
  assert.throws(() => parseFileRef("nope"));
  assert.throws(() => parseFileRef("/api/pages/abc"));
});

test("safeFilename never leaves the cwd", () => {
  assert.equal(safeFilename("../../etc/passwd", "f"), "passwd");
  assert.equal(safeFilename("..\\..\\win.ini", "f"), "win.ini");
  assert.equal(safeFilename("/abs/shot.png", "f"), "shot.png");
  assert.equal(safeFilename("..", "fallback"), "fallback");
  assert.equal(safeFilename("", "fallback"), "fallback");
  assert.equal(safeFilename(null, "fallback"), "fallback");
  assert.equal(safeFilename("a\x00b.png", "f"), "a_b.png");
  assert.equal(safeFilename("Screen Shot.png", "f"), "Screen Shot.png");
});
