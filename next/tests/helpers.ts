import createModule, { type Instance, type MainModule } from "../gs.js";

export const interpreterArgs = ["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=nullpage"];

export async function withInstance<T>(
  run: (gs: MainModule, instance: Instance) => Promise<T>,
): Promise<T> {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    return await run(gs, instance);
  } finally {
    instance.delete();
  }
}

export function collector() {
  const bytes: number[] = [];
  const write = (buf: Uint8Array) => {
    bytes.push(...buf);
    return buf.length;
  };
  const text = () => new TextDecoder().decode(new Uint8Array(bytes));
  return { write, text };
}

export function reader(text: string) {
  const data = new TextEncoder().encode(text);
  let offset = 0;
  return (buf: Uint8Array) => {
    const chunk = data.subarray(offset, offset + buf.length);
    buf.set(chunk);
    offset += chunk.length;
    return chunk.length;
  };
}

export function rgb8Format(gs: MainModule) {
  return gs.DISPLAY_COLORS_RGB | gs.DISPLAY_ALPHA_NONE | gs.DISPLAY_DEPTH_8 | gs.DISPLAY_BIGENDIAN;
}

export function displayArgs(format: number, program: string) {
  return [
    "gs",
    "-dQUIET",
    "-dNOPAUSE",
    "-dBATCH",
    "-sDEVICE=display",
    `-dDisplayFormat=${format}`,
    "-g4x2",
    "-r72",
    "-c",
    program,
  ];
}
