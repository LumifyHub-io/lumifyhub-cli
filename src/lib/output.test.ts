import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonObjectFlag, parsePropFlags } from "./output.ts";

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
