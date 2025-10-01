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
    "10.06.0\n",
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
    "10.06.0\n",
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

await test("gs aborts immediately when signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    gs({
      args: ["--version"],
      signal: controller.signal,
    }),
    (err: Error) => {
      assert.strictEqual(err.name, "AbortError");
      return true;
    },
  );
});

await test("gs aborts during execution", async () => {
  const controller = new AbortController();
  const onStdout = test.mock.fn<(_: number | null) => void>();

  setTimeout(() => controller.abort(), 10);

  await assert.rejects(
    gs({
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
        return async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return stdinIndex < stdin.length ? stdin[stdinIndex++]! : null;
        };
      })(),
      outputFilePaths: ["manuscript.png"],
      signal: controller.signal,
      onStdout,
    }),
    (err: Error) => {
      assert.strictEqual(err.name, "AbortError");
      return true;
    },
  );
});

await test("gs completes successfully when not aborted", async () => {
  const controller = new AbortController();
  const onStdout = test.mock.fn<(_: number | null) => void>();

  const { exitCode } = await gs({
    args: ["--version"],
    signal: controller.signal,
    onStdout,
  });

  assert.strictEqual(exitCode, 0);
  assert.strictEqual(
    String.fromCharCode(
      ...onStdout.mock.calls.map(({ arguments: [arg] }) => {
        assert.notStrictEqual(arg, null);
        return arg as number;
      }),
    ),
    "10.06.0\n",
  );
});

await test("gs cleans up resources on abort", async () => {
  const controller = new AbortController();
  const onStdinCalled = test.mock.fn();
  const onStdoutCalled = test.mock.fn();

  const promise = gs({
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
      return async () => {
        onStdinCalled();
        if (onStdinCalled.mock.calls.length === 100) {
          controller.abort();
        }
        return stdinIndex < stdin.length ? stdin[stdinIndex++]! : null;
      };
    })(),
    onStdout: (charCode) => {
      onStdoutCalled(charCode);
    },
    outputFilePaths: ["manuscript.png"],
    signal: controller.signal,
  });

  await assert.rejects(promise, (err: Error) => {
    assert.strictEqual(err.name, "AbortError");
    return true;
  });

  assert.ok(onStdinCalled.mock.calls.length >= 1);
});

await test("gs as interpreter", async () => {
  const stdinBuffer: (number | null)[] = [];
  const waitingResolvers: ((value: number | null) => void)[] = [];

  const stdoutBuffer: number[] = [];
  const stderrBuffer: number[] = [];

  const promise = gs({
    args: [
      "-dQUIET",
      "-dNOPAUSE",
      "-sstdout=%stderr",
      "-sDEVICE=png16m",
      "-sOutputFile=-",
    ],
    onStdin: async () =>
      new Promise((resolve) => {
        const data = stdinBuffer.shift();
        if (typeof data !== "undefined") {
          resolve(data);
        } else {
          // Wait for more data to be pushed
          waitingResolvers.push(resolve);
        }
      }),
    onStdout: (charCode: number | null) => {
      if (charCode !== null) {
        stdoutBuffer.push(charCode);
      }
    },
    onStderr: (charCode: number | null) => {
      if (charCode !== null) {
        stderrBuffer.push(charCode);
      }
    },
  });

  const psCommands = `100 100 moveto
    200 200 lineto
    stroke
    showpage
    quit
`;
  stdinBuffer.push(...Array.from(psCommands).map((c) => c.charCodeAt(0)));
  stdinBuffer.push(null); // EOF

  while (waitingResolvers.length > 0 && stdinBuffer.length > 0) {
    const resolver = waitingResolvers.shift()!;
    resolver(stdinBuffer.shift()!);
  }

  const { exitCode } = await promise;

  assert.strictEqual(exitCode, 0);

  const pngData = new Uint8Array(stdoutBuffer);
  fs.writeFileSync(
    path.resolve(__dirname, "../test-asset/interpreter-output.png"),
    pngData,
  );
});
