import createModule, { type Instance, type MainModule } from "./gs.js";

export { default } from "./gs.js";
export type * from "./gs.js";

function returnedCode(error: unknown): number {
  const code = error instanceof Error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "number") {
    return code;
  }
  throw error;
}

/**
 * Runs Ghostscript as the `gs` command does, on a module and an instance of
 * its own.
 *
 * @param args Arguments of `gs`, without the program name.
 * @param configure Called with the instance and its module before Ghostscript
 * starts, to set up standard I/O, file systems and whatever else the run
 * needs.
 * @returns The exit status of `gs`: 0 on success, 1 on a fatal error and 255
 * on any other error.
 */
export async function main(
  args: string[],
  configure?: (instance: Instance, gs: MainModule) => void | Promise<void>,
): Promise<number> {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    instance.setArgEncoding(gs.GS_ARG_ENCODING_UTF8);
    await configure?.(instance, gs);

    let code: number;
    try {
      code = await instance.initWithArgs(["gs", ...args]);
      if (code === 0) {
        code = (await instance.runString("systemdict /start get exec\n", 0)).code;
      }
    } catch (error) {
      code = returnedCode(error);
    }

    let exitResult: number;
    try {
      exitResult = await instance.exit();
    } catch (error) {
      exitResult = returnedCode(error);
    }
    if (code === 0 || code === gs.gs_error_Quit) {
      code = exitResult;
    }

    return code === 0 || code === gs.gs_error_Info || code === gs.gs_error_Quit
      ? 0
      : code === gs.gs_error_Fatal
        ? 1
        : 255;
  } finally {
    instance.delete();
  }
}
