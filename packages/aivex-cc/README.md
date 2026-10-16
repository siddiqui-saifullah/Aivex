# aivex-cc

Compile and run **untrusted C and C++ code** from Node.js, inside a locked-down
Docker container. It powers the Run button for C/C++ in [Aivex](../../README.md),
but has no Aivex-specific code and no runtime dependencies.

```ts
import { Compiler } from "aivex-cc";

const cc = new Compiler();               // uses the gcc:14 image
await cc.prepare();                      // pull the image once (optional)

const result = await cc.run({
    language: "cpp",                     // "c" | "cpp"
    files: [
        { name: "main.cpp", content: '#include "lib/math.hpp"\n...' },  // entry file first
        { name: "lib/math.hpp", content: "..." },
    ],
    stdin: "5\n",
    flags: ["-std=c++17", "-O0"],        // optional, allowlisted
    onStdout: (chunk) => process.stdout.write(chunk),   // optional streaming
});

result.compile;   // { stdout, stderr, code, signal, timedOut, truncated, durationMs }
result.run;       // same shape; undefined when compilation failed
result.version;   // "14.4.0"
```

`compileAndRun(options)` does the same with a shared default instance.

## CLI

```bash
npx aivex-cc main.c                         # language from the extension
echo "3 4" | npx aivex-cc main.cpp lib/util.cpp lib/util.hpp
npx aivex-cc --flag -std=c++17 --timeout 2000 main.cpp
```

## How it works

Each run uses two short-lived containers that share a temp directory:

1. **Compile.** `gcc`/`g++` writes `a.out` into the work dir.
2. **Run.** `a.out` runs with the work dir mounted **read-only**, with `stdin` piped in.

Both containers run with:

| Protection | Setting |
| --- | --- |
| No network | `--network none` |
| Unprivileged | `--user 65534` (nobody), `--cap-drop ALL`, `no-new-privileges` |
| Read-only filesystem | `--read-only`, plus a 64 MB tmpfs at `/tmp` |
| Memory | 512 MB to compile, 256 MB to run, no swap |
| CPU / processes | 1 CPU, 64 processes (stops fork bombs), 256 open files |
| Time | 15 s to compile, 5 s to run, enforced by the host and by `timeout` inside the container |
| Output | 64 KB per stream; the container is killed as soon as it's exceeded |

Inputs are checked before Docker is touched:
- File paths can't escape the work dir and can't look like compiler options.
- Only C/C++ sources and headers are accepted.
- Compiler flags must be on an allowlist (`-O*`, `-std=*`, `-D*`, warnings, `-lm`, `-pthread`...). Flags like `-fplugin`, `-B` or `-Wl,` are rejected.

At most `maxConcurrent` runs (default 4) execute at once. The rest queue, and
fail with `BUSY` after `queueTimeoutMs`.

## Options

```ts
new Compiler({
    image: "gcc:14",          // any image with gcc, g++ and coreutils `timeout`
    runtime: "runsc",         // e.g. gVisor, for a stronger kernel boundary
    maxConcurrent: 4,
    queueTimeoutMs: 30_000,
    workRoot: "/var/aivex-cc", // see "Deployment" below
    limits: { runTimeoutMs: 2_000, runMemoryMb: 128, maxOutputBytes: 1 << 20 },
});
```

Failures throw a `CompilerError` with a `code`:

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | The request was rejected (bad path, file type, flag or size). |
| `DOCKER_UNAVAILABLE` | Docker isn't installed or running, or the image is missing. |
| `BUSY` | The queue wait timed out. |
| `ABORTED` | The `signal` passed in was aborted. |

Compile errors and crashing programs are **not** errors. They come back in `result`.

## Deployment

- The host needs Docker, and the Node process needs access to the Docker
  daemon. **Access to the Docker socket is root-equivalent on that host**, so
  run this on a machine (or VM) that is dedicated to it. For extra isolation,
  install [gVisor](https://gvisor.dev) and set `runtime: "runsc"`.
- If the Node process itself runs in a container that uses the host's Docker
  socket, bind-mount paths are resolved **on the host**. Set `workRoot` to a
  directory that is mounted at the same path in both.

## Development

```bash
npm install     # also builds dist/
npm test        # validation tests always run; sandbox tests run when Docker is available
```
