import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { TranscriptParser } from "../dist/core/transcript-parser.js";

test("derives a readable session slug when Claude transcript has no slug field", async () => {
  const dir = await mkdtemp(join(tmpdir(), "claude-receipts-"));
  const transcriptPath = join(dir, "c4aca7e6-9220-4061-9a21-240ddfcd3385.jsonl");

  try {
    await writeFile(
      transcriptPath,
      [
        JSON.stringify({
          type: "permission-mode",
          permissionMode: "bypassPermissions",
          sessionId: "c4aca7e6-9220-4061-9a21-240ddfcd3385",
        }),
        JSON.stringify({
          type: "user",
          message: {
            role: "user",
            content: "review your config, tell me if it contains any errors.",
          },
          timestamp: "2026-05-02T11:59:32.668Z",
          cwd: "/home/jian/Documents/code/claude-receipts",
          sessionId: "c4aca7e6-9220-4061-9a21-240ddfcd3385",
        }),
      ].join("\n"),
      "utf-8",
    );

    const parsed = await new TranscriptParser().parseTranscript(transcriptPath);

    assert.equal(
      parsed.sessionSlug,
      "claude-receipts-review-your-config-tell-me-if-it-contains-any-errors",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
