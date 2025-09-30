import { gs } from "./index.js";

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

await test("gs --version", async () => {
  const onStdout = test.mock.fn<(_: number | null) => void>();
  const { exitCode } = await gs({ args: ["--version"], onStdout });
  assert.strictEqual(exitCode, 0);
  assert.strictEqual(
    String.fromCharCode(
      ...onStdout.mock.calls.map(({ arguments: [arg] }) => {
        assert.notStrictEqual(arg, null);
        return arg as number;
      }),
    ),
    "10.05.1\n",
  );
});

await test("gs -dNOPAUSE -dBATCH -sDEVICE=ps2write -sOutputFile=manuscript.ps manuscript.pdf", async () => {
  const inputFiles = {
    "manuscript.pdf": fs.readFileSync(
      path.resolve(__dirname, "../test-asset/manuscript.pdf"),
    ),
  };
  const { exitCode, outputFiles } = await gs({
    args: [
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=ps2write",
      "-sOutputFile=manuscript.ps",
      "manuscript.pdf",
    ],
    inputFiles,
    outputFilePaths: ["manuscript.ps"],
    transfer: Object.values(inputFiles).map((f) => f.buffer),
  });
  assert.strictEqual(exitCode, 0);
  assert.ok("manuscript.ps" in outputFiles);

  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.ps"),
    outputFiles["manuscript.ps"],
  );
});

await test("gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=manuscript.png -", async () => {
  const { exitCode, outputFiles } = await gs({
    args: [
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=png16m",
      "-r150",
      "-sOutputFile=manuscript.png",
      "-",
    ],
    onStdin: (() => {
      const stdin = fs.readFileSync(
        path.resolve(__dirname, "../test-asset/manuscript.ps"),
      );
      let stdinIndex = 0;
      return () => (stdinIndex < stdin.length ? stdin[stdinIndex++]! : null);
    })(),
    outputFilePaths: ["manuscript.png"],
  });
  assert.strictEqual(exitCode, 0);
  assert.ok("manuscript.png" in outputFiles);

  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.png"),
    outputFiles["manuscript.png"],
  );
});

await test("gs with async callbacks", async () => {
  const onStdout = test.mock.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_: number | null) => new Promise<void>((resolve) => resolve()),
  );
  const onStderr = test.mock.fn(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_: number | null) => new Promise<void>((resolve) => resolve()),
  );
  const { exitCode } = await gs({ args: ["--version"], onStdout, onStderr });
  assert.strictEqual(exitCode, 0);
  assert.strictEqual(
    String.fromCharCode(
      ...onStdout.mock.calls.map(({ arguments: [arg] }) => {
        assert.notStrictEqual(arg, null);
        return arg as number;
      }),
    ),
    "10.05.1\n",
  );
  assert.strictEqual(
    String.fromCharCode(
      ...onStderr.mock.calls.map(({ arguments: [arg] }) => {
        assert.notStrictEqual(arg, null);
        return arg as number;
      }),
    ),
    "",
  );
});

await test("gs with async stdin", async () => {
  const { exitCode, outputFiles } = await gs({
    args: [
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=png16m",
      "-r150",
      "-sOutputFile=manuscript.png",
      "-",
    ],
    onStdin: (() => {
      const stdin = fs.readFileSync(
        path.resolve(__dirname, "../test-asset/manuscript.ps"),
      );
      let stdinIndex = 0;
      return async () =>
        await new Promise((resolve) =>
          resolve(stdinIndex < stdin.length ? stdin[stdinIndex++]! : null),
        );
    })(),
    outputFilePaths: ["manuscript.png"],
  });
  assert.strictEqual(exitCode, 0);
  assert.ok("manuscript.png" in outputFiles);

  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.png"),
    outputFiles["manuscript.png"],
  );
});
