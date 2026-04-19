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

import fs from "node:fs/promises";
import path from "node:path";

import { ApiError, AuthError } from "../core/errors.js";
import { normalizeBaseUrl } from "../security/sanitize.js";

const TRANSIENT_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(baseUrl, relativePath) {
  if (!relativePath.startsWith("/")) {
    throw new Error("API path must start with '/'.");
  }
  if (!relativePath.startsWith("/api/")) {
    throw new Error("API path must target /api/* routes.");
  }
  const base = normalizeBaseUrl(baseUrl, { allowHttp: true });
  return new URL(relativePath, `${base}/`).toString();
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return { json: await response.json(), text: "" };
    } catch {
      return { json: null, text: "" };
    }
  }

  try {
    const text = await response.text();
    return { json: null, text: text?.trim?.() || "" };
  } catch {
    return { json: null, text: "" };
  }
}

function formatApiErrorMessage(response, payload) {
  const json = payload?.json;
  const fallback = payload?.text || `Request failed (${response.status})`;
  return (
    json?.error_description ||
    json?.error ||
    json?.message ||
    (typeof json === "string" ? json : null) ||
    fallback
  );
}

export class SwushApiClient {
  constructor(options) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl, { allowHttp: true });
    this.token = options.token || null;
    this.output = options.output || null;
  }

  async request(options) {
    const method = (options.method || "GET").toUpperCase();
    const retries = Number.isFinite(options.retries)
      ? Number(options.retries)
      : 2;
    const timeoutMs = Number.isFinite(options.timeoutMs)
      ? Number(options.timeoutMs)
      : 10_000;

    const url = buildUrl(this.baseUrl, options.path);
    const headers = {
      ...(options.headers || {}),
    };

    if (options.auth !== false) {
      if (!this.token) {
        throw new AuthError(
          "No authentication token is available in session state.",
        );
      }
      headers["x-api-key"] = this.token;
    }

    let attempt = 0;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers,
          body: options.body,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (
          !response.ok &&
          TRANSIENT_STATUSES.has(response.status) &&
          attempt < retries
        ) {
          const delay = Math.min(
            1_500,
            150 * 2 ** attempt + Math.random() * 120,
          );
          await sleep(delay);
          attempt += 1;
          continue;
        }

        const payload = await parseResponseBody(response);
        return {
          response,
          payload,
        };
      } catch (error) {
        clearTimeout(timeout);
        if (attempt < retries) {
          const delay = Math.min(
            1_500,
            150 * 2 ** attempt + Math.random() * 120,
          );
          await sleep(delay);
          attempt += 1;
          continue;
        }

        throw new ApiError("Network request failed.", {
          code: "SWUSH_NETWORK_ERROR",
          details: error instanceof Error ? error.message : String(error),
          hint: "Check network connectivity and base URL, then retry. Use `swush auth status` to verify current session.",
        });
      }
    }

    throw new ApiError("Request retries exhausted.", {
      code: "SWUSH_RETRY_EXHAUSTED",
    });
  }

  async requestJson(options) {
    const { response, payload } = await this.request(options);

    if (!response.ok) {
      const status = response.status;
      const requestId = response.headers.get("x-request-id") || null;
      const message = formatApiErrorMessage(response, payload);

      throw new ApiError(message, {
        status,
        requestId,
        code: `HTTP_${status}`,
        hint:
          status === 401
            ? "Session is invalid. Run `swush auth login` and retry."
            : status === 403
              ? "This account does not have permission for this action."
              : null,
      });
    }

    return payload.json ?? {};
  }

  async verifySession() {
    const { response, payload } = await this.request({
      path: "/api/v1/remote-upload",
      method: "GET",
      auth: true,
      retries: 1,
      timeoutMs: 7_500,
    });

    if (response.status === 401) {
      return {
        valid: false,
        status: 401,
        reason: formatApiErrorMessage(response, payload),
      };
    }

    if (response.status >= 200 && response.status < 500) {
      return {
        valid: true,
        status: response.status,
        reason: null,
      };
    }

    throw new ApiError(
      "Session validation failed due to upstream server error.",
      {
        status: response.status,
        code: "SWUSH_SESSION_VERIFY_FAILED",
        details: formatApiErrorMessage(response, payload),
      },
    );
  }

  async checkCompatibility() {
    const data = await this.requestJson({
      path: "/api/v1/openapi",
      method: "GET",
      auth: false,
      retries: 1,
      timeoutMs: 8_000,
    });

    const apiVersion = data?.info?.version;
    if (typeof apiVersion !== "string" || !apiVersion.trim()) {
      throw new ApiError("OpenAPI response missing info.version", {
        code: "SWUSH_INVALID_OPENAPI",
      });
    }

    return {
      apiVersion,
    };
  }

  async startDeviceFlow(clientId) {
    const payload = await this.requestJson({
      path: "/api/v1/auth/device/authorize",
      method: "POST",
      auth: false,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ extension_id: clientId }),
      retries: 1,
      timeoutMs: 10_000,
    });

    const required = [
      "device_code",
      "user_code",
      "verification_uri",
      "verification_uri_complete",
      "expires_in",
      "interval",
    ];
    for (const key of required) {
      if (!(key in payload)) {
        throw new ApiError(`Device authorization response missing '${key}'`, {
          code: "SWUSH_INVALID_DEVICE_AUTHORIZE_RESPONSE",
        });
      }
    }

    return payload;
  }

  async pollDeviceToken(deviceCode) {
    const { response, payload } = await this.request({
      path: "/api/v1/auth/device/token",
      method: "POST",
      auth: false,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ device_code: deviceCode }),
      retries: 0,
      timeoutMs: 10_000,
    });

    const json = payload.json || {};
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: json.error || "request_failed",
        errorDescription:
          json.error_description || json.message || "Request failed",
        interval: json.interval,
      };
    }

    if (!json.api_key || !json.expires_in) {
      throw new ApiError("Device token response missing api_key/expires_in.", {
        code: "SWUSH_INVALID_DEVICE_TOKEN_RESPONSE",
      });
    }

    return {
      ok: true,
      data: json,
    };
  }

  async uploadFile({ absolutePath, isPublic = true }) {
    const filename = path.basename(absolutePath);
    const buffer = await fs.readFile(absolutePath);
    const form = new FormData();
    form.append("file", new Blob([buffer]), filename);
    form.append("isPublic", String(Boolean(isPublic)));

    const data = await this.requestJson({
      path: "/api/v1/upload",
      method: "POST",
      body: form,
    });

    return data;
  }

  async shortenLink({
    targetUrl,
    slug = null,
    expiresAt = null,
    isPublic = true,
  }) {
    const payload = {
      originalUrl: targetUrl,
      isPublic: Boolean(isPublic),
    };
    if (slug) payload.slug = slug;
    if (expiresAt) payload.expiresAt = expiresAt;

    const data = await this.requestJson({
      path: "/api/v1/shorten",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return data;
  }

  async addBookmark({ targetUrl, title = null, isPublic = true }) {
    const payload = {
      url: targetUrl,
      isPublic: Boolean(isPublic),
    };
    if (title) payload.title = title;

    return this.requestJson({
      path: "/api/v1/bookmarks",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  async listUploads({ limit = null, offset = null } = {}) {
    const params = new URLSearchParams();
    if (Number.isFinite(limit)) params.set("limit", String(limit));
    if (Number.isFinite(offset)) params.set("offset", String(offset));
    const suffix = params.size ? `?${params.toString()}` : "";

    return this.requestJson({
      path: `/api/v1/upload${suffix}`,
      method: "GET",
    });
  }
}

export function createApiClient(options) {
  return new SwushApiClient(options);
}
