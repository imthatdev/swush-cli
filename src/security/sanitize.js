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
import path from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function normalizeMaybeUrl(value, defaultProtocol = "https://") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `${defaultProtocol}${trimmed}`;
  return new URL(withProtocol);
}

function isLocalHost(hostname) {
  const lower = hostname.toLowerCase();
  if (LOCAL_HOSTS.has(lower)) return true;
  if (lower.endsWith(".localhost")) return true;
  return false;
}

export function normalizeBaseUrl(input, options = {}) {
  const parsed = normalizeMaybeUrl(
    input,
    options.defaultProtocol || "https://",
  );
  if (!parsed) throw new Error("A base URL is required.");

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Base URL protocol must be http or https.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Base URL must not include credentials.");
  }

  const allowHttp =
    options.allowHttp === true ||
    process.env.SWUSH_ALLOW_HTTP === "1" ||
    isLocalHost(parsed.hostname);

  if (parsed.protocol === "http:" && !allowHttp) {
    throw new Error(
      "Insecure http:// base URLs are blocked. Use https:// or set SWUSH_ALLOW_HTTP=1 for trusted environments.",
    );
  }

  parsed.hash = "";
  parsed.search = "";
  const out = parsed.toString().replace(/\/+$/, "");
  return out;
}

export function normalizeTargetUrl(input) {
  const parsed = normalizeMaybeUrl(input);
  if (!parsed) throw new Error("A target URL is required.");

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// target URLs are allowed.");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function resolveReadableFilePath(inputPath, cwd = process.cwd()) {
  const raw = String(inputPath || "").trim();
  if (!raw) throw new Error("A file path is required.");
  if (hasControlCharacters(raw)) {
    throw new Error("File path contains invalid control characters.");
  }

  const absolute = path.resolve(cwd, raw);
  const stat = fs.statSync(absolute, { throwIfNoEntry: false });
  if (!stat) throw new Error(`File not found: ${absolute}`);
  if (!stat.isFile()) throw new Error(`Not a file: ${absolute}`);

  return absolute;
}

export function sanitizeForLog(value, max = 180) {
  const input = String(value ?? "");
  const clean = input.replace(/[\r\n\t]/g, " ").trim();
  if (!clean) return "";

  const redacted = clean.replace(
    /swush_[A-Za-z0-9_-]{8,}/g,
    "[REDACTED_TOKEN]",
  );
  return redacted.length > max ? `${redacted.slice(0, max - 1)}…` : redacted;
}

export function sanitizeTokenPreview(token) {
  if (!token) return "(missing)";
  const value = String(token);
  if (value.length <= 10) return "[REDACTED]";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
