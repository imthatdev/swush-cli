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

import { resolveCommand, visibleCommands } from "../core/command-registry.js";

function renderCommandLine(command) {
  return command.path.join(" ");
}

export async function runCommand({ output, positionals }) {
  const queryTokens = positionals || [];

  if (queryTokens.length > 0) {
    const resolved = resolveCommand(queryTokens);
    if (resolved) {
      const command = resolved.command;
      output.log(renderCommandLine(command));
      output.log(`  ${command.description}`);
      output.log(`  Usage: ${command.usage}`);
      if (command.flags?.length) {
        output.log("  Flags:");
        for (const flag of command.flags) {
          const short = flag.short ? `-${flag.short}, ` : "";
          const type = flag.type === "boolean" ? "" : ` <${flag.type}>`;
          output.log(
            `    ${short}--${flag.long}${type}  ${flag.description || ""}`,
          );
        }
      }
      return;
    }
  }

  output.log("Swush CLI");
  output.log("Usage: swush <action> <resource> [flags]");
  output.log("Alias: swu");
  output.log("");

  for (const command of visibleCommands()) {
    output.log(
      `${renderCommandLine(command)}\n  ${command.description}\n  ${command.usage}`,
    );
    output.log("");
  }

  output.log("Global flags:");
  output.log("  --help, -h      Show help");
  output.log("  --version, -v   Show CLI version");
  output.log("  --no-color      Disable colored output");
  output.log("  --json          Output machine-readable JSON when supported");
}
