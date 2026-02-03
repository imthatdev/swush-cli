#!/usr/bin/env node
/*
 * Swush CLI
 *
 * Quick start:
 *   swush login -u https://your.domain -a API_TOKEN
 *   swush upload -p /path/to/file
 *   swush list
 *
 * Commands:
 *   help           Show command list
 *   login          Save API token + URL locally
 *   status         Show saved config status
 *   logout         Clear saved config
 *   upload         Upload a file
 *   shorten        Create a short link
 *   list           List uploads
 *
 * Flags:
 *   -a, --api-key  API token (required for login, optional if already logged in)
 *   -u, --url      Base URL (defaults to SWUSH_URL, APP_URL, or http://localhost:3000)
 *   -p, --path     File path (upload)
 *   -t, --target   Target URL (shorten)
 */

// Defaults + config storage
const DEFAULT_URL = "http://localhost:3000";
const argv = process.argv.slice(2);
const CONFIG_DIR = ".swush";
const CONFIG_FILE = "config.json";

// Minimal flag parser (no dependencies)
function parseArgs(args) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === "-a" || current === "--api-key") {
      flags.apiKey = args[i + 1];
      i += 1;
      continue;
    }
    if (current === "-u" || current === "--url") {
      flags.url = args[i + 1];
      i += 1;
      continue;
    }
    if (current === "-p" || current === "--path") {
      flags.path = args[i + 1];
      i += 1;
      continue;
    }
    if (current === "-t" || current === "--target") {
      flags.target = args[i + 1];
      i += 1;
      continue;
    }
    if (current === "-h" || current === "--help") {
      flags.help = true;
      continue;
    }
    if (current === "-v" || current === "--version") {
      flags.version = true;
      continue;
    }
    positional.push(current);
  }

  return { flags, positional };
}

const { flags, positional } = parseArgs(argv);
const [cmd, arg] = positional;

// Load config from ~/.swush/config.json
async function loadConfig() {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const configPath = path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Persist config to ~/.swush/config.json
async function saveConfig(config) {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dirPath = path.join(os.homedir(), CONFIG_DIR);
  const filePath = path.join(dirPath, CONFIG_FILE);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}

// Resolve runtime settings (flags override saved config and env)
const config = await loadConfig();
const baseUrl =
  flags.url ||
  config.url ||
  process.env.SWUSH_URL ||
  process.env.APP_URL ||
  DEFAULT_URL;
const apiKey = flags.apiKey || config.apiKey || "";

const usage =
  "Usage: help | login -u <url> -a <token> | status | logout | upload -p <file> [-a <token>] [-u <url>] | shorten -t <url> [-a <token>] [-u <url>] | list [-a <token>] [-u <url>]";

if (flags.help) {
  console.log(usage);
  process.exit(0);
}

if (flags.version) {
  console.log("swush cli v0.1.0");
  process.exit(0);
}

// Require API token for all commands except login/status/logout/help
if (
  cmd !== "login" &&
  cmd !== "status" &&
  cmd !== "logout" &&
  cmd !== "help" &&
  !apiKey
) {
  console.error("Missing API key (-a/--api-key) or run `swush login`");
  process.exit(1);
}

// Save URL + token for future commands
async function login(url, token) {
  if (!url || !token) {
    console.log(usage);
    process.exit(1);
  }
  await saveConfig({ url, apiKey: token });
  console.log("Saved swush config.");
}

// Remove saved config
async function logout() {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const filePath = path.join(os.homedir(), CONFIG_DIR, CONFIG_FILE);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  console.log("Cleared swush config.");
}

// Show saved config status
function status() {
  const hasConfig = Boolean(config?.url || config?.apiKey);
  if (!hasConfig) {
    console.log("No saved config. Use `swush login`.");
    return;
  }
  console.log(`Saved URL: ${config.url || "(not set)"}`);
  console.log(`Saved API token: ${config.apiKey ? "(set)" : "(not set)"}`);
}

// Upload a file via /api/v1/upload
async function upload(filePath) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }
  const fileStream = fs.createReadStream(filePath);
  const form = new FormData();
  form.append("file", fileStream, path.basename(filePath));

  const res = await fetch(`${baseUrl}/api/v1/upload`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Upload failed", data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

// Create a short link via /api/v1/shorten
async function shorten(url) {
  const res = await fetch(`${baseUrl}/api/v1/shorten`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ originalUrl: url }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Shorten failed", data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

// List uploads via /api/v1/upload
async function listUploads() {
  const res = await fetch(`${baseUrl}/api/v1/upload`, {
    headers: { "x-api-key": apiKey },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("List failed", data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

// Command routing
if (!cmd) {
  console.log(usage);
  process.exit(0);
}

if (cmd === "help") {
  console.log(usage);
} else if (cmd === "login") {
  const url = flags.url || arg;
  const token = flags.apiKey;
  await login(url, token);
} else if (cmd === "logout") {
  await logout();
} else if (cmd === "status") {
  status();
} else if (cmd === "upload") {
  const filePath = flags.path || arg;
  if (!filePath) {
    console.log(usage);
    process.exit(1);
  }
  await upload(filePath);
} else if (cmd === "shorten") {
  const target = flags.target || arg;
  if (!target) {
    console.log(usage);
    process.exit(1);
  }
  await shorten(target);
} else if (cmd === "list") {
  await listUploads();
} else {
  console.log(usage);
  process.exit(1);
}
