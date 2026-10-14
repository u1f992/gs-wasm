import assert from "node:assert";
import test from "node:test";

import { withInstance } from "./helpers.ts";

await test("registerCallout and deregisterCallout", async () => {
  await withInstance(async (gs, instance) => {
    const calls: [string, number, number, number][] = [];
    const callout = (deviceName: string, id: number, size: number, data: Uint8Array) => {
      calls.push([deviceName, id, size, data.length]);
      return -1;
    };
    assert.strictEqual(instance.registerCallout(callout), 0);
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=display"]),
      0,
    );
    assert.deepStrictEqual(calls.slice(0, 2), [
      ["display", gs.DISPLAY_CALLOUT_GET_CALLBACK, 8, 8],
      ["display", gs.DISPLAY_CALLOUT_GET_CALLBACK_LEGACY, 8, 8],
    ]);
    calls.length = 0;
    instance.deregisterCallout(callout);
    assert.strictEqual(await instance.exit(), 0);
    assert.deepStrictEqual(calls, []);
  });
});
