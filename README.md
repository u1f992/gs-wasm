# @u1f992/gs-wasm

Wasm binding of the [Ghostscript Interpreter API](https://github.com/ArtifexSoftware/ghostpdl/blob/ghostpdl-10.08.0/doc/src/API.rst), built from [ArtifexSoftware/ghostpdl 10.08.0](https://github.com/ArtifexSoftware/ghostpdl/tree/ghostpdl-10.08.0).

## Usage

The default export creates the module that carries the binding. See [src/index.ts](src/index.ts) for a usage example.

`main` runs Ghostscript as the `gs` command does and resolves to its exit status. It takes the arguments of `gs` and a function that configures the instance before Ghostscript starts. `hostFileSystem` from `@u1f992/gs-wasm/host-fs` serves the files of the host through Node.js.

```js
import { main } from "@u1f992/gs-wasm";
import { hostFileSystem } from "@u1f992/gs-wasm/host-fs";

const status = await main(
  ["-dNOPAUSE", "-dBATCH", "-sDEVICE=png16m", "-r150", "-sOutputFile=output.png", "input.pdf"],
  (instance) => {
    instance.addFs(hostFileSystem());
  },
);
```

A CLI `gs-wasm` is also available. It takes the same arguments as `gs`.

```bash
$ npx --yes @u1f992/gs-wasm --version
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=output.png input.pdf
$ echo "(hello) print flush" | npx --yes @u1f992/gs-wasm -dQUIET -dNOPAUSE -dBATCH -sDEVICE=nullpage -
```
