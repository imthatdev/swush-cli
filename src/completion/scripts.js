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

function resolveBinExpression() {
  return "$(command -v swush 2>/dev/null || command -v swu 2>/dev/null)";
}

function zshScript() {
  const binExpr = resolveBinExpression();
  return `# swush completion (zsh)
# shellcheck shell=zsh

_swush_completion() {
  local bin=${binExpr}
  [[ -z "$bin" ]] && return 1

  local line="\${words[*]}"
  local -a suggestions
  suggestions=("\${(@f)\$($bin completion suggest --shell zsh --line "$line")}")
  _describe 'swush' suggestions
}

compdef _swush_completion swush swu
`;
}

function bashScript() {
  const binExpr = resolveBinExpression();
  return `# swush completion (bash)

_swush_completion() {
  local bin=${binExpr}
  [[ -z "$bin" ]] && return 1

  local line="\${COMP_LINE}"
  local IFS=$'\n'
  COMPREPLY=( $("$bin" completion suggest --shell bash --line "$line") )
}

complete -F _swush_completion swush
complete -F _swush_completion swu
`;
}

function fishScript() {
  const binExpr = "(command -s swush; or command -s swu)";
  return `# swush completion (fish)

function __swush_completion
  set -l bin ${binExpr}
  if test -z "$bin"
    return 1
  end

  set -l line (commandline -cp)
  $bin completion suggest --shell fish --line "$line"
end

complete -c swush -f -a '(__swush_completion)'
complete -c swu -f -a '(__swush_completion)'
`;
}

export function generateCompletionScript(shell) {
  const normalized = String(shell || "").toLowerCase();
  if (normalized === "zsh") return zshScript();
  if (normalized === "bash") return bashScript();
  if (normalized === "fish") return fishScript();

  throw new SwushCliError(`Unsupported shell: ${shell}`, {
    code: "SWUSH_UNSUPPORTED_SHELL",
    hint: "Supported shells: zsh, bash, fish.",
  });
}
