import assert from "node:assert";
import test from "node:test";

import createModule from "./gs.js";

await test("Instance", async () => {
  const gs = await createModule();

  const instance = new gs.Instance();
  assert.strictEqual(instance.isDeleted(), false);
  instance.delete();
  assert.strictEqual(instance.isDeleted(), true);

  const again = new gs.Instance();
  again.delete();
});
