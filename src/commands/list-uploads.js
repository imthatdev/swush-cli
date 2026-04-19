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

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

export async function runCommand({ flags, output, apiClient, globalFlags }) {
  const limit = toInt(flags.limit);
  const offset = toInt(flags.offset);

  let data;
  try {
    data = await apiClient.listUploads({ limit, offset });
  } catch (error) {
    if (error?.status === 401) {
      throw new SwushCliError(
        "Upload listing endpoint rejected API key authentication.",
        {
          code: "SWUSH_UPLOAD_LIST_UNAUTHORIZED",
          hint: "Your server may restrict GET /api/v1/upload for API keys. Use web UI or adjust server API-key allowlist.",
        },
      );
    }
    throw error;
  }

  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];

  if (globalFlags.json) {
    output.printJson({ count: items.length, items });
  } else {
    output.success(
      `Listed ${items.length} upload${items.length === 1 ? "" : "s"}.`,
    );
    for (const item of items.slice(0, 20)) {
      const id = item.id || "-";
      const name = item.name || item.originalName || "(unnamed)";
      const url = item.url || item.shareUrl || "";
      output.log(`${id}  ${name}${url ? `  ${url}` : ""}`);
    }
    if (items.length > 20) {
      output.dim(
        `Showing first 20 of ${items.length}. Use --limit/--offset to paginate.`,
      );
    }
  }

  return {
    history: {
      command: "list uploads",
      args: [String(limit ?? ""), String(offset ?? "")].filter(Boolean),
      metadata: {
        url: null,
        domain: null,
        file: null,
      },
    },
    result: {
      count: items.length,
    },
  };
}
