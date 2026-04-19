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
import { SwushCliError } from "../core/errors.js";

function extractShortUrl(payload) {
  return payload?.url || payload?.data?.url || null;
}

function parseExpiry(expiry) {
  if (!expiry) return null;
  const ts = new Date(expiry).getTime();
  if (!Number.isFinite(ts)) {
    throw new SwushCliError(
      "Invalid --expiry value. Expected ISO-8601 date/time.",
      {
        code: "SWUSH_INVALID_EXPIRY",
      },
    );
  }
  return new Date(ts).toISOString();
}

export async function runCommand({ flags, positionals, output, apiClient }) {
  const targetInput = flags.target || positionals[0];
  const targetUrl = normalizeTargetUrl(targetInput);
  const expiry = parseExpiry(flags.expiry);

  const data = await apiClient.shortenLink({
    targetUrl,
    slug: flags.slug || null,
    expiresAt: expiry,
    isPublic: !flags.private,
  });

  const url = extractShortUrl(data);
  if (url) {
    output.success(`Short link: ${url}`);
  } else {
    output.success("Short link created.");
  }

  const domain = (() => {
    try {
      return new URL(targetUrl).hostname;
    } catch {
      return null;
    }
  })();

  return {
    history: {
      command: "shorten link",
      args: [targetUrl],
      metadata: {
        url: targetUrl,
        domain,
        file: null,
      },
    },
    result: {
      targetUrl,
      shortUrl: url,
    },
  };
}
