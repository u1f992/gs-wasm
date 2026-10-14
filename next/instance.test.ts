import assert from "node:assert";
import test from "node:test";

import createModule from "./gs.js";

await test("constructor and delete", async () => {
  const gs = await createModule();

  const instance = new gs.Instance();
  assert.strictEqual(instance.isDeleted(), false);
  instance.delete();
  assert.strictEqual(instance.isDeleted(), true);

  const again = new gs.Instance();
  again.delete();
});

await test("setStdio captures stdout", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    assert.strictEqual(
      instance.setStdio(
        null,
        (buf: Uint8Array) => {
          stdout.push(...buf);
          return buf.length;
        },
        null,
      ),
      0,
    );
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "10.08.0\n");
});

await test("setStdio captures stderr", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stderr: number[] = [];
  try {
    instance.setStdio(null, null, (buf: Uint8Array) => {
      stderr.push(...buf);
      return buf.length;
    });
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-c",
        "(%stderr) (w) file dup (oops) writestring flushfile",
      ]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stderr)), "oops");
});

await test("setStdio feeds stdin", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  const stdin = new TextEncoder().encode("(hello) print flush\n");
  let offset = 0;
  try {
    instance.setStdio(
      (buf: Uint8Array) => {
        const chunk = stdin.subarray(offset, offset + buf.length);
        buf.set(chunk);
        offset += chunk.length;
        return chunk.length;
      },
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-",
      ]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hello");
});

await test("setStdio accepts callbacks returning promises", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  const stdin = new TextEncoder().encode("(hello) print flush\n");
  let offset = 0;
  try {
    instance.setStdio(
      async (buf: Uint8Array) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        const chunk = stdin.subarray(offset, offset + buf.length);
        buf.set(chunk);
        offset += chunk.length;
        return chunk.length;
      },
      async (buf: Uint8Array) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=nullpage",
        "-",
      ]),
      gs.gs_error_Quit,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hello");
});

await test("initWithArgs and exit", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=nullpage"]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs --version returns gs_error_Info", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(await instance.initWithArgs(["gs", "--version"]), gs.gs_error_Info);
  } finally {
    instance.delete();
  }
});

await test("initWithArgs throws on an unknown device", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    await assert.rejects(
      async () => instance.initWithArgs(["gs", "-dQUIET", "-sDEVICE=nosuchdevice"]),
      /^Error: gsapi_init_with_args returned -\d+$/,
    );
  } finally {
    instance.delete();
  }
});

const interpreterArgs = ["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=nullpage"];

await test("runString", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runString("(hi) print flush", -1), {
      code: 0,
      exitCode: 0,
    });
    const { code } = await instance.runString("1 0 div", -1);
    assert.ok(code < 0 && code > gs.gs_error_Fatal, `code: ${code}`);
    assert.deepStrictEqual(await instance.runString("quit", -1), {
      code: gs.gs_error_Quit,
      exitCode: 0,
    });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "hi");
});

await test("runStringBegin, runStringContinue and runStringEnd", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runStringBegin(-1), { code: 0, exitCode: 0 });
    assert.deepStrictEqual(await instance.runStringContinue("(a) pri", -1), {
      code: gs.gs_error_NeedInput,
      exitCode: 0,
    });
    assert.deepStrictEqual(await instance.runStringContinue("nt flush\n", -1), {
      code: gs.gs_error_NeedInput,
      exitCode: 0,
    });
    assert.deepStrictEqual(await instance.runStringEnd(-1), { code: 0, exitCode: 0 });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "a");
});

await test("runStringWithLength accepts bytes", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    const program = new TextEncoder().encode("(b) print flush");
    assert.deepStrictEqual(await instance.runStringWithLength(program, -1), {
      code: 0,
      exitCode: 0,
    });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "b");
});

await test("setPoll", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(
      instance.setPoll(() => 0),
      0,
    );
    assert.strictEqual(instance.setPoll(null), 0);
  } finally {
    instance.delete();
  }
});

