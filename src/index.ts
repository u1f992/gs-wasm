import Worker from "web-worker";
import type {
  Arguments,
  MessageFromMain,
  MessageFromWorker,
  Result,
} from "./message.js";
import { STATUS_DATA_READY, STATUS_EOF } from "./status.js";

export type Options = {
  onStdin: () => number | null | Promise<number | null>;
  onStdout: (charCode: number | null) => void | Promise<void>;
  onStderr: (charCode: number | null) => void | Promise<void>;
  transfer: Transferable[];
  signal: AbortSignal;
} & Arguments;

class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}

class WorkerError extends Error {
  constructor(e: ErrorEvent) {
    super(e.message);
    this.name = "WorkerError";
  }
}

export async function gs({
  args,
  inputFiles,
  outputFilePaths,
  onStdin,
  onStdout,
  onStderr,
  transfer,
  signal,
}: Partial<Options>): Promise<Result> {
  args ??= [];
  inputFiles ??= {};
  outputFilePaths ??= [];
  onStdin ??= () => null;
  onStdout ??= () => {};
  onStderr ??= () => {};
  transfer ??= [];

  if (signal?.aborted) {
    return Promise.reject(new AbortError());
  }

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

  let lastOutputPromise: Promise<void> = Promise.resolve();
  let lastErrorPromise: Promise<void> = Promise.resolve();
  let onAbort: (() => Promise<void>) | null = null;

  const cleanup = async () => {
    worker.terminate();
    await Promise.all([lastOutputPromise, lastErrorPromise]);
    if (onAbort) {
      signal?.removeEventListener("abort", onAbort);
      onAbort = null;
    }
  };

  return new Promise<Result>((resolve, reject) => {
    signal?.addEventListener(
      "abort",
      (onAbort = async () => {
        await cleanup();
        reject(new AbortError());
      }),
    );

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
            break;

          case "stdin": {
            const byte = await onStdin();
            if (byte === null) {
              Atomics.store(statusArray, 0, STATUS_EOF);
            } else {
              Atomics.store(dataArray, 0, byte & 0xff);
              Atomics.store(statusArray, 0, STATUS_DATA_READY);
            }
            Atomics.notify(statusArray, 0);
            break;
          }

          case "stdout":
            lastOutputPromise = lastOutputPromise.then(() =>
              onStdout(data === null ? null : data & 0xff),
            );
            break;

          case "stderr":
            lastErrorPromise = lastErrorPromise.then(() =>
              onStderr(data === null ? null : data & 0xff),
            );
            break;

          case "complete":
            await cleanup();
            resolve(data);
            break;
        }
      },
    );

    worker.addEventListener("error", async (e) => {
      await cleanup();
      reject(new WorkerError(e));
    });

    worker.postMessage({
      type: "init",
      data: sharedBuffer,
    } satisfies MessageFromMain);
  });
}
