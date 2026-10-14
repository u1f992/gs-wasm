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

await test("initWithArgs and exit", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(
      instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage"]),
      0,
    );
    assert.strictEqual(instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs --version returns gs_error_Info", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs throws on an unknown device", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.throws(
      () => instance.initWithArgs(["gs", "-dQUIET", "-sDEVICE=nosuchdevice"]),
      /^Error: gsapi_init_with_args returned -\d+$/,
    );
  } finally {
    instance.delete();
  }
});