await test("setDisplayCallback", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const events: string[] = [];
  let image: Uint8Array | null = null;
  let snapshot: Uint8Array | null = null;
  let size: [number, number, number] | null = null;
  const format =
    gs.DISPLAY_COLORS_RGB | gs.DISPLAY_ALPHA_NONE | gs.DISPLAY_DEPTH_8 | gs.DISPLAY_BIGENDIAN;
  try {
    assert.strictEqual(
      instance.setDisplayCallback({
        display_open: () => {
          events.push("open");
          return 0;
        },
        display_preclose: () => {
          events.push("preclose");
          return 0;
        },
        display_close: () => {
          events.push("close");
          return 0;
        },
        display_presize: () => {
          events.push("presize");
          return 0;
        },
        display_size: (_device, width, height, raster, actualFormat, pimage) => {
          events.push("size");
          assert.strictEqual(actualFormat, format);
          size = [width, height, raster];
          image = pimage;
          return 0;
        },
        display_sync: () => {
          events.push("sync");
          return 0;
        },
        display_page: async () => {
          events.push("page");
          snapshot = image!.slice();
          return 0;
        },
      }),
      0,
    );
    assert.strictEqual(
      await instance.initWithArgs([
        "gs",
        "-dQUIET",
        "-dNOPAUSE",
        "-dBATCH",
        "-sDEVICE=display",
        `-dDisplayFormat=${format}`,
        "-g4x2",
        "-r72",
        "-c",
        "0 0 1 setrgbcolor 0 0 2 2 rectfill showpage",
      ]),
      0,
    );
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(instance.setDisplayCallback(null), 0);
  } finally {
    instance.delete();
  }
  assert.deepStrictEqual(events.slice(0, 3), ["open", "presize", "size"]);
  assert.ok(events.includes("page"), events.join(" "));
  assert.deepStrictEqual(events.slice(-2), ["preclose", "close"]);
  const [width, height, raster] = size!;
  assert.deepStrictEqual([width, height], [4, 2]);
  assert.ok(raster >= 12);
  const pixel = (x: number, y: number) =>
    Array.from(snapshot!.subarray(y * raster + x * 3, y * raster + x * 3 + 3));
  assert.deepStrictEqual(pixel(0, 1), [0, 0, 255]);
  assert.deepStrictEqual(pixel(3, 0), [255, 255, 255]);
});

await test("registerCallout and deregisterCallout", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const calls: [string, number, number, number][] = [];
  const callout = (deviceName: string, id: number, size: number, data: Uint8Array) => {
    calls.push([deviceName, id, size, data.length]);
    return -1;
  };
  try {
    assert.strictEqual(instance.registerCallout(callout), 0);
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=display"]),
      0,
    );
    assert.deepStrictEqual(calls.slice(0, 2), [
      ["display", gs.DISPLAY_CALLOUT_GET_CALLBACK, 8, 8],
      ["display", gs.DISPLAY_CALLOUT_GET_CALLBACK_LEGACY, 8, 8],
    ]);
    calls.length = 0;
    instance.deregisterCallout(callout);
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.deepStrictEqual(calls, []);
});

await test("setDefaultDeviceList and getDefaultDeviceList", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(typeof instance.getDefaultDeviceList(), "string");
    assert.strictEqual(instance.setDefaultDeviceList("nullpage bbox"), 0);
    assert.strictEqual(instance.getDefaultDeviceList(), "nullpage bbox");
  } finally {
    instance.delete();
  }
});

await test("setArgEncoding", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(instance.setArgEncoding(gs.GS_ARG_ENCODING_UTF8), 0);
  } finally {
    instance.delete();
  }
});

