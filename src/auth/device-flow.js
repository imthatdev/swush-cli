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

import { AuthError } from "../core/errors.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openInBrowser(url) {
  if (!url) return false;

  if (process.platform === "darwin") {
    const result = spawnSync("open", [url], { stdio: "ignore" });
    return result.status === 0;
  }

  if (process.platform === "linux") {
    const result = spawnSync("xdg-open", [url], { stdio: "ignore" });
    return result.status === 0;
  }

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Process", url],
      { stdio: "ignore" },
    );
    return result.status === 0;
  }

  return false;
}

export async function authenticateWithDeviceFlow({
  apiClient,
  clientId,
  timeoutSeconds = 300,
  output,
  noOpen = false,
}) {
  const flow = await apiClient.startDeviceFlow(clientId);

  output.log("Device authentication started.");
  output.log(`Code: ${flow.user_code}`);
  output.log(`Verify at: ${flow.verification_uri}`);
  output.log(`Quick link: ${flow.verification_uri_complete}`);

  if (!noOpen) {
    const opened = openInBrowser(flow.verification_uri_complete);
    if (!opened) {
      output.dim(
        "Could not open browser automatically. Open the quick link manually.",
      );
    }
  }

  const expiresAtMs = Date.now() + Number(flow.expires_in || 600) * 1_000;
  const timeoutAtMs = Date.now() + Number(timeoutSeconds || 300) * 1_000;
  let intervalMs = Math.max(1_000, Number(flow.interval || 5) * 1_000);

  while (Date.now() < timeoutAtMs && Date.now() < expiresAtMs) {
    await sleep(intervalMs);
    const token = await apiClient.pollDeviceToken(flow.device_code);

    if (token.ok) {
      const expiresInSeconds = Number(token.data.expires_in || 0);
      return {
        tokenType: token.data.token_type || "ApiKey",
        refreshToken: token.data.api_key,
        refreshExpiresAt:
          expiresInSeconds > 0
            ? new Date(Date.now() + expiresInSeconds * 1_000).toISOString()
            : null,
      };
    }

    const error = String(token.error || "");
    if (error === "authorization_pending") {
      continue;
    }

    if (error === "slow_down") {
      const hinted = Number(token.interval || 0) * 1_000;
      intervalMs = Math.max(intervalMs + 500, hinted || intervalMs + 500);
      continue;
    }

    if (error === "access_denied") {
      throw new AuthError(
        token.errorDescription || "Device authentication request was denied.",
      );
    }

    if (error === "expired_token") {
      throw new AuthError(
        "Device authentication code expired before approval.",
        {
          hint: "Run `swush auth login` again to start a new device flow.",
        },
      );
    }

    throw new AuthError(
      token.errorDescription || "Device authentication failed.",
    );
  }

  throw new AuthError("Device authentication timed out.", {
    hint: "Run `swush auth login` and approve the device code before it expires.",
  });
}
