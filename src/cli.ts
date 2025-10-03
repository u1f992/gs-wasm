#!/usr/bin/env node
import { gs } from "./index.js";
import fs from "node:fs";
import upath from "upath";

const rawArgs = process.argv.slice(2);
const separatorIndex = rawArgs.indexOf("--");
const args = separatorIndex === -1 ? rawArgs : rawArgs.slice(0, separatorIndex);
const fileArgs = separatorIndex === -1 ? [] : rawArgs.slice(separatorIndex + 1);

const inputFiles: Record<string, Uint8Array> = {};
const outputFilePaths: string[] = [];
const outputFileMapping: Record<string, string> = {};
const cwd = process.cwd();

for (let i = 0; i < fileArgs.length; i += 2) {
  const flag = fileArgs[i];
  const fileSpec = fileArgs[i + 1];

  if (!flag || !fileSpec) {
    throw new Error(`Invalid file argument at position ${i}`);
  }

  if (
    flag !== "-i" &&
    flag !== "--input" &&
    flag !== "-o" &&
    flag !== "--output"
  ) {
    throw new Error(
      `Invalid flag "${flag}". Must be -i, --input, -o, or --output`,
    );
  }

  if (flag === "-i" || flag === "--input") {
    // input: actualPath:vmPath
    const colonIndex = fileSpec.lastIndexOf(":");
    const actualPath =
      colonIndex === -1 ? fileSpec : fileSpec.slice(0, colonIndex);
    const vmPath =
      colonIndex === -1
        ? upath.normalize(upath.relative(cwd, upath.resolve(cwd, fileSpec)))
        : fileSpec.slice(colonIndex + 1);

    inputFiles[vmPath] = fs.readFileSync(actualPath);
  } else {
    // output: vmPath:actualPath
    const colonIndex = fileSpec.lastIndexOf(":");
    const vmPath = colonIndex === -1 ? fileSpec : fileSpec.slice(0, colonIndex);
    const actualPath =
      colonIndex === -1
        ? upath.resolve(cwd, fileSpec)
        : fileSpec.slice(colonIndex + 1);

    outputFilePaths.push(vmPath);
    outputFileMapping[vmPath] = actualPath;
  }
}

const result = await gs({
  args,
  inputFiles,
  outputFilePaths,
  onStdin: (() => {
    const stdinBuffer: (number | null)[] = [];
    const waitingResolvers: ((value: number | null) => void)[] = [];
    function wake() {
      while (waitingResolvers.length > 0 && stdinBuffer.length > 0) {
        waitingResolvers.shift()!(stdinBuffer.shift()!);
      }
    }
    process.stdin.on("data", (data) => {
      stdinBuffer.push(...data, null);
      wake();
    });
    process.stdin.on("close", () => {
      stdinBuffer.push(null);
      wake();
    });
    return async () =>
      new Promise((resolve) => {
        if (stdinBuffer.length > 0) {
          resolve(stdinBuffer.shift()!);
        } else {
          waitingResolvers.push(resolve);
        }
      });
  })(),
  onStdout(charCode) {
    if (charCode !== null) {
      process.stdout.write(String.fromCharCode(charCode));
    }
  },
  onStderr(charCode) {
    if (charCode !== null) {
      process.stderr.write(String.fromCharCode(charCode));
    }
  },
});

for (const [vmPath, data] of Object.entries(result.outputFiles)) {
  const actualPath = outputFileMapping[vmPath] || upath.resolve(cwd, vmPath);
  const dirPath = upath.dirname(actualPath);
  if (dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(actualPath, data);
}

process.exit(result.exitCode);
