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
import {
  createDefaultConfig,
  loadConfig,
  saveConfig,
  REFRESH_TOKEN_ACCOUNT,
} from "../config/config-store.js";
import { AuthError } from "../core/errors.js";
import { getPaths } from "../config/paths.js";
import { normalizeBaseUrl } from "../security/sanitize.js";
import { createSecureStore } from "../security/secure-store.js";
import { getDeviceFingerprint } from "../security/device-fingerprint.js";

const DEFAULT_BASE_URL = "http://localhost:3000";
const ACCESS_CACHE_TTL_MS = 45_000;
const COMPATIBILITY_REFRESH_MS = 6 * 60 * 60 * 1_000;

function parseIso(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return ts;
}

function nowIso() {
  return new Date().toISOString();
}

export class SessionManager {
  constructor(options = {}) {
    this.paths = options.paths || getPaths();
    this.secureStore =
      options.secureStore || createSecureStore({ paths: this.paths });
    this.output = options.output || null;
  }

  loadConfig() {
    return loadConfig({ paths: this.paths, secureStore: this.secureStore });
  }

  loadConfigForRecovery() {
    try {
      return this.loadConfig();
    } catch {
      return createDefaultConfig();
    }
  }

  saveConfig(config) {
    return saveConfig(config, {
      paths: this.paths,
      secureStore: this.secureStore,
    });
  }

  resolveBaseUrl(config, explicitUrl = null) {
    const candidate =
      explicitUrl ||
      config.baseUrl ||
      process.env.SWUSH_URL ||
      process.env.APP_URL ||
      DEFAULT_BASE_URL;

    return normalizeBaseUrl(candidate, { allowHttp: true });
  }

  getRefreshToken(config) {
    const ref = config?.auth?.refreshTokenRef || REFRESH_TOKEN_ACCOUNT;
    return this.secureStore.get(ref);
  }

  async saveAuthenticatedSession({
    baseUrl,
    refreshToken,
    refreshExpiresAt,
    tokenType = "ApiKey",
  }) {
    const config = this.loadConfigForRecovery();
    const normalizedBaseUrl = this.resolveBaseUrl(config, baseUrl);
    const fingerprint = getDeviceFingerprint();

    const ref = config.auth.refreshTokenRef || REFRESH_TOKEN_ACCOUNT;
    this.secureStore.set(ref, refreshToken);

    config.baseUrl = normalizedBaseUrl;
    config.auth.tokenType = tokenType;
    config.auth.refreshTokenRef = ref;
    config.auth.refreshExpiresAt = refreshExpiresAt || null;
    config.auth.accessValidatedAt = null;
    config.auth.accessExpiresAt = null;
    config.auth.fingerprintHash = fingerprint.hash;
    config.auth.fingerprintLabel = fingerprint.label;
    config.auth.provider = this.secureStore.providerName();

    const saved = this.saveConfig(config);

    return {
      baseUrl: normalizedBaseUrl,
      provider: saved.auth.provider,
      fingerprint: fingerprint.label,
      refreshExpiresAt: saved.auth.refreshExpiresAt,
    };
  }

  async logoutSession() {
    const config = this.loadConfigForRecovery();
    const ref = config.auth.refreshTokenRef || REFRESH_TOKEN_ACCOUNT;

    this.secureStore.delete(ref);

    config.auth.refreshTokenRef = REFRESH_TOKEN_ACCOUNT;
    config.auth.refreshExpiresAt = null;
    config.auth.accessValidatedAt = null;
    config.auth.accessExpiresAt = null;
    config.auth.fingerprintHash = null;
    config.auth.fingerprintLabel = null;

    this.saveConfig(config);
  }

