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

import { createApiClient } from "../api/client.js";
import { authenticateWithDeviceFlow } from "../auth/device-flow.js";
import { AuthError } from "../core/errors.js";
import { sanitizeTokenPreview } from "../security/sanitize.js";

export async function runCommand({ flags, output, sessionManager }) {
  const config = sessionManager.loadConfigForRecovery();
  const baseUrl = sessionManager.resolveBaseUrl(config, flags.url || null);

  let tokenType = "ApiKey";
  let refreshToken = null;
  let refreshExpiresAt = null;

  if (flags.apiKey) {
    refreshToken = String(flags.apiKey).trim();
    if (!refreshToken) {
      throw new AuthError("Provided --api-key is empty.");
    }

    const verifier = createApiClient({ baseUrl, token: refreshToken, output });
    const validation = await verifier.verifySession();
    if (!validation.valid) {
      throw new AuthError("Provided API key failed server-side validation.", {
        details: validation.reason,
      });
    }

    output.dim(
      `Manual API key validated (${sanitizeTokenPreview(refreshToken)}).`,
    );
  } else {
    const apiClient = createApiClient({ baseUrl, token: null, output });
    const login = await authenticateWithDeviceFlow({
      apiClient,
      clientId: flags.clientId || "swush-cli",
      timeoutSeconds: Number(flags.pollTimeout || 300),
      output,
      noOpen: Boolean(flags.noOpen),
    });

    tokenType = login.tokenType || "ApiKey";
    refreshToken = login.refreshToken;
    refreshExpiresAt = login.refreshExpiresAt;
  }

  const saved = await sessionManager.saveAuthenticatedSession({
    baseUrl,
    refreshToken,
    refreshExpiresAt,
    tokenType,
  });

  await sessionManager.requireAuthenticatedSession({
    baseUrlOverride: baseUrl,
    forceVerify: true,
  });

  await sessionManager.maybeRefreshCompatibility({
    baseUrl,
    refreshToken,
    force: true,
  });

  output.success("Authenticated successfully.");
  output.log(`Base URL: ${saved.baseUrl}`);
  output.log(`Secret store: ${saved.provider}`);
  output.log(`Device binding: ${saved.fingerprint}`);
  if (saved.refreshExpiresAt) {
    output.log(`Refresh token expires: ${saved.refreshExpiresAt}`);
  }

  return {
    history: null,
  };
}
