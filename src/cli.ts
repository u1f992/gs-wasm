#!/usr/bin/env node
import process from "node:process";

import createModule from "./gs.js";
import { hostFileSystem } from "./host-fs.ts";
import { stdinReader, streamWriter } from "./stdio.ts";

function returnedCode(error: unknown): number {
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "number") {
    return code;
  }
  throw error;
}

const gs = await createModule();
const instance = new gs.Instance();
instance.setStdio(
  stdinReader(process.stdin),
  streamWriter(process.stdout),
  streamWriter(process.stderr),
);
instance.setArgEncoding(gs.GS_ARG_ENCODING_UTF8);
instance.addFs(hostFileSystem());

let code: number;
try {
  code = await instance.initWithArgs(["gs", ...process.argv.slice(2)]);
  if (code === 0) {
    code = (await instance.runString("systemdict /start get exec\n", 0)).code;
  }
} catch (error) {
  code = returnedCode(error);
}

let exitResult: number;
try {
  exitResult = await instance.exit();
} catch (error) {
  exitResult = returnedCode(error);
}
if (code === 0 || code === gs.gs_error_Quit) {
  code = exitResult;
}
instance.delete();

process.exitCode =
  code === 0 || code === gs.gs_error_Info || code === gs.gs_error_Quit
    ? 0
    : code === gs.gs_error_Fatal
      ? 1
      : 255;
