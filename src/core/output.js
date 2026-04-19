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

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
};

function colorize(enabled, color, text) {
  if (!enabled || !ANSI[color]) return text;
  return `${ANSI[color]}${text}${ANSI.reset}`;
}

export function createOutput(options = {}) {
  const noColorEnv =
    process.env.NO_COLOR !== undefined || process.env.CLICOLOR === "0";
  const colorEnabled = !noColorEnv && options.noColor !== true;

  return {
    colorEnabled,
    log(message = "") {
      process.stdout.write(`${message}\n`);
    },
    info(message) {
      process.stdout.write(`${colorize(colorEnabled, "cyan", message)}\n`);
    },
    success(message) {
      process.stdout.write(`${colorize(colorEnabled, "green", message)}\n`);
    },
    warn(message) {
      process.stderr.write(`${colorize(colorEnabled, "yellow", message)}\n`);
    },
    error(message) {
      process.stderr.write(`${colorize(colorEnabled, "red", message)}\n`);
    },
    dim(message) {
      process.stdout.write(`${colorize(colorEnabled, "dim", message)}\n`);
    },
    printJson(value) {
      process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    },
  };
}
