import fs from "node:fs";
import path from "node:path";

import type { FileOps, FileSystem } from "./gs.js";

const SEEK_SET = 0;
const SEEK_CUR = 1;
const SEEK_END = 2;

function hostFile(fd: number, mode: string): FileOps {
  const stat = fs.fstatSync(fd);
  let position = mode.startsWith("a") ? stat.size : 0;
  let atEof = false;
  let failed = false;

  const readAt = (buf: Uint8Array, offset: number) => {
    try {
      return fs.readSync(fd, buf, 0, buf.length, offset);
    } catch {
      failed = true;
      return -1;
    }
  };
  const writeAt = (buf: Uint8Array, offset: number) => {
    try {
      return fs.writeSync(fd, buf, 0, buf.length, offset);
    } catch {
      failed = true;
      return -1;
    }
  };

  return {
    read(buf) {
      const n = readAt(buf, position);
      if (n > 0) {
        position += n;
      }
      if (n < buf.length) {
        atEof = true;
      }
      return n;
    },
    write(buf) {
      const n = writeAt(buf, position);
      if (n > 0) {
        position += n;
      }
      return n;
    },
    seek(offset, whence) {
      const base =
        whence === SEEK_SET
          ? 0
          : whence === SEEK_CUR
            ? position
            : whence === SEEK_END
              ? fs.fstatSync(fd).size
              : -1;
      if (base < 0 || base + offset < 0) {
        return -1;
      }
      position = base + offset;
      atEof = false;
      return 0;
    },
    tell: () => position,
    eof: () => atEof,
    seekable: () => stat.isFile(),
    pread: readAt,
    pwrite: writeAt,
    ferror: () => failed,
    clearerr() {
      failed = false;
      atEof = false;
    },
    close() {
      try {
        fs.closeSync(fd);
        return 0;
      } catch {
        return -1;
      }
    },
  };
}

export function hostFileSystem(cwd: string = process.cwd()): FileSystem {
  const openFile = (fname: string, mode: string) => {
    let fd: number;
    try {
      fd = fs.openSync(path.resolve(cwd, fname), mode.replace(/[bt]/g, ""));
    } catch {
      return null;
    }
    return hostFile(fd, mode);
  };
  return {
    open_file: openFile,
    open_printer: (fname, binary) =>
      fname.startsWith("|") ? null : openFile(fname, binary ? "wb" : "w"),
  };
}