  async getStatus() {
    let config = null;
    let integrityState = "ok";
    try {
      config = this.loadConfig();
    } catch {
      config = createDefaultConfig();
      integrityState = "tampered";
    }
    const token = this.getRefreshToken(config);
    const fingerprint = getDeviceFingerprint();

    const expiresAtMs = parseIso(config.auth.refreshExpiresAt);
    const accessExpiresAtMs = parseIso(config.auth.accessExpiresAt);
    const now = Date.now();

    return {
      baseUrl: this.resolveBaseUrl(config),
      provider: this.secureStore.providerName(),
      hasRefreshToken: Boolean(token),
      refreshTokenRef: config.auth.refreshTokenRef,
      refreshExpiresAt: config.auth.refreshExpiresAt,
      refreshExpired: expiresAtMs ? expiresAtMs <= now : false,
      accessValidatedAt: config.auth.accessValidatedAt,
      accessExpiresAt: config.auth.accessExpiresAt,
      accessCacheValid: accessExpiresAtMs ? accessExpiresAtMs > now : false,
      fingerprintExpected: config.auth.fingerprintLabel,
      fingerprintCurrent: fingerprint.label,
      fingerprintMatch:
        !config.auth.fingerprintHash ||
        config.auth.fingerprintHash === fingerprint.hash,
      compatibility: config.auth.compatibility,
      integrityState,
    };
  }

  async requireAuthenticatedSession({
    baseUrlOverride = null,
    forceVerify = false,
    verifyTtlMs = ACCESS_CACHE_TTL_MS,
  } = {}) {
    const config = this.loadConfig();
    const baseUrl = this.resolveBaseUrl(config, baseUrlOverride);

    const refreshToken = this.getRefreshToken(config);
    if (!refreshToken) {
      throw new AuthError("No refresh token found in secure storage.");
    }

    const refreshExpiresAt = parseIso(config.auth.refreshExpiresAt);
    if (refreshExpiresAt && refreshExpiresAt <= Date.now()) {
      await this.logoutSession();
      throw new AuthError("Stored refresh token is expired.", {
        hint: "Run `swush auth login` to create a new session token.",
      });
    }

    const fingerprint = getDeviceFingerprint();
    if (
      config.auth.fingerprintHash &&
      config.auth.fingerprintHash !== fingerprint.hash
    ) {
      throw new AuthError(
        "Device binding mismatch detected. Session belongs to a different device fingerprint.",
        {
          hint: "Run `swush auth login` on this device to rebind the session securely.",
        },
      );
    }

    const accessExpiresAt = parseIso(config.auth.accessExpiresAt);
    const cacheValid =
      !forceVerify && accessExpiresAt && accessExpiresAt > Date.now();

    if (!cacheValid) {
      const verifier = createApiClient({
        baseUrl,
        token: refreshToken,
        output: this.output,
      });
      const validation = await verifier.verifySession();

      if (!validation.valid) {
        await this.logoutSession();
        throw new AuthError("Authentication token validation failed.", {
          hint: "Run `swush auth login` to refresh credentials.",
          details: validation.reason,
        });
      }

      config.baseUrl = baseUrl;
      config.auth.accessValidatedAt = nowIso();
      config.auth.accessExpiresAt = new Date(
        Date.now() + verifyTtlMs,
      ).toISOString();
      this.saveConfig(config);
    }

    return {
      baseUrl,
      refreshToken,
      config,
      cacheValid,
    };
  }

  async maybeRefreshCompatibility({
    baseUrl,
    refreshToken,
    force = false,
  } = {}) {
    const config = this.loadConfig();
    const checkedAt = parseIso(config.auth.compatibility?.checkedAt);

    if (
      !force &&
      checkedAt &&
      Date.now() - checkedAt < COMPATIBILITY_REFRESH_MS
    ) {
      return config.auth.compatibility;
    }

    const client = createApiClient({
      baseUrl,
      token: refreshToken,
      output: this.output,
    });

    try {
      const compatibility = await client.checkCompatibility();
      config.auth.compatibility = {
        apiVersion: compatibility.apiVersion,
        checkedAt: nowIso(),
      };
      this.saveConfig(config);
      return config.auth.compatibility;
    } catch (error) {
      if (this.output) {
        this.output.warn(
          "Could not refresh API compatibility metadata. Continuing with existing compatibility cache.",
        );
      }
      config.auth.compatibility = {
        ...(config.auth.compatibility || {}),
        checkedAt: nowIso(),
      };
      this.saveConfig(config);
      return (
        config.auth.compatibility || {
          apiVersion: null,
          checkedAt: null,
        }
      );
    }
  }
}

export function createSessionManager(options) {
  return new SessionManager(options);
}

export function createEphemeralSessionDefaults() {
  const config = createDefaultConfig();
  return {
    baseUrl: config.baseUrl,
    auth: config.auth,
  };
}
