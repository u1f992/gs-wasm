import assert from "node:assert";
import test from "node:test";

import createModule from "./gs.js";

await test("newInstance", async () => {
  const gs = await createModule();

  const instance = gs.newInstance();
  assert.strictEqual(instance.isDeleted(), false);
  instance.delete();
  assert.strictEqual(instance.isDeleted(), true);

  const again = gs.newInstance();
  again.delete();
});
