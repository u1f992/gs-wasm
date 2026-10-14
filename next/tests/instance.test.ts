import assert from "node:assert";
import test from "node:test";

import createModule from "../gs.js";
import { interpreterArgs, withInstance } from "./helpers.ts";

await test("constructor and delete", async () => {
  const gs = await createModule();

  const instance = new gs.Instance();
  assert.strictEqual(instance.isDeleted(), false);
  instance.delete();
  assert.strictEqual(instance.isDeleted(), true);

  const again = new gs.Instance();
  again.delete();
});

await test("calls made while a callback promise is pending are rejected", async () => {
  await withInstance(async (gs, instance) => {
    const gate: { release?: (bytes: number) => void } = {};
    instance.setStdio(
      () =>
        new Promise<number>((resolve) => {
          gate.release = resolve;
        }),
      null,
      null,
    );
    const pending = instance.initWithArgs([...interpreterArgs, "-dBATCH", "-"]);
    assert.ok(pending instanceof Promise);
    while (gate.release === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    assert.throws(() => instance.getDefaultDeviceList(), /suspended/);
    assert.throws(() => gs.revision(), /suspended/);
    assert.throws(() => new gs.Instance(), /suspended/);
    gate.release(0);
    assert.strictEqual(await pending, gs.gs_error_Quit);
    assert.strictEqual(await instance.exit(), 0);
  });
});
