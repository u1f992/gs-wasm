import createModule, { type Instance as RawInstance, type MainModule } from "./gs.js";

export type { Revision } from "./gs.js";

export type StdioCallback = (buf: Uint8Array) => number | Promise<number>;

export interface Instance extends Omit<RawInstance, "setStdio" | "initWithArgs" | "exit"> {
  setStdio(
    stdin: StdioCallback | null,
    stdout: StdioCallback | null,
    stderr: StdioCallback | null,
  ): number;
  initWithArgs(argv: string[]): number | Promise<number>;
  exit(): number | Promise<number>;
}

export type Module = Omit<MainModule, "Instance"> & {
  Instance: { new (): Instance };
};

export default createModule as () => Promise<Module>;
