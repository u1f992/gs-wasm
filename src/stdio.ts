import type { Readable, Writable } from "node:stream";

export function stdinReader(stream: Readable) {
  const chunks: Uint8Array[] = [];
  let ended = false;
  let wake: (() => void) | undefined;
  stream.on("data", (chunk: Uint8Array) => {
    chunks.push(chunk);
    stream.pause();
    wake?.();
  });
  stream.on("end", () => {
    ended = true;
    wake?.();
  });
  stream.on("error", () => {
    ended = true;
    wake?.();
  });
  stream.pause();

  return async (buf: Uint8Array) => {
    while (chunks.length === 0 && !ended) {
      stream.resume();
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      wake = undefined;
    }
    const chunk = chunks[0];
    if (chunk === undefined) {
      return 0;
    }
    const n = Math.min(chunk.length, buf.length);
    buf.set(chunk.subarray(0, n));
    if (n === chunk.length) {
      chunks.shift();
    } else {
      chunks[0] = chunk.subarray(n);
    }
    return n;
  };
}

export function streamWriter(stream: Writable) {
  return (buf: Uint8Array) => {
    const length = buf.length;
    if (stream.write(Buffer.from(buf))) {
      return length;
    }
    return new Promise<number>((resolve) => {
      stream.once("drain", () => resolve(length));
    });
  };
}
