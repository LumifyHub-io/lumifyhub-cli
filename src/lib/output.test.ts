import { test } from "node:test";
import assert from "node:assert/strict";
import { cellToString, parseJsonObjectFlag, parsePropFlags } from "./output.ts";

test("parseJsonObjectFlag parses objects", () => {
  assert.deepEqual(parseJsonObjectFlag("--config", '{"format":"currency","decimalPlaces":2}'), {
    format: "currency",
    decimalPlaces: 2,
  });
});

test("parseJsonObjectFlag rejects invalid JSON and non-objects", () => {
  assert.throws(() => parseJsonObjectFlag("--config", "{nope"), /Invalid JSON for --config/);
  assert.throws(() => parseJsonObjectFlag("--settings", "[1]"), /--settings must be a JSON object/);
  assert.throws(() => parseJsonObjectFlag("--settings", "null"), /must be a JSON object/);
});

test("parsePropFlags keeps names as typed", () => {
  assert.deepEqual(parsePropFlags(["Due Date=2026-01-01", "Status=In Progress"]), {
    "Due Date": "2026-01-01",
    Status: "In Progress",
  });
});

test("cellToString handles strings and numbers", () => {
  assert.equal(cellToString("Done"), "Done");
  assert.equal(cellToString(""), "");
  assert.equal(cellToString(42), "42");
  assert.equal(cellToString(3.5), "3.5");
  assert.equal(cellToString(0), "0");
});

test("cellToString handles booleans", () => {
  assert.equal(cellToString(true), "true");
  assert.equal(cellToString(false), "false");
});

test("cellToString renders null/undefined as empty", () => {
  assert.equal(cellToString(null), "");
  assert.equal(cellToString(undefined), "");
});

test("cellToString comma-joins arrays and JSON-encodes objects", () => {
  assert.equal(cellToString(["a", "b"]), "a,b");
  assert.equal(cellToString([1, true, null]), "1,true,");
  assert.equal(cellToString([]), "");
  assert.equal(cellToString({ a: 1 }), '{"a":1}');
  assert.equal(cellToString([{ id: "x" }]), '[{"id":"x"}]');
  assert.notEqual(cellToString({ a: 1 }), "[object Object]");
});
