# @u1f992/gs-wasm

WASM build variant of [ArtifexSoftware/ghostpdl 10.06.0](https://github.com/ArtifexSoftware/ghostpdl/tree/ghostpdl-10.06.0).

## Usage

See [src/index.test.ts](src/index.test.ts) for usage examples.

A CLI `gs-wasm` is also available.

```bash
$ npx --yes @u1f992/gs-wasm --version
```

Use `--` separator to specify input and output files that should be transferred between the host filesystem and the WASM in-memory FS.

```bash
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=output.png input.pdf -- -i input.pdf -o output.png

# Long options
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=ps2write -sOutputFile=output.ps input.pdf -- --input input.pdf --output output.ps

# Path mapping
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=ps2write -sOutputFile=output.ps input.pdf -- -i actual-path.pdf:input.pdf -o output.ps:actual-path.ps
```
