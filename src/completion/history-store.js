/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import fs from "node:fs";

import { ensureCliDirectories, getPaths } from "../config/paths.js";
import { sanitizeForLog } from "../security/sanitize.js";

const HISTORY_VERSION = 1;

function defaultHistory() {
  return {
    version: HISTORY_VERSION,
    entries: [],
  };
}

export function loadHistory(paths = getPaths()) {
  const resolvedPaths = ensureCliDirectories(paths);
  try {
    const text = fs.readFileSync(resolvedPaths.historyFile, "utf8");
    const parsed = JSON.parse(text);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.entries)
    ) {
      return defaultHistory();
    }
    return parsed;
  } catch {
    return defaultHistory();
  }
}

function saveHistory(history, paths = getPaths()) {
  const resolvedPaths = ensureCliDirectories(paths);
  fs.writeFileSync(
    resolvedPaths.historyFile,
    JSON.stringify(history, null, 2),
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
  try {
    fs.chmodSync(resolvedPaths.historyFile, 0o600);
  } catch {
    // Ignore permission errors on unsupported systems.
  }
}

function sanitizeArgs(args) {
  return args
    .map((arg) => sanitizeForLog(arg, 240))
    .filter(Boolean)
    .map((arg) => arg.replace(/--api-key\s+\S+/gi, "--api-key [REDACTED]"));
}

function pushCapped(entries, item, maxEntries) {
  entries.push(item);
  if (entries.length > maxEntries) {
    entries.splice(0, entries.length - maxEntries);
  }
}

export function recordHistoryEntry(event, options = {}) {
  const paths = options.paths || getPaths();
  const maxEntries = Number.isFinite(options.maxEntries)
    ? options.maxEntries
    : 200;
  const history = loadHistory(paths);

  const item = {
    ts: new Date().toISOString(),
    command: sanitizeForLog(event.command || "unknown", 120),
    args: sanitizeArgs(Array.isArray(event.args) ? event.args : []),
    status: sanitizeForLog(event.status || "unknown", 32),
    metadata: {
      url: sanitizeForLog(event.metadata?.url || "", 220) || null,
      domain: sanitizeForLog(event.metadata?.domain || "", 120) || null,
      file: sanitizeForLog(event.metadata?.file || "", 260) || null,
    },
  };

  pushCapped(history.entries, item, maxEntries);
  saveHistory(history, paths);
}

function sortedKeys(mapLike, limit = 20) {
  return [...mapLike.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

export function getHistoryInsights(paths = getPaths()) {
  const history = loadHistory(paths);
  const commandFreq = new Map();
  const domainFreq = new Map();
  const fileFreq = new Map();
  const urlFreq = new Map();

  for (const entry of history.entries) {
    if (entry.command) {
      commandFreq.set(entry.command, (commandFreq.get(entry.command) || 0) + 1);
    }

    const meta = entry.metadata || {};
    if (meta.domain) {
      domainFreq.set(meta.domain, (domainFreq.get(meta.domain) || 0) + 1);
    }
    if (meta.file) {
      fileFreq.set(meta.file, (fileFreq.get(meta.file) || 0) + 1);
    }
    if (meta.url) {
      urlFreq.set(meta.url, (urlFreq.get(meta.url) || 0) + 1);
    }
  }

  const recent = [...history.entries].reverse();

  return {
    frequentCommands: sortedKeys(commandFreq, 20),
    frequentDomains: sortedKeys(domainFreq, 20),
    frequentFiles: sortedKeys(fileFreq, 40),
    frequentUrls: sortedKeys(urlFreq, 40),
    recentEntries: recent.slice(0, 80),
  };
}
