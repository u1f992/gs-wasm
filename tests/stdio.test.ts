import assert from "node:assert";
import test from "node:test";

import { collector, interpreterArgs, reader, withInstance } from "./helpers.ts";

await test("setStdio captures stdout", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    assert.strictEqual(instance.setStdio(null, stdout.write, null), 0);
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
    assert.strictEqual(stdout.text(), "10.08.0\n");
  });
});

await test("setStdio captures stderr", async () => {
  await withInstance(async (gs, instance) => {
    const stderr = collector();
    instance.setStdio(null, null, stderr.write);
    assert.strictEqual(
      await instance.initWithArgs([
        ...interpreterArgs,
        "-dBATCH",
        "-c",
        "(%stderr) (w) file dup (oops) writestring flushfile",
      ]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stderr.text(), "oops");
  });
});

await test("setStdio feeds stdin", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    instance.setStdio(reader("(hello) print flush\n"), stdout.write, null);
    assert.strictEqual(
      await instance.initWithArgs([...interpreterArgs, "-dBATCH", "-"]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "hello");
  });
});

await test("setStdio accepts callbacks returning promises", async () => {
  await withInstance(async (gs, instance) => {
    const stdout = collector();
    const stdin = reader("(hello) print flush\n");
    const delay = () => new Promise((resolve) => setTimeout(resolve, 10));
    instance.setStdio(
      async (buf) => {
        await delay();
        return stdin(buf);
      },
      async (buf) => {
        await delay();
        return stdout.write(buf);
      },
      null,
    );
    assert.strictEqual(
      await instance.initWithArgs([...interpreterArgs, "-dBATCH", "-"]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(stdout.text(), "hello");
  });
});

await test("setStdioWithHandle passes the caller handle", async () => {
  await withInstance(async (gs, instance) => {
    const handle = { tag: "caller" };
    const handles: unknown[] = [];
    const stdout = collector();
    assert.strictEqual(
      instance.setStdioWithHandle(
        null,
        (buf, callerHandle) => {
          handles.push(callerHandle);
          return stdout.write(buf);
        },
        null,
        handle,
      ),
      0,
    );
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
    assert.strictEqual(stdout.text(), "10.08.0\n");
    assert.ok(handles.length > 0);
    assert.ok(handles.every((h) => h === handle));
  });
});

await test("setPoll and setPollWithHandle", async () => {
  await withInstance(async (_gs, instance) => {
    assert.strictEqual(
      instance.setPoll(() => 0),
      0,
    );
    assert.strictEqual(
      instance.setPollWithHandle(() => 0, { tag: "caller" }),
      0,
    );
    assert.strictEqual(instance.setPoll(null), 0);
  });
});