await test("setParam and getParam", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(
      await instance.initWithArgs(["gs", "-dQUIET", "-dNOPAUSE", "-sDEVICE=png16m"]),
      0,
    );
    assert.deepStrictEqual(instance.getParam("TextAlphaBits", gs.gs_spt_int), {
      code: 4,
      value: 1,
    });
    assert.strictEqual(await instance.setParam("TextAlphaBits", 4, gs.gs_spt_int), 0);
    assert.deepStrictEqual(instance.getParam("TextAlphaBits", gs.gs_spt_int), {
      code: 4,
      value: 4,
    });
    assert.strictEqual(await instance.setParam("HWResolution", "[150 150]", gs.gs_spt_parsed), 0);
    assert.deepStrictEqual(instance.getParam("HWResolution", gs.gs_spt_parsed), {
      code: 10,
      value: "[150 150]",
    });
    assert.strictEqual(await instance.setParam("OutputFile", "/out.png", gs.gs_spt_string), 0);
    assert.deepStrictEqual(instance.getParam("OutputFile", gs.gs_spt_string), {
      code: 9,
      value: "/out.png",
    });
    assert.deepStrictEqual(instance.getParam("Name", gs.gs_spt_name), {
      code: 7,
      value: "png16m",
    });
    assert.deepStrictEqual(instance.getParam("NoSuchParameter", gs.gs_spt_int), {
      code: gs.gs_error_undefined,
      value: null,
    });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("enumerateParams", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    const keys: string[] = [];
    for (;;) {
      const { code, key, type } = instance.enumerateParams();
      if (code !== 0) {
        assert.strictEqual(code, 1);
        break;
      }
      assert.notStrictEqual(type, gs.gs_spt_invalid);
      keys.push(key);
    }
    assert.ok(keys.includes("HWResolution"), keys.join(" "));
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("control paths", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  try {
    assert.strictEqual(instance.isPathControlActive(), false);
    assert.strictEqual(instance.addControlPath(gs.GS_PERMIT_FILE_READING, "/allowed/"), 0);
    assert.strictEqual(instance.removeControlPath(gs.GS_PERMIT_FILE_READING, "/allowed/"), 0);
    instance.purgeControlPaths(gs.GS_PERMIT_FILE_READING);
    instance.activatePathControl(true);
    assert.strictEqual(instance.isPathControlActive(), true);
  } finally {
    instance.delete();
  }
});

await test("addFs and removeFs", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  const opened: string[] = [];
  const content = new TextEncoder().encode("(v) print flush\n");
  const fs = {
    open_file(fname: string, mode: string) {
      if (fname !== "/virtual/program.ps") {
        return null;
      }
      opened.push(mode);
      let position = 0;
      return {
        read: (buf: Uint8Array) => {
          const chunk = content.subarray(position, position + buf.length);
          buf.set(chunk);
          position += chunk.length;
          return chunk.length;
        },
        write: () => -1,
        seek: (offset: number, whence: number) => {
          position =
            whence === 0 ? offset : whence === 1 ? position + offset : content.length + offset;
          return 0;
        },
        tell: () => position,
        eof: () => position >= content.length,
        seekable: () => true,
        close: () => {
          opened.push("closed");
          return 0;
        },
      };
    },
  };
  try {
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(instance.addFs(fs), 0);
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runFile("/virtual/program.ps", -1), {
      code: 0,
      exitCode: 0,
    });
    assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "v");
    assert.deepStrictEqual(opened, ["r", "closed"]);
    instance.removeFs(fs);
    const { code } = await instance.runFile("/virtual/program.ps", -1);
    assert.ok(code < 0, `code: ${code}`);
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
});

await test("runFile", async () => {
  const gs = await createModule();
  const instance = new gs.Instance();
  const stdout: number[] = [];
  try {
    gs.FS.writeFile("/program.ps", "(c) print flush\n");
    instance.setStdio(
      null,
      (buf: Uint8Array) => {
        stdout.push(...buf);
        return buf.length;
      },
      null,
    );
    assert.strictEqual(await instance.initWithArgs(interpreterArgs), 0);
    assert.deepStrictEqual(await instance.runFile("/program.ps", -1), { code: 0, exitCode: 0 });
    assert.strictEqual(await instance.exit(), 0);
  } finally {
    instance.delete();
  }
  assert.strictEqual(new TextDecoder().decode(new Uint8Array(stdout)), "c");
});
