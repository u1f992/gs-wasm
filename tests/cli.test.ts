import assert from "node:assert";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/manuscript.pdf", import.meta.url));
const out = fileURLToPath(new URL("./out/", import.meta.url));
fs.mkdirSync(out, { recursive: true });

async function run(args: string[], input?: string) {
  const child = promisify(execFile)(process.execPath, [cli, ...args], {
    cwd: out,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  child.child.stdin?.end(input ?? "");
  try {
    const { stdout, stderr } = await child;
    return { status: 0, stdout, stderr };
  } catch (error) {
    const { code, stdout, stderr } = error as { code: number; stdout: Buffer; stderr: Buffer };
    return { status: code, stdout, stderr };
  }
}

await test("cli --version", async () => {
  const { status, stdout } = await run(["--version"]);
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.toString(), "10.08.0\n");
});

await test("cli reads and writes host files", async () => {
  const output = "manuscript.ps";
  fs.rmSync(new URL(output, `file://${out}`), { force: true });
  const { status, stderr } = await run([
    "-dQUIET",
    "-dNOPAUSE",
    "-dBATCH",
    "-sDEVICE=ps2write",
    `-sOutputFile=${output}`,
    fixture,
  ]);
  assert.strictEqual(status, 0, stderr.toString());
  assert.ok(fs.readFileSync(`${out}${output}`, "latin1").startsWith("%!PS-Adobe"));
});

await test("cli writes a raster page to a host file", async () => {
  const output = "manuscript.png";
  fs.rmSync(new URL(output, `file://${out}`), { force: true });
  const { status, stderr } = await run([
    "-dQUIET",
    "-dNOPAUSE",
    "-dBATCH",
    "-sDEVICE=png16m",
    "-r150",
    `-sOutputFile=${output}`,
    fixture,
  ]);
  assert.strictEqual(status, 0, stderr.toString());
  assert.ok(
    fs.readFileSync(`${out}${output}`).subarray(0, 4).equals(Buffer.from("\x89PNG", "latin1")),
  );
});

await test("cli writes an output file to stdout", async () => {
  const { status, stdout, stderr } = await run([
    "-dQUIET",
    "-dNOPAUSE",
    "-dBATCH",
    "-sDEVICE=ps2write",
    "-sOutputFile=-",
    fixture,
  ]);
  assert.strictEqual(status, 0, stderr.toString());
  assert.ok(stdout.toString("latin1").startsWith("%!PS-Adobe"));
});

await test("cli runs a program from stdin", async () => {
  const { status, stdout } = await run(
    ["-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage", "-"],
    "(hello) print flush\n",
  );
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.toString(), "hello");
});

await test("cli starts the interpreter when no file quits", async () => {
  const { status, stdout } = await run(
    ["-dQUIET", "-dNOPAUSE", "-sDEVICE=nullpage"],
    "(hello) print flush quit\n",
  );
  assert.strictEqual(status, 0);
  assert.strictEqual(stdout.toString(), "GS>hello");
});

await test("cli exits with 1 on a fatal error", async () => {
  const { status, stderr } = await run([
    "-dQUIET",
    "-dNOPAUSE",
    "-dBATCH",
    "-sDEVICE=nullpage",
    "nonexistent.pdf",
  ]);
  assert.strictEqual(status, 1);
  assert.match(
    stderr.toString(),
    /^GPL Ghostscript 10\.08\.0: Unrecoverable error, exit code 1\n$/,
  );
});
