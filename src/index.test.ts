import { gs } from "./index.js";

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const writeToStderr = (charCode: number | null) => {
  if (charCode !== null) {
    process.stderr.write(new Uint8Array([charCode]));
  }
};

await test("gs --version", async () => {
  const outputChars: number[] = [];
  const ret = await gs({
    args: ["--version"],
    onStdout: (charCode) => {
      if (charCode !== null) {
        outputChars.push(charCode);
      }
    },
  });
  assert.strictEqual(ret.exitCode, 0);
  const log = new TextDecoder().decode(new Uint8Array(outputChars));
  assert.strictEqual(log, "10.05.1\n");
});

await test("gs -dNOPAUSE -dBATCH -sDEVICE=ps2write -sOutputFile=manuscript.ps manuscript.pdf", async () => {
  const inputFiles = {
    "manuscript.pdf": fs.readFileSync(
      path.resolve(__dirname, "../test-asset/manuscript.pdf"),
    ),
  };
  const ret = await gs({
    args: [
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=ps2write",
      "-sOutputFile=manuscript.ps",
      "manuscript.pdf",
    ],
    inputFiles,
    onStdout: writeToStderr,
    onStderr: writeToStderr,
    outputFilePaths: ["manuscript.ps"],
    transfer: Object.values(inputFiles).map((f) => f.buffer),
  });
  assert.strictEqual(ret.exitCode, 0);
  assert.ok("manuscript.ps" in ret.outputFiles);

  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.ps"),
    ret.outputFiles["manuscript.ps"],
  );
});

await test("gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=manuscript.png -", async () => {
  const stdin = fs.readFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.ps"),
  );
  const ret = await gs({
    args: [
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=png16m",
      "-r150",
      "-sOutputFile=manuscript.png",
      "-",
    ],
    stdin,
    onStdout: writeToStderr,
    onStderr: writeToStderr,
    outputFilePaths: ["manuscript.png"],
    transfer: [stdin.buffer],
  });
  assert.strictEqual(ret.exitCode, 0);
  assert.ok("manuscript.png" in ret.outputFiles);

  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/manuscript.png"),
    ret.outputFiles["manuscript.png"],
  );
});

await test("gs with both async onStdout and onStderr callbacks", async () => {
  const outputChars: number[] = [];
  const errorChars: number[] = [];
  const ret = await gs({
    args: ["--version"],
    onStdout: async (charCode) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (charCode !== null) {
        outputChars.push(charCode);
      }
    },
    onStderr: async (charCode) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (charCode !== null) {
        errorChars.push(charCode);
      }
    },
  });
  assert.strictEqual(ret.exitCode, 0);
  const log = new TextDecoder().decode(new Uint8Array(outputChars));
  assert.strictEqual(log, "10.05.1\n");
});
