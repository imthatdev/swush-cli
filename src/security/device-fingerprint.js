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

import crypto from "node:crypto";
import os from "node:os";

export function getDeviceFingerprint() {
  let username = process.env.USER || process.env.USERNAME || "unknown-user";
  try {
    const info = os.userInfo();
    if (info?.username) username = info.username;
  } catch {
    // Ignore OS user lookup failures.
  }

  const parts = [
    os.hostname() || "unknown-host",
    os.platform(),
    os.arch(),
    username,
    os.release(),
  ];

  const raw = parts.join("|");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  return {
    raw,
    hash,
    label: `${os.hostname()} (${os.platform()}/${os.arch()})`,
  };
}
