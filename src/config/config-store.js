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

import { getPaths, ensureCliDirectories } from "./paths.js";
import { normalizeBaseUrl } from "../security/sanitize.js";
import {
  createIntegritySignature,
  randomIntegrityKey,
  verifyIntegrity,
} from "../security/integrity.js";
import { ConfigIntegrityError } from "../core/errors.js";

export const CURRENT_SCHEMA_VERSION = 2;
export const REFRESH_TOKEN_ACCOUNT = "session:refresh-token";
export const INTEGRITY_KEY_ACCOUNT = "session:integrity-key";

export function createDefaultConfig() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    baseUrl: null,
    auth: {
      tokenType: "ApiKey",
      refreshTokenRef: REFRESH_TOKEN_ACCOUNT,
      refreshExpiresAt: null,
      accessValidatedAt: null,
      accessExpiresAt: null,
      fingerprintHash: null,
      fingerprintLabel: null,
      provider: null,
      compatibility: {
        apiVersion: null,
        checkedAt: null,
      },
    },
    history: {
      maxEntries: 200,
    },
    completion: {
      debounceMs: 400,
    },
    preferences: {
      noColor: false,
    },
  };
}

function parseConfigFile(configFile) {
  try {
    const text = fs.readFileSync(configFile, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withSignature(config, signature) {
  return {
    ...config,
    signature,
  };
}

function ensureConfigShape(config) {
  const defaults = createDefaultConfig();
  return {
    ...defaults,
    ...config,
    auth: {
      ...defaults.auth,
      ...(config?.auth || {}),
      compatibility: {
        ...defaults.auth.compatibility,
        ...(config?.auth?.compatibility || {}),
      },
    },
    history: {
      ...defaults.history,
      ...(config?.history || {}),
    },
    completion: {
      ...defaults.completion,
      ...(config?.completion || {}),
    },
    preferences: {
      ...defaults.preferences,
      ...(config?.preferences || {}),
    },
  };
}

function normalizeBaseUrlIfPresent(raw) {
  if (!raw) return null;
  try {
    return normalizeBaseUrl(raw, { allowHttp: true });
  } catch {
    return null;
  }
}

function migrateLegacyConfig(rawConfig, secureStore) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return createDefaultConfig();
  }

  const hasLegacyToken =
    typeof rawConfig.apiKey === "string" && rawConfig.apiKey.trim();
  const hasLegacyUrl =
    typeof rawConfig.url === "string" && rawConfig.url.trim();
  if (!hasLegacyToken && !hasLegacyUrl) {
    return ensureConfigShape(rawConfig);
  }

  const migrated = ensureConfigShape(rawConfig);
  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;

  if (hasLegacyUrl) {
    migrated.baseUrl =
      normalizeBaseUrlIfPresent(rawConfig.url) || migrated.baseUrl;
  }

  if (hasLegacyToken) {
    secureStore.set(REFRESH_TOKEN_ACCOUNT, rawConfig.apiKey.trim());
    migrated.auth.refreshTokenRef = REFRESH_TOKEN_ACCOUNT;
    migrated.auth.refreshExpiresAt = null;
    migrated.auth.accessValidatedAt = null;
    migrated.auth.accessExpiresAt = null;
  }

  delete migrated.url;
  delete migrated.apiKey;

  return migrated;
}

export function loadConfig({ paths = getPaths(), secureStore }) {
  const resolvedPaths = ensureCliDirectories(paths);
  const raw = parseConfigFile(resolvedPaths.configFile);
  if (!raw) return createDefaultConfig();

  const signature = raw.signature || null;
  const { signature: _ignored, ...body } = raw;

  const migrated = migrateLegacyConfig(body, secureStore);
  const normalized = ensureConfigShape(migrated);

  if (signature) {
    const key = secureStore.get(INTEGRITY_KEY_ACCOUNT);
    if (!key) {
      throw new ConfigIntegrityError(
        "Configuration signature exists, but integrity key is missing.",
      );
    }

    const valid = verifyIntegrity(normalized, signature, key);
    if (!valid) {
      throw new ConfigIntegrityError(
        "Configuration signature validation failed.",
      );
    }
  }

  return normalized;
}

export function saveConfig(config, { paths = getPaths(), secureStore }) {
  const resolvedPaths = ensureCliDirectories(paths);
  const normalized = ensureConfigShape(config);
  normalized.schemaVersion = CURRENT_SCHEMA_VERSION;

  let integrityKey = secureStore.get(INTEGRITY_KEY_ACCOUNT);
  if (!integrityKey) {
    integrityKey = randomIntegrityKey();
    secureStore.set(INTEGRITY_KEY_ACCOUNT, integrityKey);
  }

  const signature = createIntegritySignature(normalized, integrityKey);

  fs.writeFileSync(
    resolvedPaths.configFile,
    JSON.stringify(withSignature(normalized, signature), null, 2),
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );

  try {
    fs.chmodSync(resolvedPaths.configFile, 0o600);
  } catch {
    // Ignore permission errors on unsupported systems.
  }

  return normalized;
}
