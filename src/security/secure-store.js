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

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

import { ensureCliDirectories, getPaths } from "../config/paths.js";

const DEFAULT_SERVICE = "swush-cli";

function commandExists(command) {
  const result = spawnSync("which", [command], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  return result.status === 0;
}

function readJsonFile(filePath, fallbackValue) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Ignore permission errors on unsupported systems.
  }
}

function loadFallbackKey(paths) {
  ensureCliDirectories(paths);

  if (!fs.existsSync(paths.fallbackKeyFile)) {
    const key = crypto.randomBytes(32).toString("base64url");
    fs.writeFileSync(paths.fallbackKeyFile, key, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  const keyText = fs.readFileSync(paths.fallbackKeyFile, "utf8").trim();
  const keyBuffer = Buffer.from(keyText, "base64url");
  if (keyBuffer.length !== 32) {
    throw new Error("Invalid fallback key length.");
  }

  try {
    fs.chmodSync(paths.fallbackKeyFile, 0o600);
  } catch {
    // Ignore permission errors on unsupported systems.
  }

  return keyBuffer;
}

function encryptFallbackValue(value, masterKey, account) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
  cipher.setAAD(Buffer.from(account));
  const ciphertext = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    data: ciphertext.toString("base64url"),
    updatedAt: new Date().toISOString(),
  };
}

function decryptFallbackValue(entry, masterKey, account) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterKey,
    Buffer.from(entry.iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(account));
  decipher.setAuthTag(Buffer.from(entry.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(entry.data, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function buildFallbackProvider(paths) {
  return {
    name: "encrypted-fallback",
    get(account) {
      const key = loadFallbackKey(paths);
      const store = readJsonFile(paths.fallbackStoreFile, {
        version: 1,
        entries: {},
      });

      const entry = store.entries?.[account];
      if (!entry) return null;
      try {
        return decryptFallbackValue(entry, key, account);
      } catch {
        return null;
      }
    },
    set(account, secret) {
      const key = loadFallbackKey(paths);
      const store = readJsonFile(paths.fallbackStoreFile, {
        version: 1,
        entries: {},
      });

      store.entries = store.entries || {};
      store.entries[account] = encryptFallbackValue(secret, key, account);
      writeJsonFile(paths.fallbackStoreFile, store);
    },
    delete(account) {
      const store = readJsonFile(paths.fallbackStoreFile, {
        version: 1,
        entries: {},
      });
      if (store.entries && account in store.entries) {
        delete store.entries[account];
        writeJsonFile(paths.fallbackStoreFile, store);
      }
    },
  };
}

function buildMacOsProvider(service) {
  return {
    name: "macos-keychain",
    get(account) {
      const result = spawnSync(
        "security",
        ["find-generic-password", "-a", account, "-s", service, "-w"],
        { encoding: "utf8" },
      );
      if (result.status !== 0) return null;
      return result.stdout.trim() || null;
    },
    set(account, secret) {
      const result = spawnSync(
        "security",
        [
          "add-generic-password",
          "-U",
          "-a",
          account,
          "-s",
          service,
          "-w",
          String(secret),
        ],
        { encoding: "utf8" },
      );
      if (result.status !== 0) {
        throw new Error(
          result.stderr?.trim() || "Failed to write keychain secret.",
        );
      }
    },
    delete(account) {
      spawnSync(
        "security",
        ["delete-generic-password", "-a", account, "-s", service],
        {
          encoding: "utf8",
        },
      );
    },
  };
}

function buildLinuxProvider(service) {
  return {
    name: "linux-secret-service",
    get(account) {
      const result = spawnSync(
        "secret-tool",
        ["lookup", "service", service, "account", account],
        { encoding: "utf8" },
      );
      if (result.status !== 0) return null;
      return result.stdout.trim() || null;
    },
    set(account, secret) {
      const result = spawnSync(
        "secret-tool",
        ["store", `--label=${service}`, "service", service, "account", account],
        {
          encoding: "utf8",
          input: String(secret),
        },
      );
      if (result.status !== 0) {
        throw new Error(
          result.stderr?.trim() || "Failed to write Secret Service secret.",
        );
      }
    },
    delete(account) {
      spawnSync(
        "secret-tool",
        ["clear", "service", service, "account", account],
        {
          encoding: "utf8",
        },
      );
    },
  };
}

function resolveProvider(service, paths) {
  if (process.platform === "darwin" && commandExists("security")) {
    return buildMacOsProvider(service);
  }

  if (process.platform === "linux" && commandExists("secret-tool")) {
    return buildLinuxProvider(service);
  }

  return buildFallbackProvider(paths);
}

export class SecureStore {
  constructor({ paths = getPaths(), service = DEFAULT_SERVICE } = {}) {
    this.paths = ensureCliDirectories(paths);
    this.service = service;
    this.primaryProvider = resolveProvider(service, this.paths);
    this.fallbackProvider = buildFallbackProvider(this.paths);
    this.activeProvider = this.primaryProvider;
  }

  activateFallbackProvider() {
    this.activeProvider = this.fallbackProvider;
  }

  providerName() {
    if (this.activeProvider === this.primaryProvider) {
      return this.primaryProvider.name;
    }
    return `${this.primaryProvider.name}->${this.fallbackProvider.name}`;
  }

  get(account) {
    try {
      const fromActive = this.activeProvider.get(account);
      if (fromActive !== null && fromActive !== undefined) return fromActive;
    } catch {
      this.activateFallbackProvider();
    }

    if (this.activeProvider !== this.fallbackProvider) {
      try {
        const fromFallback = this.fallbackProvider.get(account);
        if (fromFallback !== null && fromFallback !== undefined) {
          this.activateFallbackProvider();
          return fromFallback;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  set(account, secret) {
    try {
      this.activeProvider.set(account, secret);
      return;
    } catch {
      this.activateFallbackProvider();
      this.fallbackProvider.set(account, secret);
    }
  }

  delete(account) {
    try {
      this.activeProvider.delete(account);
    } catch {
      this.activateFallbackProvider();
      this.fallbackProvider.delete(account);
      return;
    }

    if (this.activeProvider !== this.fallbackProvider) {
      try {
        this.fallbackProvider.delete(account);
      } catch {
        // Ignore fallback deletion failures.
      }
    }
  }
}

export function createSecureStore(options) {
  return new SecureStore(options);
}
