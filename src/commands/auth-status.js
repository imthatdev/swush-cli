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

export async function runCommand({ output, sessionManager, globalFlags }) {
  const status = await sessionManager.getStatus();

  if (globalFlags.json) {
    output.printJson({
      authenticated: status.hasRefreshToken && !status.refreshExpired,
      baseUrl: status.baseUrl,
      provider: status.provider,
      refreshTokenRef: status.refreshTokenRef,
      refreshExpiresAt: status.refreshExpiresAt,
      refreshExpired: status.refreshExpired,
      accessValidatedAt: status.accessValidatedAt,
      accessExpiresAt: status.accessExpiresAt,
      accessCacheValid: status.accessCacheValid,
      fingerprintMatch: status.fingerprintMatch,
      integrityState: status.integrityState,
      compatibility: status.compatibility,
    });
    return { history: null };
  }

  output.log(`Base URL: ${status.baseUrl}`);
  output.log(`Secret store: ${status.provider}`);
  output.log(
    `Authenticated: ${status.hasRefreshToken && !status.refreshExpired ? "yes" : "no"}`,
  );
  output.log(`Refresh token ref: ${status.refreshTokenRef}`);

  if (status.refreshExpiresAt) {
    output.log(`Refresh expires: ${status.refreshExpiresAt}`);
  } else {
    output.log("Refresh expires: not set");
  }

  output.log(`Access cache valid: ${status.accessCacheValid ? "yes" : "no"}`);
  output.log(`Last validation: ${status.accessValidatedAt || "never"}`);
  output.log(`Device binding match: ${status.fingerprintMatch ? "yes" : "no"}`);
  output.log(`Config integrity: ${status.integrityState}`);
  output.log(
    `Compatibility API version: ${status.compatibility?.apiVersion || "unknown"}`,
  );

  return { history: null };
}
