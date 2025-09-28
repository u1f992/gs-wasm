import Worker from "web-worker";

export type Options = {
  args: string[];
  stdin: Uint8Array<ArrayBufferLike>;
  inputFiles: Record<string, Uint8Array<ArrayBufferLike>>;
  outputFilePaths: string[];
  onStdout?: (charCode: number | null) => void | Promise<void>;
  onStderr?: (charCode: number | null) => void | Promise<void>;
  transfer?: Transferable[];
};

export type Result = {
  exitCode: number;
  outputFiles: Record<string, Uint8Array<ArrayBuffer>>;
};

export async function gs({
  args,
  stdin,
  inputFiles,
  outputFilePaths,
  onStdout,
  onStderr,
  transfer,
}: Partial<Options>): Promise<Result> {
  args ??= [];
  stdin ??= new Uint8Array();
  inputFiles ??= {};
  outputFilePaths ??= [];
  onStdout ??= () => {};
  onStderr ??= () => {};
  transfer ??= [];

  const worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  return new Promise<Result>((resolve, reject) => {
    const pendingCallbacks: Promise<void>[] = [];

    worker.addEventListener("message", (e) => {
      const data = e.data as
        | { type: "stdout"; charCode: number | null }
        | { type: "stderr"; charCode: number | null }
        | { type: "complete"; result: Result };
      if (data.type === "stdout") {
        pendingCallbacks.push(Promise.resolve(onStdout(data.charCode)));
      } else if (data.type === "stderr") {
        pendingCallbacks.push(Promise.resolve(onStderr(data.charCode)));
      } else if (data.type === "complete") {
        Promise.all(pendingCallbacks).then(() => {
          worker.terminate();
          resolve(data.result);
        });
      }
    });
    worker.addEventListener("error", (error) => {
      worker.terminate();
      reject(new Error(`Worker error: ${error.message}`));
    });
    worker.postMessage(
      {
        args,
        stdin,
        inputFiles,
        outputFilePaths,
      },
      transfer,
    );
  });
}
