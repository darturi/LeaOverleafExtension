import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setupMinimalLeanWorkspace } from "./server.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(PROJECT_ROOT, ".overleaf-lean-stub");
const SETTINGS_PATH = path.join(APP_DIR, "settings.json");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const LEA_REPO_URL = "https://github.com/chinmayhegde/lea-prover.git";
const LEA_REPO_PATH = path.join(PROJECT_ROOT, "vendor", "lea-prover");
const DEFAULTS = {
  OPENAI_API_KEY: "your_openai_key_here",
  LEA_REPO_PATH,
  LEAN_WORKSPACE_PATH: PROJECT_ROOT,
  LEA_PROVIDER: "openai",
  LEA_MODEL: "o4-mini",
  LEA_MAX_TURNS: "20"
};

await main();

async function main() {
  console.log("Overleaf Lea Formalizer setup\n");

  await ensureWorkspace();
  await ensureLeaRepo();
  await syncLeaEnvironment();
  await fetchMathlib();
  await writeLocalEnv();
  await writeLocalSettings();

  console.log("\nSetup complete.");
  console.log("Next steps:");
  console.log("1. Put your API key in .env as OPENAI_API_KEY=...");
  console.log("2. Run `npm run doctor`.");
  console.log("3. Run `npm start`.");
  console.log("4. Load the extension/ folder in Chrome.");
}

async function ensureWorkspace() {
  console.log("Ensuring Lean workspace...");
  await setupMinimalLeanWorkspace(PROJECT_ROOT);
}

async function ensureLeaRepo() {
  await fs.mkdir(path.dirname(LEA_REPO_PATH), { recursive: true });

  if (existsSync(path.join(LEA_REPO_PATH, ".git"))) {
    console.log("Updating Lea checkout...");
    await run("git", ["pull", "--ff-only"], { cwd: LEA_REPO_PATH });
    return;
  }

  if (existsSync(LEA_REPO_PATH)) {
    throw new Error(`${LEA_REPO_PATH} exists but is not a git checkout. Move it aside and rerun setup.`);
  }

  console.log("Cloning Lea into vendor/lea-prover...");
  await run("git", ["clone", LEA_REPO_URL, LEA_REPO_PATH], { cwd: PROJECT_ROOT });
}

async function syncLeaEnvironment() {
  console.log("Installing Lea Python dependencies with uv...");
  await run("uv", ["sync"], { cwd: LEA_REPO_PATH });
}

async function fetchMathlib() {
  console.log("Fetching Mathlib dependencies...");
  await run("lake", ["update"], { cwd: PROJECT_ROOT });
  console.log("Fetching Mathlib compiled cache...");
  await run("lake", ["exe", "cache", "get"], { cwd: PROJECT_ROOT });
}

async function writeLocalEnv() {
  const existing = await readEnvFile(ENV_PATH);
  const merged = { ...DEFAULTS, ...existing };
  merged.LEA_REPO_PATH = LEA_REPO_PATH;
  merged.LEAN_WORKSPACE_PATH = PROJECT_ROOT;
  merged.LEA_PROVIDER = merged.LEA_PROVIDER || DEFAULTS.LEA_PROVIDER;
  merged.LEA_MODEL = merged.LEA_MODEL || DEFAULTS.LEA_MODEL;
  merged.LEA_MAX_TURNS = merged.LEA_MAX_TURNS || DEFAULTS.LEA_MAX_TURNS;

  await fs.writeFile(ENV_PATH, formatEnv(merged), "utf8");
  console.log("Wrote .env path defaults.");
}

async function writeLocalSettings() {
  const settings = await readJson(SETTINGS_PATH, {});
  const next = {
    ...settings,
    workspacePath: PROJECT_ROOT,
    leaRepoPath: LEA_REPO_PATH,
    leaProvider: settings.leaProvider || DEFAULTS.LEA_PROVIDER,
    leaModel: settings.leaModel || DEFAULTS.LEA_MODEL,
    leaMaxTurns: settings.leaMaxTurns || Number(DEFAULTS.LEA_MAX_TURNS)
  };

  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log("Wrote companion settings.");
}

function run(command, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const values = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals === -1) continue;
      const key = trimmed.slice(0, equals).trim();
      const value = trimmed.slice(equals + 1).trim();
      if (key) values[key] = value;
    }
    return values;
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    throw error;
  }
}

function formatEnv(values) {
  const lines = [
    ["OPENAI_API_KEY", values.OPENAI_API_KEY || DEFAULTS.OPENAI_API_KEY],
    ["LEA_REPO_PATH", values.LEA_REPO_PATH],
    ["LEAN_WORKSPACE_PATH", values.LEAN_WORKSPACE_PATH],
    ["LEA_PROVIDER", values.LEA_PROVIDER],
    ["LEA_MODEL", values.LEA_MODEL],
    ["LEA_MAX_TURNS", values.LEA_MAX_TURNS]
  ];
  return `${lines.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}
