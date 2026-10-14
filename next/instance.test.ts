import assert from "node:assert";
import test from "node:test";

import createModule from "./gs.js";

await test("constructor and delete", async () => {
  const gs = await createModule();

  const instance = new gs.Instance();
  assert.strictEqual(instance.isDeleted(), false);
  instance.delete();
  assert.strictEqual(instance.isDeleted(), true);

  const again = new gs.Instance();
  again.delete();
});

await test("setStdio captures stdout", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    assert.strictEqual(
      instance.setStdio(
        null,
        (buf: Uint8Array) => {
          stdout.push(...buf);
          return buf.length;
        },
        null,
      ),
      0,
    );
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "10.08.0\n");
});

await test("setStdio captures stderr", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stderr: number[] = [];
  try {
    instance.setStdio(null, null, (buf: Uint8Array) => {
      stderr.push(...buf);
      return buf.length;
    });
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-c",
        "(%stderr) (w) file dup (oops) writestring flushfile",
      ]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stderr)), "oops");
});

await test("setStdio feeds stdin", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  const stdin = new TextEncoder().encode("(hello) print flush\n");
  let offset = 0;
  try {
    instance.setStdio(
      (buf: Uint8Array) => {
        const chunk = stdin.subarray(offset, offset + buf.length);
        buf.set(chunk);
        offset += chunk.length;
        return chunk.length;
      },
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-",
      ]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hello");
});

await test("setStdio accepts callbacks returning promises", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  const stdin = new TextEncoder().encode("(hello) print flush\n");
  let offset = 0;
  try {
    instance.setStdio(
      async (buf: Uint8Array) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const chunk = stdin.subarray(offset, offset + buf.length);
        buf.set(chunk);
        offset += chunk.length;
        return chunk.length;
      },
      async (buf: Uint8Array) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-",
      ]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hello");
});

await test("initWithArgs and exit", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage"]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs --version returns gs_error_Info", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs throws on an unknown device", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    await assert.rejects(
      async () => instance.initWithArgs(["gs", "-dQUIET", "-sDEVICE=nosuchdevice"]),
      /^Error: gsapi_init_with_args returned -\d+$/,
    );
  } finally {
    instance.delete();
  }
});

const interpreterArgs = ["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=nullpage"];

await test("runString", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
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
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hi");
});

await test("runStringBegin, runStringContinue and runStringEnd", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
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
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "a");
});

await test("runStringWithLength accepts bytes", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    const program = new TextEncoder().encode("(b) print flush");
    assert.deepStrictEqual(await instance.runStringWithLength(program, -1), {
      code: 0,
      exitCode: 0,
    });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "b");
});

await test("runFile", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    gs.FS.writeFile("/program.ps", "(c) print flush\n");
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runFile("/program.ps", -1), { code: 0, exitCode: 0 });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "c");
});
