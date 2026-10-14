import assert from "node:assert";
import test from "node:test";

import { interpreterArgs, withInstance } from "./helpers.ts";

await test("setParam and getParam", async () => {
  await withInstance(async (gs, instance) => {
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=png16m"]),
      0,
    );
    assert.deepStrictEqual(instance.getParam("TextAlphaBits", gs.gs_spt_int), {
      code: 4,
      value: 1,
    });
    assert.strictEqual(await instance.setParam("TextAlphaBits", 4, gs.gs_spt_int), 0);
    assert.deepStrictEqual(instance.getParam("TextAlphaBits", gs.gs_spt_int), {
      code: 4,
      value: 4,
    });
    assert.strictEqual(await instance.setParam("HWResolution", "[150 150]", gs.gs_spt_parsed), 0);
    assert.deepStrictEqual(instance.getParam("HWResolution", gs.gs_spt_parsed), {
      code: 10,
      value: "[150 150]",
    });
    assert.strictEqual(await instance.setParam("OutputFile", "/out.png", gs.gs_spt_string), 0);
    assert.deepStrictEqual(instance.getParam("OutputFile", gs.gs_spt_string), {
      code: 9,
      value: "/out.png",
    });
    assert.deepStrictEqual(instance.getParam("Name", gs.gs_spt_name), {
      code: 7,
      value: "png16m",
    });
    assert.deepStrictEqual(instance.getParam("NoSuchParameter", gs.gs_spt_int), {
      code: gs.gs_error_undefined,
      value: null,
    });
    assert.strictEqual(await instance.exit(), 0);
  });
});

await test("enumerateParams", async () => {
  await withInstance(async (gs, instance) => {
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    const keys: string[] = [];
    for (;;) {
      const { code, key, type } = instance.enumerateParams();
      if (code !== 0) {
        assert.strictEqual(code, 1);
        break;
      }
      assert.notStrictEqual(type, gs.gs_spt_invalid);
      keys.push(key);
    }
    assert.ok(keys.includes("HWResolution"), keys.join(" "));
    assert.strictEqual(await instance.exit(), 0);
  });
});
