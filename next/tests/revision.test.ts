import assert from "node:assert";
import test from "node:test";

import createModule from "../gs.js";

await test("revision", async () => {
  const gs = await createModule();
  assert.deepStrictEqual(gs.revision(), {
    product: "GPL Ghostscript",
    copyright: "Copyright (C) 2026 Artifex Software, Inc.  All rights reserved.",
    revision: 10080,
    revisiondate: 20260908,
  });
});
