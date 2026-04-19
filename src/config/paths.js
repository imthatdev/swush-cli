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

export const APP_DIR_NAME = ".swush";

export function getPaths() {
  const home = os.homedir();
  const overriddenRoot = process.env.SWUSH_CONFIG_HOME
    ? path.resolve(process.env.SWUSH_CONFIG_HOME)
    : null;
  const rootDir = overriddenRoot || path.join(home, APP_DIR_NAME);
  const secureDir = path.join(rootDir, "secure");
  const completionDir = path.join(rootDir, "completions");

  return {
    home,
    rootDir,
    secureDir,
    completionDir,
    configFile: path.join(rootDir, "config.json"),
    historyFile: path.join(rootDir, "history.json"),
    completionCacheFile: path.join(rootDir, "completion-cache.json"),
    auditFile: path.join(rootDir, "audit.log"),
    fallbackKeyFile: path.join(secureDir, "fallback.key"),
    fallbackStoreFile: path.join(secureDir, "fallback-store.enc"),
    zshCompletionFile: path.join(completionDir, "swush.zsh"),
    bashCompletionFile: path.join(completionDir, "swush.bash"),
    fishCompletionFile: path.join(completionDir, "swush.fish"),
  };
}

export function ensureCliDirectories(paths = getPaths()) {
  ensureDirectory(paths.rootDir);
  ensureDirectory(paths.secureDir);
  ensureDirectory(paths.completionDir);
  return paths;
}

function ensureDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true, mode: 0o700 });
    return;
  }
  try {
    fs.chmodSync(targetPath, 0o700);
  } catch {
    // Ignore permission errors on non-POSIX systems.
  }
}
