import assert from "node:assert";
import test from "node:test";

import { displayArgs, rgb8Format, withInstance } from "./helpers.ts";

const program = "0 0 1 setrgbcolor 0 0 2 2 rectfill showpage";

await test("setDisplayCallback", async () => {
  await withInstance(async (gs, instance) => {
    const format = rgb8Format(gs);
    const events: string[] = [];
    let image = 0;
    let snapshot: Uint8Array | null = null;
    let size: [number, number, number] | null = null;
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
          const [, height, raster] = size!;
          snapshot = gs.HEAPU8.slice(image, image + raster * height);
          return 0;
        },
      }),
      0,
    );
    assert.strictEqual(await instance.initWithArgs(displayArgs(format, program)), 0);
    assert.strictEqual(await instance.exit(), 0);
    assert.strictEqual(instance.setDisplayCallback(null), 0);

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
});

await test("display_memalloc and display_memfree", async () => {
  await withInstance(async (gs, instance) => {
    const allocated: number[] = [];
    const freed: number[] = [];
    instance.setDisplayCallback({
      display_memalloc: (_device, size) => {
        const mem = gs._malloc(size);
        allocated.push(mem);
        return mem;
      },
      display_memfree: (_device, mem) => {
        freed.push(mem);
        gs._free(mem);
        return 0;
      },
    });
    assert.strictEqual(await instance.initWithArgs(displayArgs(rgb8Format(gs), "showpage")), 0);
    assert.strictEqual(await instance.exit(), 0);
    assert.ok(allocated.length > 0);
    assert.ok(allocated.every((mem) => mem !== 0));
    assert.deepStrictEqual(freed, allocated);
  });
});

await test("display_rectangle_request", async () => {
  await withInstance(async (gs, instance) => {
    const requests: [number, number][] = [];
    let buffer = 0;
    let bufferRaster = 0;
    let pages = 0;
    instance.setDisplayCallback({
      display_memalloc: () => 0,
      display_memfree: () => 0,
      display_page: () => {
        pages += 1;
        return 0;
      },
      display_rectangle_request: (_device, raster, plane_raster) => {
        requests.push([raster, plane_raster]);
        if (requests.length > 1) {
          return null;
        }
        bufferRaster = raster;
        buffer = gs._malloc(raster * 2);
        return { memory: buffer, x: 0, y: 0, w: 4, h: 2 };
      },
    });
    assert.strictEqual(await instance.initWithArgs(displayArgs(rgb8Format(gs), program)), 0);
    assert.strictEqual(pages, 0);
    assert.strictEqual(requests.length, 2);
    const pixel = (x: number, y: number) =>
      Array.from(
        gs.HEAPU8.subarray(
          buffer + y * bufferRaster + x * 3,
          buffer + y * bufferRaster + x * 3 + 3,
        ),
      );
    assert.deepStrictEqual(pixel(0, 1), [0, 0, 255]);
    assert.deepStrictEqual(pixel(3, 0), [255, 255, 255]);
    gs._free(buffer);
    assert.strictEqual(await instance.exit(), 0);
  });
});
