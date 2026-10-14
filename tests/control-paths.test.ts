import assert from "node:assert";
import test from "node:test";

import { withInstance } from "./helpers.ts";

await test("control paths", async () => {
  await withInstance(async (gs, instance) => {
    assert.strictEqual(instance.isPathControlActive(), false);
    assert.strictEqual(instance.addControlPath(gs.GS_PERMIT_FILE_READING, "/allowed/"), 0);
    assert.strictEqual(instance.removeControlPath(gs.GS_PERMIT_FILE_READING, "/allowed/"), 0);
    instance.purgeControlPaths(gs.GS_PERMIT_FILE_READING);
    instance.activatePathControl(true);
    assert.strictEqual(instance.isPathControlActive(), true);
  });
});
