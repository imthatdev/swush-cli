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

import { SwushCliError } from "../core/errors.js";

const GLOBAL_FLAG_ALIASES = new Map([
  ["--no-color", { key: "noColor", type: "boolean" }],
  ["--json", { key: "json", type: "boolean" }],
  ["--help", { key: "help", type: "boolean" }],
  ["-h", { key: "help", type: "boolean" }],
  ["--version", { key: "version", type: "boolean" }],
  ["-v", { key: "version", type: "boolean" }],
]);

export function parseLeadingGlobalFlags(argv) {
  const flags = {
    noColor: false,
    help: false,
    version: false,
    json: false,
  };

  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    const match = GLOBAL_FLAG_ALIASES.get(token);
    if (!match) break;
    flags[match.key] = true;
    index += 1;
  }

  return {
    flags,
    remainder: argv.slice(index),
  };
}

export function parseCommandFlags(argv, specs = []) {
  const flags = {};
  const positionals = [];

  const byLong = new Map();
  const byShort = new Map();

  for (const spec of specs) {
    byLong.set(spec.long, spec);
    if (spec.short) byShort.set(spec.short, spec);
    if (spec.default !== undefined) flags[spec.key] = spec.default;
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (token.startsWith("--")) {
      const [name, inlineValue] = splitInlineValue(token.slice(2));
      const spec = byLong.get(name);
      if (!spec) {
        throw new SwushCliError(`Unknown flag: --${name}`, {
          code: "SWUSH_UNKNOWN_FLAG",
          hint: "Run `swush help` to see available flags.",
        });
      }

      if (spec.type === "boolean") {
        flags[spec.key] = inlineValue ? parseBoolean(inlineValue) : true;
        continue;
      }

      const value =
        inlineValue !== null
          ? inlineValue
          : argv[i + 1] && !argv[i + 1].startsWith("-")
            ? argv[++i]
            : null;
      if (value === null || value === undefined || value === "") {
        throw new SwushCliError(`Missing value for --${name}`, {
          code: "SWUSH_FLAG_VALUE_REQUIRED",
        });
      }
      flags[spec.key] = value;
      continue;
    }

    if (token.startsWith("-") && token !== "-") {
      const shortName = token.slice(1);
      if (shortName.length !== 1) {
        throw new SwushCliError(`Unknown short flag format: ${token}`, {
          code: "SWUSH_UNKNOWN_FLAG",
        });
      }

      const spec = byShort.get(shortName);
      if (!spec) {
        throw new SwushCliError(`Unknown flag: -${shortName}`, {
          code: "SWUSH_UNKNOWN_FLAG",
          hint: "Run `swush help` to see available flags.",
        });
      }

      if (spec.type === "boolean") {
        flags[spec.key] = true;
        continue;
      }

      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new SwushCliError(`Missing value for -${shortName}`, {
          code: "SWUSH_FLAG_VALUE_REQUIRED",
        });
      }

      flags[spec.key] = value;
      i += 1;
      continue;
    }

    positionals.push(token);
  }

  return { flags, positionals };
}

function splitInlineValue(value) {
  const index = value.indexOf("=");
  if (index === -1) return [value, null];
  return [value.slice(0, index), value.slice(index + 1)];
}

function parseBoolean(value) {
  const lowered = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(lowered)) return true;
  if (["0", "false", "no", "off"].includes(lowered)) return false;
  throw new SwushCliError(`Invalid boolean value: ${value}`, {
    code: "SWUSH_INVALID_BOOLEAN",
  });
}
