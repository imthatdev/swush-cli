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
import os from "node:os";
import path from "node:path";

import { SwushCliError } from "../core/errors.js";
import { ensureCliDirectories, getPaths } from "../config/paths.js";
import { generateCompletionScript } from "./scripts.js";

function detectShell(explicitShell) {
  if (explicitShell) return explicitShell.toLowerCase();

  const shell = process.env.SHELL || "";
  const basename = path.basename(shell).toLowerCase();
  if (["zsh", "bash", "fish"].includes(basename)) return basename;
  return "zsh";
}

function appendIfMissing(filePath, line) {
  let current = "";
  try {
    current = fs.readFileSync(filePath, "utf8");
  } catch {
    current = "";
  }

  if (current.includes(line)) return false;

  const next = current.trimEnd();
  const suffix = next ? `\n\n${line}\n` : `${line}\n`;
  fs.writeFileSync(filePath, `${next}${suffix}`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return true;
}

function ensureParentDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function installCompletion(shellInput, output, options = {}) {
  const shell = detectShell(shellInput);
  const paths = ensureCliDirectories(options.paths || getPaths());
  const script = generateCompletionScript(shell);

  if (shell === "zsh") {
    fs.writeFileSync(paths.zshCompletionFile, script, {
      encoding: "utf8",
      mode: 0o600,
    });
    const rcFile = path.join(os.homedir(), ".zshrc");
    const sourceLine = `source ${paths.zshCompletionFile}`;
    appendIfMissing(rcFile, sourceLine);

    output.success(`Installed zsh completion at ${paths.zshCompletionFile}`);
    output.dim(`Reload your shell or run: source ${rcFile}`);
    return;
  }

  if (shell === "bash") {
    fs.writeFileSync(paths.bashCompletionFile, script, {
      encoding: "utf8",
      mode: 0o600,
    });

    const home = os.homedir();
    const rcCandidates = [
      path.join(home, ".bashrc"),
      path.join(home, ".bash_profile"),
    ];
    const rcFile =
      rcCandidates.find((candidate) => fs.existsSync(candidate)) ||
      rcCandidates[0];
    const sourceLine = `source ${paths.bashCompletionFile}`;
    appendIfMissing(rcFile, sourceLine);

    output.success(`Installed bash completion at ${paths.bashCompletionFile}`);
    output.dim(`Reload your shell or run: source ${rcFile}`);
    return;
  }

  if (shell === "fish") {
    const fishDir = path.join(os.homedir(), ".config", "fish", "completions");
    const fishCompletion = path.join(fishDir, "swush.fish");
    ensureParentDirectory(fishCompletion);
    fs.writeFileSync(fishCompletion, script, { encoding: "utf8", mode: 0o600 });

    output.success(`Installed fish completion at ${fishCompletion}`);
    output.dim("Open a new fish session to load the completion.");
    return;
  }

  throw new SwushCliError(`Unsupported shell: ${shell}`, {
    code: "SWUSH_UNSUPPORTED_SHELL",
  });
}
