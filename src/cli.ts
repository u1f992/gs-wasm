#!/usr/bin/env node
import process from "node:process";

import { hostFileSystem } from "./host-fs.ts";
import { main } from "./index.ts";
import { stdinReader, streamWriter } from "./stdio.ts";

process.exitCode = await main(process.argv.slice(2), (instance) => {
  instance.setStdio(
    stdinReader(process.stdin),
    streamWriter(process.stdout),
    streamWriter(process.stderr),
  );
  instance.addFs(hostFileSystem());
});
