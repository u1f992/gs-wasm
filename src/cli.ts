#!/usr/bin/env node
import { gs } from "./index.js";

process.exit(
  (
    await gs({
      args: process.argv.slice(2),
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
    })
  ).exitCode,
);
