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

import { normalizeTargetUrl } from "../security/sanitize.js";
import { readClipboardText } from "../utils/clipboard.js";

function resolveTargetUrl(flags, positionals, output) {
  const explicit = flags.target || positionals[0];
  if (explicit) return normalizeTargetUrl(explicit);

  const clipboard = readClipboardText();
  if (!clipboard) {
    throw new Error("Missing bookmark URL. Pass <url> or --target.");
  }

  const normalized = normalizeTargetUrl(clipboard);
  output.dim("Using URL from clipboard.");
  return normalized;
}

export async function runCommand({ flags, positionals, output, apiClient }) {
  const targetUrl = resolveTargetUrl(flags, positionals, output);

  const data = await apiClient.addBookmark({
    targetUrl,
    title: flags.title || null,
    isPublic: !flags.private,
  });

  const bookmarkId = data?.data?.id || data?.id || null;
  output.success(`Bookmark added${bookmarkId ? ` (id: ${bookmarkId})` : ""}.`);

  const domain = (() => {
    try {
      return new URL(targetUrl).hostname;
    } catch {
      return null;
    }
  })();

  return {
    history: {
      command: "bookmark add",
      args: [targetUrl],
      metadata: {
        url: targetUrl,
        domain,
        file: null,
      },
    },
    result: {
      id: bookmarkId,
      url: targetUrl,
    },
  };
}
