import Worker from "web-worker";
import type {
  Arguments,
  MessageFromMain,
  MessageFromWorker,
  Result,
} from "./message.js";
import {
  STATUS_INPUT_REQUESTED,
  STATUS_DATA_READY,
  STATUS_EOF,
} from "./status.js";

export type Options = {
  onStdin: () => number | null | Promise<number | null>;
  onStdout: (charCode: number | null) => void | Promise<void>;
  onStderr: (charCode: number | null) => void | Promise<void>;
  transfer: Transferable[];
} & Arguments;

export async function gs({
  args,
  inputFiles,
  outputFilePaths,
  onStdin,
  onStdout,
  onStderr,
  transfer,
}: Partial<Options>): Promise<Result> {
  args ??= [];
  inputFiles ??= {};
  outputFilePaths ??= [];
  onStdin ??= () => null;
  onStdout ??= () => {};
  onStderr ??= () => {};
  transfer ??= [];

  const worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  // Layout: [status:int32, data:int32] = 8 bytes total
  // We must use Int32Array (not Uint8Array) because Atomics.wait() and Atomics.notify()
  // only work with Int32Array or BigInt64Array
  // @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Atomics/notify
  // @see https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait
  const sharedBuffer = new SharedArrayBuffer(8);
  const statusArray = new Int32Array(sharedBuffer, 0, 1); // 0 (initial), STATUS_*
  const dataArray = new Int32Array(sharedBuffer, 4, 1); // 0-255

  let checkInterval: ReturnType<typeof setInterval> | null = null;
  let lastOutputPromise: Promise<void> = Promise.resolve();
  let lastErrorPromise: Promise<void> = Promise.resolve();

  const cleanup = async () => {
    if (checkInterval !== null) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    await Promise.all([lastOutputPromise, lastErrorPromise]);
    worker.terminate();
  };

  return new Promise<Result>((resolve, reject) => {
    worker.addEventListener(
      "message",
      async (e: MessageEvent<MessageFromWorker>) => {
        const { type, data } = e.data;
        switch (type) {
          case "ready":
            worker.postMessage(
              {
                type: "start",
                data: { args, inputFiles, outputFilePaths },
              } satisfies MessageFromMain,
              transfer,
            );

            // Monitor for input requests in a separate thread-like loop
            checkInterval = setInterval(
              (() => {
                // Prevent concurrent execution
                // This flag is safe in JavaScript's single-threaded environment.
                // setInterval callbacks are queued and executed sequentially, not concurrently.
                let isProcessingInput = false;
                return async () => {
                  if (isProcessingInput) {
                    return;
                  }

                  if (Atomics.load(statusArray, 0) === STATUS_INPUT_REQUESTED) {
                    isProcessingInput = true;
                    try {
                      const byte = await onStdin();
                      if (byte === null) {
                        Atomics.store(statusArray, 0, STATUS_EOF);
                        Atomics.notify(statusArray, 0);
                      } else {
                        Atomics.store(dataArray, 0, byte & 0xff);
                        Atomics.store(statusArray, 0, STATUS_DATA_READY);
                        Atomics.notify(statusArray, 0);
                      }
                    } finally {
                      isProcessingInput = false;
                    }
                  }
                };
              })(),
              1,
            );
            break;

          case "stdout":
            lastOutputPromise = lastOutputPromise.then(() => onStdout(data));
            break;

          case "stderr":
            lastErrorPromise = lastErrorPromise.then(() => onStderr(data));
            break;

          case "complete":
            await cleanup();
            resolve(data);
            break;
        }
      },
    );

    worker.addEventListener("error", async (error) => {
      await cleanup();
      reject(new Error(`Worker error: ${error.message}`));
    });

    worker.postMessage({
      type: "init",
      data: sharedBuffer,
    } satisfies MessageFromMain);
  });
}
