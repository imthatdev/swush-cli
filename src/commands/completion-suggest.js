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

import {
  readDebouncedSuggestions,
  writeDebouncedSuggestions,
} from "../completion/cache.js";
import { suggestCompletions } from "../completion/suggest.js";

export async function runCommand({ flags, output, sessionManager }) {
  const config = sessionManager.loadConfig();
  const debounceMs = Number(config?.completion?.debounceMs || 400);
  const line = flags.line || "";
  const cursor = flags.cursor || "";
  const queryKey = `${flags.shell || ""}:${line}:${cursor}`;

  const cached = readDebouncedSuggestions(
    queryKey,
    debounceMs,
    sessionManager.paths,
  );
  if (cached) {
    for (const value of cached) output.log(value);
    return { history: null };
  }

  const suggestions = suggestCompletions(line, {
    shell: flags.shell || null,
    cursor,
    paths: sessionManager.paths,
  });

  writeDebouncedSuggestions(queryKey, suggestions, sessionManager.paths);

  for (const suggestion of suggestions) {
    output.log(suggestion);
  }

  return { history: null };
}
