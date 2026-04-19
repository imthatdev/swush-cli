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
import { fileURLToPath } from "node:url";

import { createSessionManager } from "./auth/session-manager.js";
import { recordHistoryEntry } from "./completion/history-store.js";
import { COMMANDS, resolveCommand } from "./core/command-registry.js";
import { executeResolvedCommand } from "./core/command-runner.js";
import { SwushCliError } from "./core/errors.js";
import { createOutput } from "./core/output.js";
import { writeAuditLog } from "./core/audit.js";
import { parseCommandFlags, parseLeadingGlobalFlags } from "./utils/args.js";

const COMMON_RUNTIME_FLAGS = [
  { key: "help", long: "help", short: "h", type: "boolean", default: false },
  { key: "noColor", long: "no-color", type: "boolean", default: false },
  { key: "json", long: "json", type: "boolean", default: false },
  { key: "revalidate", long: "revalidate", type: "boolean", default: false },
];

function loadPackageVersion() {
  const currentFile = fileURLToPath(import.meta.url);
  const packageJson = path.join(
    path.dirname(currentFile),
    "..",
    "package.json",
  );
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8"));
    return parsed.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function mergeGlobalFlags(leading, parsed) {
  return {
    noColor: leading.noColor || Boolean(parsed.noColor),
    json: leading.json || Boolean(parsed.json),
    help: leading.help || Boolean(parsed.help),
    version: leading.version,
  };
}

async function runHelpCommand(output, queryTokens) {
  const module = await import("./commands/help.js");
  await module.runCommand({ output, positionals: queryTokens || [] });
}

function buildAuditCommandLabel(command, parsed) {
  const args = parsed.positionals || [];
  const suffix = args.length ? ` ${args.join(" ")}` : "";
  return `${command.path.join(" ")}${suffix}`.trim();
}

export async function runCli(argv = process.argv.slice(2)) {
  const startedAt = Date.now();
  const leading = parseLeadingGlobalFlags(argv);

  let resolved = null;
  let parsed = null;
  let globalFlags = {
    noColor: leading.flags.noColor,
    help: leading.flags.help,
    json: leading.flags.json,
    version: leading.flags.version,
  };

  try {
    if (leading.remainder.length > 0) {
      resolved = resolveCommand(leading.remainder);
      if (resolved) {
        const commandArgs = leading.remainder.slice(resolved.consumed);
        parsed = parseCommandFlags(commandArgs, [
          ...(resolved.command.flags || []),
          ...COMMON_RUNTIME_FLAGS,
        ]);
        globalFlags = mergeGlobalFlags(leading.flags, parsed.flags || {});
      }
    }
  } catch (error) {
    const output = createOutput({ noColor: globalFlags.noColor });
    return handleFailure(error, output, null, startedAt);
  }

  const output = createOutput({ noColor: globalFlags.noColor });
  let sessionManager = null;

  try {
    if (globalFlags.version && !resolved) {
      output.log(`swush v${loadPackageVersion()}`);
      return 0;
    }

    if (!resolved) {
      if (globalFlags.help || leading.remainder.length === 0) {
        await runHelpCommand(output, []);
        return 0;
      }

      throw new SwushCliError(
        `Unknown command: ${leading.remainder.join(" ")}`,
        {
          code: "SWUSH_UNKNOWN_COMMAND",
          hint: "Run `swush help` to list commands.",
        },
      );
    }

    if (globalFlags.help) {
      await runHelpCommand(output, resolved.command.path);
      return 0;
    }

    sessionManager = createSessionManager({ output });

    const result = await executeResolvedCommand({
      resolved,
      parsed,
      globalFlags,
      sessionManager,
      output,
    });

    if (result?.history) {
      recordHistoryEntry(
        {
          ...result.history,
          status: "success",
        },
        {
          paths: sessionManager.paths,
          maxEntries: sessionManager.loadConfig().history.maxEntries,
        },
      );
    }

    writeAuditLog(
      {
        command: buildAuditCommandLabel(resolved.command, parsed),
        status: "ok",
        durationMs: Date.now() - startedAt,
        host: sessionManager.resolveBaseUrl(sessionManager.loadConfig()),
      },
      sessionManager.paths,
    );

    return 0;
  } catch (error) {
    return handleFailure(
      error,
      output,
      resolved?.command || null,
      startedAt,
      sessionManager,
    );
  }
}

function handleFailure(
  error,
  output,
  command,
  startedAt,
  sessionManager = null,
) {
  const exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;

  output.error(error?.message || "Unexpected error.");
  if (error?.hint) output.dim(`Hint: ${error.hint}`);
  if (error?.details && process.env.SWUSH_DEBUG === "1") {
    output.dim(`Details: ${String(error.details)}`);
  }

  if (sessionManager) {
    writeAuditLog(
      {
        command: command?.path?.join(" ") || "unknown",
        status: "error",
        durationMs: Date.now() - startedAt,
        host: (() => {
          try {
            return sessionManager.resolveBaseUrl(sessionManager.loadConfig());
          } catch {
            return null;
          }
        })(),
        code: error?.code || "SWUSH_UNKNOWN_ERROR",
      },
      sessionManager.paths,
    );

    if (command) {
      recordHistoryEntry(
        {
          command: command.path.join(" "),
          args: [],
          status: "error",
          metadata: {
            url: null,
            domain: null,
            file: null,
          },
        },
        {
          paths: sessionManager.paths,
          maxEntries: sessionManager.loadConfig().history.maxEntries,
        },
      );
    }
  }

  return exitCode;
}
