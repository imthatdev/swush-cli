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

import path from "node:path";

import { resolveReadableFilePath } from "../security/sanitize.js";

function extractUploadUrl(payload) {
  return payload?.url || payload?.data?.url || null;
}

export async function runCommand({ flags, positionals, output, apiClient }) {
  const fileInput = flags.path || positionals[0];
  const absolutePath = resolveReadableFilePath(fileInput);

  const isPublic = flags.private ? false : true;
  const data = await apiClient.uploadFile({ absolutePath, isPublic });

  const url = extractUploadUrl(data);
  if (url) {
    output.success(`Uploaded: ${url}`);
  } else {
    output.success("Uploaded successfully.");
  }

  return {
    history: {
      command: "upload file",
      args: [absolutePath],
      metadata: {
        file: absolutePath,
        url: url || null,
        domain: null,
      },
    },
    result: {
      file: path.basename(absolutePath),
      url,
    },
  };
}
