import assert from "node:assert";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { hostFileSystem } from "../src/host-fs.ts";
import { main } from "../src/index.ts";
import { collector, reader } from "./helpers.ts";

const fixture = fileURLToPath(new URL("./fixtures/manuscript.pdf", import.meta.url));
const out = fileURLToPath(new URL("./out/", import.meta.url));
fs.mkdirSync(out, { recursive: true });

await test("main --version", async () => {
  const stdout = collector();
  const status = await main(["--version"], (instance) => {
    instance.setStdio(null, stdout.write, null);
  });
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.text(), "10.08.0\n");
});

await test("main reads and writes files of an added file system", async () => {
  const output = "main.ps";
  fs.rmSync(`${out}${output}`, { force: true });
  const stderr = collector();
  const status = await main(
    ["-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=ps2write", `-sOutputFile=${output}`, fixture],
    (instance) => {
      instance.setStdio(null, null, stderr.write);
      instance.addFs(hostFileSystem(out));
    },
  );
  assert.strictEqual(status, 0, stderr.text());
  assert.ok(fs.readFileSync(`${out}${output}`, "latin1").startsWith("%!PS-Adobe"));
});

await test("main passes the module to configure", async () => {
  const stdout = collector();
  const status = await main(
    ["-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage", "/program.ps"],
    (instance, gs) => {
      gs.FS.writeFile("/program.ps", "(c) print flush\n");
      instance.setStdio(null, stdout.write, null);
    },
  );
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.text(), "c");
});

await test("main awaits configure", async () => {
  const stdout = collector();
  const status = await main(["--version"], async (instance) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    instance.setStdio(null, stdout.write, null);
  });
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.text(), "10.08.0\n");
});

await test("main runs a program from stdin", async () => {
  const stdout = collector();
  const status = await main(
    ["-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage", "-"],
    (instance) => {
      instance.setStdio(reader("(hello) print flush\n"), stdout.write, null);
    },
  );
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.text(), "hello");
});

await test("main starts the interpreter when no file quits", async () => {
  const stdout = collector();
  const status = await main(["-dQUIET", "-dNOPAUSE", "-sDEVICE=nullpage"], (instance) => {
    instance.setStdio(reader("(hello) print flush quit\n"), stdout.write, null);
  });
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.text(), "GS>hello");
});

await test("main returns 1 on a fatal error", async () => {
  const stderr = collector();
  const status = await main(
    ["-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage", "nonexistent.pdf"],
    (instance) => {
      instance.setStdio(null, collector().write, stderr.write);
    },
  );
  assert.strictEqual(status, 1);
  assert.match(stderr.text(), /^GPL Ghostscript 10\.08\.0: Unrecoverable error, exit code 1\n$/);
});

await test("main rejects when configure throws", async () => {
  await assert.rejects(
    async () =>
      main(["--version"], () => {
        throw new Error("configure failed");
      }),
    /^Error: configure failed$/,
  );
});
