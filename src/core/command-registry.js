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

const SHARED_URL_FLAG = {
  key: "url",
  long: "url",
  short: "u",
  type: "string",
  description: "Swush base URL",
};

export const COMMANDS = [
  {
    id: "help",
    path: ["help"],
    aliases: [],
    description: "Show CLI help",
    usage: "swush help [command]",
    requiresAuth: false,
    flags: [],
    handler: "../commands/help.js",
  },
  {
    id: "auth.login",
    path: ["auth", "login"],
    aliases: [["login"]],
    description: "Authenticate this CLI session",
    usage:
      "swush auth login [--url <url>] [--api-key <token>] [--client-id <id>]",
    requiresAuth: false,
    flags: [
      SHARED_URL_FLAG,
      {
        key: "apiKey",
        long: "api-key",
        short: "a",
        type: "string",
        description: "Manual API key (refresh token)",
      },
      {
        key: "clientId",
        long: "client-id",
        short: "c",
        type: "string",
        description: "Device flow client identifier",
      },
      {
        key: "pollTimeout",
        long: "poll-timeout",
        type: "string",
        description: "Device flow polling timeout in seconds",
      },
      {
        key: "noOpen",
        long: "no-open",
        type: "boolean",
        description: "Do not auto-open browser",
      },
    ],
    handler: "../commands/auth-login.js",
  },
  {
    id: "auth.logout",
    path: ["auth", "logout"],
    aliases: [["logout"]],
    description: "Clear local session state and secure tokens",
    usage: "swush auth logout",
    requiresAuth: false,
    flags: [],
    handler: "../commands/auth-logout.js",
  },
  {
    id: "auth.status",
    path: ["auth", "status"],
    aliases: [["status"]],
    description: "Show local auth/session status",
    usage: "swush auth status",
    requiresAuth: false,
    flags: [],
    handler: "../commands/auth-status.js",
  },
  {
    id: "upload.file",
    path: ["upload", "file"],
    aliases: [["upload"]],
    description: "Upload a file",
    usage: "swush upload file <path> [--private] [--url <url>]",
    requiresAuth: true,
    requiredScopes: ["upload"],
    flags: [
      SHARED_URL_FLAG,
      {
        key: "path",
        long: "path",
        short: "p",
        type: "string",
        description: "File path to upload",
      },
      {
        key: "private",
        long: "private",
        type: "boolean",
        description: "Mark uploaded file as private",
      },
      {
        key: "public",
        long: "public",
        type: "boolean",
        description: "Mark uploaded file as public",
      },
    ],
    handler: "../commands/upload-file.js",
  },
  {
    id: "shorten.link",
    path: ["shorten", "link"],
    aliases: [["shorten"]],
    description: "Create a short link",
    usage:
      "swush shorten link <url> [--private] [--expiry <value>] [--url <url>]",
    requiresAuth: true,
    requiredScopes: ["shorten"],
    flags: [
      SHARED_URL_FLAG,
      {
        key: "target",
        long: "target",
        short: "t",
        type: "string",
        description: "Target URL",
      },
      {
        key: "slug",
        long: "slug",
        type: "string",
        description: "Custom slug",
      },
      {
        key: "private",
        long: "private",
        type: "boolean",
        description: "Create private link",
      },
      {
        key: "expiry",
        long: "expiry",
        type: "string",
        description: "Expiry timestamp (ISO-8601)",
      },
    ],
    handler: "../commands/shorten-link.js",
  },
  {
    id: "bookmark.add",
    path: ["bookmark", "add"],
    aliases: [],
    description: "Add a bookmark",
    usage:
      "swush bookmark add <url> [--title <text>] [--private] [--url <url>]",
    requiresAuth: true,
    requiredScopes: ["bookmarks"],
    flags: [
      SHARED_URL_FLAG,
      {
        key: "target",
        long: "target",
        short: "t",
        type: "string",
        description: "Bookmark URL",
      },
      {
        key: "title",
        long: "title",
        short: "n",
        type: "string",
        description: "Bookmark title",
      },
      {
        key: "private",
        long: "private",
        type: "boolean",
        description: "Create private bookmark",
      },
    ],
    handler: "../commands/bookmark-add.js",
  },
  {
    id: "list.uploads",
    path: ["list", "uploads"],
    aliases: [["list"]],
    description: "List uploads",
    usage: "swush list uploads [--limit <n>] [--offset <n>] [--url <url>]",
    requiresAuth: true,
    requiredScopes: ["upload"],
    flags: [
      SHARED_URL_FLAG,
      {
        key: "limit",
        long: "limit",
        type: "string",
        description: "Maximum number of entries",
      },
      {
        key: "offset",
        long: "offset",
        type: "string",
        description: "Offset for pagination",
      },
    ],
    handler: "../commands/list-uploads.js",
  },
  {
    id: "completion.install",
    path: ["completion", "install"],
    aliases: [],
    description: "Install shell completion",
    usage: "swush completion install [--shell zsh|bash|fish]",
    requiresAuth: false,
    flags: [
      {
        key: "shell",
        long: "shell",
        short: "s",
        type: "string",
        description: "Shell name",
      },
    ],
    handler: "../commands/completion-install.js",
  },
  {
    id: "completion.script",
    path: ["completion", "script"],
    aliases: [],
    description: "Print shell completion script",
    usage: "swush completion script --shell zsh|bash|fish",
    requiresAuth: false,
    flags: [
      {
        key: "shell",
        long: "shell",
        short: "s",
        type: "string",
        description: "Shell name",
      },
    ],
    handler: "../commands/completion-script.js",
  },
  {
    id: "completion.suggest",
    path: ["completion", "suggest"],
    aliases: [],
    description: "Internal completion suggester",
    usage: "swush completion suggest --shell <name> --line <input>",
    requiresAuth: false,
    hidden: true,
    flags: [
      {
        key: "shell",
        long: "shell",
        type: "string",
        description: "Shell name",
      },
      {
        key: "line",
        long: "line",
        type: "string",
        description: "Raw command line",
      },
      {
        key: "cursor",
        long: "cursor",
        type: "string",
        description: "Cursor offset",
      },
    ],
    handler: "../commands/completion-suggest.js",
  },
];

function tokensEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]).toLowerCase() !== String(b[i]).toLowerCase()) return false;
  }
  return true;
}

export function resolveCommand(tokens) {
  const normalized = tokens.map((token) => String(token).toLowerCase());
  const candidates = [];

  for (const command of COMMANDS) {
    const patterns = [command.path, ...(command.aliases || [])];
    for (const pattern of patterns) {
      if (pattern.length === 0) continue;
      if (pattern.length > normalized.length) continue;

      const head = normalized.slice(0, pattern.length);
      if (tokensEqual(head, pattern)) {
        candidates.push({
          command,
          consumed: pattern.length,
          score: pattern.length,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function visibleCommands() {
  return COMMANDS.filter((command) => !command.hidden);
}

export function findCommandById(commandId) {
  return COMMANDS.find((command) => command.id === commandId) || null;
}

export function topLevelTokens() {
  const values = new Set();
  for (const command of visibleCommands()) {
    if (command.path[0]) values.add(command.path[0]);
    for (const alias of command.aliases || []) {
      if (alias[0]) values.add(alias[0]);
    }
  }
  return [...values].sort();
}
