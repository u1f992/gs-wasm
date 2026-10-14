import assert from "node:assert";
import test from "node:test";

import { collector, interpreterArgs, withInstance } from "./helpers.ts";

await test("addFs and removeFs", async () => {
  await withInstance(async (_gs, instance) => {
    const stdout = collector();
    const opened: string[] = [];
    const content = new TextEncoder().encode("(v) print flush\n");
    const fs = {
      open_file(fname: string, mode: string) {
        if (fname !== "/virtual/program.ps") {
          return null;
        }
        opened.push(mode);
        let position = 0;
        return {
          read: (buf: Uint8Array) => {
            const chunk = content.subarray(position, position + buf.length);
            buf.set(chunk);
            position += chunk.length;
            return chunk.length;
          },
          write: () => -1,
          seek: (offset: number, whence: number) => {
            position =
              whence === 0 ? offset : whence === 1 ? position + offset : content.length + offset;
            return 0;
          },
          tell: () => position,
          eof: () => position >= content.length,
          seekable: () => true,
          close: () => {
            opened.push("closed");
            return 0;
          },
        };
      },
    };
    instance.setStdio(null, stdout.write, null);
    assert.strictEqual(instance.addFs(fs), 0);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runFile("/virtual/program.ps", -1), {
      code: 0,
      exitCode: 0,
    });
    assert.strictEqual(stdout.text(), "v");
    assert.deepStrictEqual(opened, ["r", "closed"]);
    instance.removeFs(fs);
    const { code } = await instance.runFile("/virtual/program.ps", -1);
    assert.ok(code < 0, `code: ${code}`);
    assert.strictEqual(await instance.exit(), 0);
  });
});
