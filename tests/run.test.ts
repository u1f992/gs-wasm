import assert from "node:assert";
import test from "node:test";

import { collector, interpreterArgs, withInstance } from "./helpers.ts";

await test("runString", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    instance.setStdio(null, stdout.write, null);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runString("(hi) print flush", -1), {
      code: 0,
      exitCode: 0,
    });
    const { code } = await instance.runString("1 0 div", -1);
    assert.ok(code < 0 && code > gs.gs_error_Fatal, `code: ${code}`);
    assert.deepStrictEqual(await instance.runString("quit", -1), {
      code: gs.gs_error_Quit,
      exitCode: 0,
    });
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "hi");
  });
});

await test("runStringBegin, runStringContinue and runStringEnd", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    instance.setStdio(null, stdout.write, null);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runStringBegin(-1), { code: 0, exitCode: 0 });
    assert.deepStrictEqual(await instance.runStringContinue("(a) pri", -1), {
      code: gs.gs_error_NeedInput,
      exitCode: 0,
    });
    assert.deepStrictEqual(await instance.runStringContinue("nt flush\n", -1), {
      code: gs.gs_error_NeedInput,
      exitCode: 0,
    });
    assert.deepStrictEqual(await instance.runStringEnd(-1), { code: 0, exitCode: 0 });
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "a");
  });
});

await test("runStringWithLength accepts bytes", async () => {
  await withInstance(async (_gs, instance) => {
    const stdout = collector();
    instance.setStdio(null, stdout.write, null);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    const program = new TextEncoder().encode("(b) print flush");
    assert.deepStrictEqual(await instance.runStringWithLength(program, -1), {
      code: 0,
      exitCode: 0,
    });
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "b");
  });
});

await test("runFile", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    gs.FS.writeFile("/program.ps", "(c) print flush\n");
    instance.setStdio(null, stdout.write, null);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runFile("/program.ps", -1), { code: 0, exitCode: 0 });
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "c");
  });
});
