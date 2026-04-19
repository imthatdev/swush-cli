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
import path from "node:path";

import {
  COMMANDS,
  resolveCommand,
  topLevelTokens,
} from "../core/command-registry.js";
import { getHistoryInsights } from "./history-store.js";
import { readClipboardText } from "../utils/clipboard.js";
import { tokenizeCommandLine } from "../utils/tokenize.js";
import { normalizeTargetUrl } from "../security/sanitize.js";

const GLOBAL_FLAGS = [
  "--help",
  "-h",
  "--version",
  "-v",
  "--no-color",
  "--json",
];

function startsWithIgnoreCase(value, prefix) {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function filterByPrefix(values, prefix) {
  if (!prefix) return values;
  return values.filter((value) => startsWithIgnoreCase(value, prefix));
}

function listLocalFiles(prefix, max = 40) {
  const cwd = process.cwd();
  const dir = path.dirname(prefix || "./");
  const base = prefix && prefix !== "." ? path.basename(prefix) : "";

  const absoluteDir = path.resolve(cwd, dir === "." ? "" : dir);
  if (!fs.existsSync(absoluteDir)) return [];

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const suggestions = [];

  for (const entry of entries) {
    if (!startsWithIgnoreCase(entry.name, base)) continue;
    const candidate = dir === "." ? entry.name : path.join(dir, entry.name);
    suggestions.push(entry.isDirectory() ? `${candidate}/` : candidate);
    if (suggestions.length >= max) break;
  }

  return suggestions;
}

function commandPatterns(command) {
  return [command.path, ...(command.aliases || [])];
}

function suggestNextCommandToken(completedTokens, prefix) {
  const suggestions = [];

  for (const command of COMMANDS) {
    for (const pattern of commandPatterns(command)) {
      if (completedTokens.length > pattern.length) continue;

      let matches = true;
      for (let i = 0; i < completedTokens.length; i += 1) {
        if (completedTokens[i].toLowerCase() !== pattern[i].toLowerCase()) {
          matches = false;
          break;
        }
      }

      if (!matches) continue;
      if (pattern.length > completedTokens.length) {
        suggestions.push(pattern[completedTokens.length]);
      }
    }
  }

  return filterByPrefix(unique(suggestions), prefix);
}

function suggestFlags(command, prefix) {
  const values = [...GLOBAL_FLAGS];
  if (!command?.flags?.length) return filterByPrefix(unique(values), prefix);
  for (const flag of command.flags) {
    values.push(`--${flag.long}`);
    if (flag.short) values.push(`-${flag.short}`);
  }
  return filterByPrefix(unique(values), prefix);
}

function suggestFlagValues(flagKey, prefix, history) {
  if (flagKey === "shell") {
    return filterByPrefix(["zsh", "bash", "fish"], prefix);
  }

  if (flagKey === "path") {
    return filterByPrefix(
      unique([...history.frequentFiles, ...listLocalFiles(prefix)]),
      prefix,
    );
  }

  if (["target", "url"].includes(flagKey)) {
    const urls = unique([
      ...history.frequentUrls,
      ...history.frequentDomains.map((d) => `https://${d}`),
    ]);
    return filterByPrefix(urls, prefix);
  }

  return [];
}

function findPendingFlag(command, tokens) {
  if (!command?.flags?.length) return null;

  const byLong = new Map(command.flags.map((flag) => [`--${flag.long}`, flag]));
  const byShort = new Map(
    command.flags
      .filter((flag) => flag.short)
      .map((flag) => [`-${flag.short}`, flag]),
  );

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const long = byLong.get(token);
    const short = byShort.get(token);
    const flag = long || short;
    if (!flag || flag.type === "boolean") continue;

    const next = tokens[i + 1];
    if (!next || next.startsWith("-")) {
      return flag;
    }
    i += 1;
  }

  return null;
}

function contextSuggestions(commandId, prefix, history) {
  if (commandId === "upload.file") {
    return filterByPrefix(
      unique([...history.frequentFiles, ...listLocalFiles(prefix)]),
      prefix,
    );
  }

  if (commandId === "shorten.link") {
    const items = unique([
      ...history.frequentUrls,
      ...history.frequentDomains.map((domain) => `https://${domain}`),
    ]);
    return filterByPrefix(items, prefix);
  }

  if (commandId === "bookmark.add") {
    const clipboard = readClipboardText();
    let clipboardUrl = null;
    if (clipboard) {
      try {
        clipboardUrl = normalizeTargetUrl(clipboard);
      } catch {
        clipboardUrl = null;
      }
    }

    const items = unique([
      clipboardUrl,
      ...history.frequentUrls,
      ...history.frequentDomains.map((domain) => `https://${domain}`),
    ]);

    return filterByPrefix(items, prefix);
  }

  return [];
}

function prioritize(suggestions, history) {
  const frequency = new Map(
    history.frequentCommands.map((value, index) => [
      value,
      history.frequentCommands.length - index,
    ]),
  );

  return [...suggestions].sort((a, b) => {
    const af = frequency.get(a) || 0;
    const bf = frequency.get(b) || 0;
    if (af !== bf) return bf - af;
    return a.localeCompare(b);
  });
}

export function suggestCompletions(line, options = {}) {
  const history = getHistoryInsights(options.paths);
  const { tokens, trailingSpace } = tokenizeCommandLine(line || "");

  const withoutBin =
    tokens[0] === "swush" || tokens[0] === "swu" ? tokens.slice(1) : tokens;

  const completedTokens = [...withoutBin];
  let currentPrefix = "";

  if (!trailingSpace && completedTokens.length > 0) {
    currentPrefix = completedTokens.pop();
  }

  if (completedTokens.length === 0 && !currentPrefix) {
    return topLevelTokens();
  }

  if (completedTokens.length === 0 && currentPrefix.startsWith("-")) {
    return filterByPrefix(GLOBAL_FLAGS, currentPrefix);
  }

  const resolved = resolveCommand(completedTokens);
  const resolvedAndComplete =
    resolved && resolved.consumed === completedTokens.length;

  if (!resolvedAndComplete) {
    const nextTokens = suggestNextCommandToken(completedTokens, currentPrefix);
    if (currentPrefix.startsWith("-")) {
      return prioritize(
        unique([...nextTokens, ...filterByPrefix(GLOBAL_FLAGS, currentPrefix)]),
        history,
      );
    }
    return prioritize(nextTokens, history);
  }

  const command = resolved.command;
  const commandArgs = completedTokens.slice(resolved.consumed);

  if (currentPrefix.startsWith("-")) {
    return suggestFlags(command, currentPrefix);
  }

  const pendingFlag = findPendingFlag(command, commandArgs);
  if (pendingFlag) {
    return suggestFlagValues(pendingFlag.key, currentPrefix, history);
  }

  const suggestions = [
    ...contextSuggestions(command.id, currentPrefix, history),
    ...suggestFlags(command, currentPrefix),
  ];

  return unique(suggestions);
}
