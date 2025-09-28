// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Module from "./gs.js";
import type { Options, Result } from "./index.js";

addEventListener(
  "message",
  async (
    e: MessageEvent<
      Pick<Options, "args" | "stdin" | "inputFiles" | "outputFilePaths">
    >,
  ) => {
    const { args, stdin, inputFiles, outputFilePaths } = e.data;

    const module = await Module({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preRun(mod: any) {
        let stdinOffset = 0;
        // https://emscripten.org/docs/api_reference/Filesystem-API.html#FS.init
        mod.FS.init(
          () => (stdinOffset < stdin.length ? stdin[stdinOffset++] : null),
          (charCode: number | null) => {
            postMessage({ type: "stdout", charCode });
          },
          (charCode: number | null) => {
            postMessage({ type: "stderr", charCode });
          },
        );
      },
    });

    for (const [filePath, content] of Object.entries(inputFiles)) {
      module.FS.writeFile(filePath, content);
    }

    const exitCode = module.callMain(args) as number;

    const outputFiles: Result["outputFiles"] = {};
    const transferables: Transferable[] = [];
    for (const filePath of outputFilePaths) {
      const fileData = module.FS.readFile(filePath) as Uint8Array<ArrayBuffer>;
      outputFiles[filePath] = fileData;
      transferables.push(fileData.buffer);
    }

    postMessage(
      {
        type: "complete",
        result: { exitCode, outputFiles },
      },
      transferables,
    );
  },
);
