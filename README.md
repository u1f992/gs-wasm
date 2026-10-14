# @u1f992/gs-wasm

WASM build variant of [ArtifexSoftware/ghostpdl 10.08.0](https://github.com/ArtifexSoftware/ghostpdl/tree/ghostpdl-10.08.0).

## Usage

See [src/cli.ts](src/cli.ts) for a usage example.

A CLI `gs-wasm` is also available. It takes the same arguments as `gs` and reads and writes files in the host filesystem.

```bash
$ npx --yes @u1f992/gs-wasm --version
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=output.png input.pdf
$ echo "(hello) print flush" | npx --yes @u1f992/gs-wasm -dQUIET -dNOPAUSE -dBATCH -sDEVICE=nullpage -
```
