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
import { generateCompletionScript } from "../completion/scripts.js";

export async function runCommand({ flags, output }) {
  const shell = flags.shell;
  if (!shell) {
    throw new SwushCliError("Missing --shell for completion script output.", {
      code: "SWUSH_SHELL_REQUIRED",
      hint: "Use: swush completion script --shell zsh|bash|fish",
    });
  }

  output.log(generateCompletionScript(shell));
  return { history: null };
}
