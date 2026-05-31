import path from "node:path";
import { hashTheoremText, isValidLeanIdentifier, normalizeTheoremText } from "./theoremParser.mjs";

export const GENERATOR_VERSION = "lean-stub-v1";
export const GENERATED_DIR = path.join("Formalization", "Generated");
export const OVERLEAF_DIR = path.join("Formalization", "Overleaf");

export function buildRelativeLeanPath(theoremLabel) {
  if (!isValidLeanIdentifier(theoremLabel)) {
    throw new Error("Theorem label must be a valid Lean identifier.");
  }
  return path.join(GENERATED_DIR, `${theoremLabel}.lean`);
}

export function slugProjectId(overleafProjectId) {
  const slug = String(overleafProjectId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return slug || "unknown";
}

export function buildProjectRelativeLeanPath({ overleafProjectId, theoremLabel }) {
  if (!isValidLeanIdentifier(theoremLabel)) {
    throw new Error("Theorem label must be a valid Lean identifier.");
  }
  return path.join(OVERLEAF_DIR, slugProjectId(overleafProjectId), `${theoremLabel}.lean`);
}

export function buildLeanStub({ theoremLabel, theoremText }) {
  if (!isValidLeanIdentifier(theoremLabel)) {
    throw new Error("Theorem label must be a valid Lean identifier.");
  }

  return `/-!
Generated from Overleaf.

Label: ${theoremLabel}

Original theorem:

${String(theoremText).trim()}
-/

theorem ${theoremLabel} : True := by
  sorry
`;
}

export function buildCacheKey({ workspacePath, theoremLabel, theoremText }) {
  return [
    path.resolve(workspacePath),
    theoremLabel,
    hashTheoremText(theoremText),
    GENERATOR_VERSION
  ].join("|");
}

export function buildGeneratedMetadata({ theoremLabel, theoremText }) {
  return {
    theoremLabel,
    declarationName: theoremLabel,
    normalizedTheorem: normalizeTheoremText(theoremText),
    theoremHash: hashTheoremText(theoremText),
    generatorVersion: GENERATOR_VERSION
  };
}
