import assert from "node:assert/strict";
import test from "node:test";
import { isValidLeanIdentifier, parseTheorems } from "../shared/theoremParser.mjs";

test("detects a labeled theorem", () => {
  const [theorem] = parseTheorems("\\theorem{A}\\label{foo}");
  assert.equal(theorem.label, "foo");
  assert.equal(theorem.text, "A");
});

test("keeps legacy optional labels working", () => {
  const [theorem] = parseTheorems("\\theorem[label=foo]{A}");
  assert.equal(theorem.label, "foo");
  assert.equal(theorem.text, "A");
});

test("handles multiline theorem bodies", () => {
  const [theorem] = parseTheorems("\\theorem{\nA\nB\n}\\label{foo}");
  assert.equal(theorem.text, "A\nB");
});

test("handles nested braces", () => {
  const [theorem] = parseTheorems("\\theorem{A_{n} and {nested {text}}}\\label{foo}");
  assert.equal(theorem.text, "A_{n} and {nested {text}}");
});

test("ignores unlabeled theorems", () => {
  assert.deepEqual(parseTheorems("\\theorem{A}"), []);
});

test("ignores malformed theorem blocks", () => {
  assert.deepEqual(parseTheorems("\\theorem[label=foo]{A"), []);
});

test("validates Lean identifiers", () => {
  assert.equal(isValidLeanIdentifier("main_theorem"), true);
  assert.equal(isValidLeanIdentifier("Theorem1"), true);
  assert.equal(isValidLeanIdentifier("main theorem"), false);
  assert.equal(isValidLeanIdentifier("main-theorem"), false);
  assert.equal(isValidLeanIdentifier("1theorem"), false);
});
