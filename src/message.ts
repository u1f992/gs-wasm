type InitMessageFromMain = {
  type: "init";
  data: SharedArrayBuffer;
};
type ReadyMessageFromWorker = { type: "ready"; data?: undefined };
export type Arguments = {
  args: string[];
  inputFiles: Record<string, Uint8Array<ArrayBufferLike>>;
  outputFilePaths: string[];
};
type StartMessageFromMain = { type: "start"; data: Arguments };
type StdoutMessageFromWorker = {
  type: "stdout";
  data: number | null;
};
type StderrMessageFromWorker = {
  type: "stderr";
  data: number | null;
};
export type Result = {
  exitCode: number;
  outputFiles: Record<string, Uint8Array<ArrayBuffer>>;
};
type CompleteMessageFromWorker = {
  type: "complete";
  data: Result;
};

export type MessageFromMain = InitMessageFromMain | StartMessageFromMain;
export type MessageFromWorker =
  | ReadyMessageFromWorker
  | StdoutMessageFromWorker
  | StderrMessageFromWorker
  | CompleteMessageFromWorker;
