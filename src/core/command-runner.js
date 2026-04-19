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

export async function executeResolvedCommand({
  resolved,
  parsed,
  globalFlags,
  sessionManager,
  output,
}) {
  const { command } = resolved;
  const module = await import(command.handler);
  if (typeof module.runCommand !== "function") {
    throw new Error(`Command module missing runCommand(): ${command.id}`);
  }

  const context = {
    command,
    globalFlags,
    flags: parsed.flags,
    positionals: parsed.positionals,
    output,
    sessionManager,
    apiClient: null,
    session: null,
  };

  if (command.requiresAuth) {
    const session = await sessionManager.requireAuthenticatedSession({
      baseUrlOverride: parsed.flags.url || null,
      forceVerify: parsed.flags.revalidate === true,
    });

    context.session = session;
    context.apiClient = createApiClient({
      baseUrl: session.baseUrl,
      token: session.refreshToken,
      output,
    });

    await sessionManager.maybeRefreshCompatibility({
      baseUrl: session.baseUrl,
      refreshToken: session.refreshToken,
      force: false,
    });
  }

  const result = await module.runCommand(context);
  return result || null;
}
