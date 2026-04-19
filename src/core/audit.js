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
import { sanitizeForLog } from "../security/sanitize.js";

const MAX_AUDIT_FILE_BYTES = 1_024 * 1_024;

export function writeAuditLog(entry, paths = getPaths()) {
  const resolvedPaths = ensureCliDirectories(paths);
  const safeEntry = {
    ts: new Date().toISOString(),
    command: sanitizeForLog(entry.command || "unknown"),
    status: sanitizeForLog(entry.status || "unknown", 64),
    durationMs: Number.isFinite(entry.durationMs)
      ? Math.round(entry.durationMs)
      : null,
    host: sanitizeForLog(entry.host || "", 120) || null,
    httpStatus: Number.isFinite(entry.httpStatus)
      ? Number(entry.httpStatus)
      : null,
    code: sanitizeForLog(entry.code || "", 80) || null,
    note: sanitizeForLog(entry.note || "", 200) || null,
  };

  try {
    rotateIfNeeded(resolvedPaths.auditFile);
    fs.appendFileSync(
      resolvedPaths.auditFile,
      `${JSON.stringify(safeEntry)}\n`,
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
    try {
      fs.chmodSync(resolvedPaths.auditFile, 0o600);
    } catch {
      // Ignore permission errors on unsupported systems.
    }
  } catch {
    // Audit logging must never break command execution.
  }
}

function rotateIfNeeded(auditFile) {
  try {
    const stat = fs.statSync(auditFile, { throwIfNoEntry: false });
    if (!stat || stat.size < MAX_AUDIT_FILE_BYTES) return;

    const backup = `${auditFile}.1`;
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(auditFile, backup);
  } catch {
    // Ignore rotation errors.
  }
}
