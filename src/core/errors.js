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

export class SwushCliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "SwushCliError";
    this.code = options.code || "SWUSH_CLI_ERROR";
    this.hint = options.hint || null;
    this.exitCode = Number.isInteger(options.exitCode) ? options.exitCode : 1;
    this.details = options.details || null;
  }
}

export class AuthError extends SwushCliError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || "SWUSH_AUTH_ERROR",
      exitCode: options.exitCode ?? 2,
      hint: options.hint || "Run `swush auth login` to authenticate again.",
      details: options.details,
    });
    this.name = "AuthError";
  }
}

export class ConfigIntegrityError extends SwushCliError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || "SWUSH_CONFIG_INTEGRITY_ERROR",
      exitCode: options.exitCode ?? 3,
      hint:
        options.hint ||
        "Local CLI configuration appears tampered. Run `swush auth logout` then `swush auth login`.",
      details: options.details,
    });
    this.name = "ConfigIntegrityError";
  }
}

export class ApiError extends SwushCliError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || "SWUSH_API_ERROR",
      exitCode: options.exitCode ?? 4,
      hint: options.hint || null,
      details: options.details || null,
    });
    this.name = "ApiError";
    this.status = options.status || null;
    this.requestId = options.requestId || null;
  }
}
