// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Module from "./gs.js";
import type { MessageFromMain, MessageFromWorker, Result } from "./message.js";
import {
  STATUS_INPUT_REQUESTED,
  STATUS_DATA_READY,
  STATUS_FLUSH,
} from "./status.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let moduleInstance: any = null;

addEventListener("message", async (e: MessageEvent<MessageFromMain>) => {
  const { type, data } = e.data;
  switch (type) {
    case "init":
      moduleInstance = await Module({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preRun(mod: any) {
          // https://emscripten.org/docs/api_reference/Filesystem-API.html#FS.init
          mod.FS.init(
            (() => {
              const sharedBuffer = data;
              const statusArray = new Int32Array(sharedBuffer, 0, 1);
              const dataArray = new Int32Array(sharedBuffer, 4, 1);
              return () => {
                Atomics.store(statusArray, 0, STATUS_INPUT_REQUESTED);
                self.postMessage({ type: "stdin" } as MessageFromWorker);
                Atomics.wait(statusArray, 0, STATUS_INPUT_REQUESTED);

                const status = Atomics.load(statusArray, 0);
                if (status === STATUS_DATA_READY) {
                  return Atomics.load(dataArray, 0);
                } else if (status === STATUS_FLUSH) {
                  return null;
                }
                return null;
              };
            })(),
            (charCode: number | null) => {
              self.postMessage({
                type: "stdout",
                data: charCode,
              } satisfies MessageFromWorker);
            },
            (charCode: number | null) => {
              self.postMessage({
                type: "stderr",
                data: charCode,
              } satisfies MessageFromWorker);
            },
          );
        },
      });
      self.postMessage({ type: "ready" } satisfies MessageFromWorker);
      break;

    case "start": {
      const { args, inputFiles, outputFilePaths } = data;
      for (const [filePath, content] of Object.entries(inputFiles)) {
        moduleInstance.FS.writeFile(filePath, content);
      }

      const exitCode = moduleInstance.callMain(args) as number;

      const outputFiles: Result["outputFiles"] = {};
      const transferables: Transferable[] = [];
      for (const filePath of outputFilePaths) {
        const fileData = moduleInstance.FS.readFile(
          filePath,
        ) as Uint8Array<ArrayBuffer>;
        outputFiles[filePath] = fileData;
        transferables.push(fileData.buffer);
      }

      self.postMessage(
        {
          type: "complete",
          data: { exitCode, outputFiles },
        } satisfies MessageFromWorker,
        transferables,
      );
      break;
    }
  }
});
