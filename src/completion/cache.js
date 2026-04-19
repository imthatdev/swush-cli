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

const CACHE_VERSION = 1;

function readCache(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readDebouncedSuggestions(
  queryKey,
  debounceMs,
  paths = getPaths(),
) {
  const resolved = ensureCliDirectories(paths);
  const cache = readCache(resolved.completionCacheFile);
  if (!cache) return null;
  if (cache.queryKey !== queryKey) return null;
  if (!Array.isArray(cache.suggestions)) return null;

  const age = Date.now() - Number(cache.ts || 0);
  if (!Number.isFinite(age) || age < 0 || age > debounceMs) return null;
  return cache.suggestions;
}

export function writeDebouncedSuggestions(
  queryKey,
  suggestions,
  paths = getPaths(),
) {
  const resolved = ensureCliDirectories(paths);
  const payload = {
    version: CACHE_VERSION,
    queryKey,
    ts: Date.now(),
    suggestions: Array.isArray(suggestions) ? suggestions : [],
  };

  fs.writeFileSync(resolved.completionCacheFile, JSON.stringify(payload), {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(resolved.completionCacheFile, 0o600);
  } catch {
    // Ignore permission errors on unsupported systems.
  }
}
