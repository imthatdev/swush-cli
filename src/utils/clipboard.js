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

import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  const text = result.stdout?.trim?.();
  return text || null;
}

export function readClipboardText() {
  if (process.platform === "darwin") {
    return run("pbpaste", []);
  }

  if (process.platform === "linux") {
    return (
      run("wl-paste", ["-n"]) || run("xclip", ["-o", "-selection", "clipboard"])
    );
  }

  if (process.platform === "win32") {
    return run("powershell", ["-NoProfile", "-Command", "Get-Clipboard"]);
  }

  return null;
}
