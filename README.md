# @u1f992/gs-wasm

Wasm binding of the [Ghostscript Interpreter API](https://github.com/ArtifexSoftware/ghostpdl/blob/ghostpdl-10.08.0/doc/src/API.rst), built from [ArtifexSoftware/ghostpdl 10.08.0](https://github.com/ArtifexSoftware/ghostpdl/tree/ghostpdl-10.08.0).

## Usage

See [src/cli.ts](src/cli.ts) for a usage example.

A CLI `gs-wasm` is also available. It takes the same arguments as `gs`.

```bash
$ npx --yes @u1f992/gs-wasm --version
$ npx --yes @u1f992/gs-wasm -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile=output.png input.pdf
$ echo "(hello) print flush" | npx --yes @u1f992/gs-wasm -dQUIET -dNOPAUSE -dBATCH -sDEVICE=nullpage -
```
