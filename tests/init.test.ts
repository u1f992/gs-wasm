import assert from "node:assert";
import test from "node:test";

import { interpreterArgs, withInstance } from "./helpers.ts";

await test("initWithArgs and exit", async () => {
  await withInstance(async (_gs, instance) => {
    assert.strictEqual(await instance.initWithArgs([...interpreterArgs, "-dBATCH"]), 0);
    assert.strictEqual(await instance.exit(), 0);
  });
});

await test("initWithArgs --version returns gs_error_Info", async () => {
  await withInstance(async (gs, instance) => {
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  });
});

await test("initWithArgs throws on an unknown device", async () => {
  await withInstance(async (_gs, instance) => {
    await assert.rejects(
      async () => instance.initWithArgs(["gs", "-dQUIET", "-sDEVICE=nosuchdevice"]),
      /^Error: gsapi_init_with_args returned -\d+$/,
    );
  });
});

await test("setArgEncoding", async () => {
  await withInstance(async (gs, instance) => {
    assert.strictEqual(instance.setArgEncoding(gs.GS_ARG_ENCODING_UTF8), 0);
  });
});

await test("setDefaultDeviceList and getDefaultDeviceList", async () => {
  await withInstance(async (_gs, instance) => {
    assert.strictEqual(typeof instance.getDefaultDeviceList(), "string");
    assert.strictEqual(instance.setDefaultDeviceList("nullpage bbox"), 0);
    assert.strictEqual(instance.getDefaultDeviceList(), "nullpage bbox");
  });
});
