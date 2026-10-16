import { test } from "node:test";
import assert from "node:assert/strict";
import { Compiler, CompilerError } from "../dist/index.js";

// Validation runs before Docker is touched, so these work anywhere
const compiler = new Compiler({ dockerPath: "/nonexistent/docker" });

const rejects = (options, pattern) =>
    assert.rejects(compiler.run(options), (err) => {
        assert.ok(err instanceof CompilerError);
        assert.equal(err.code, "INVALID_INPUT");
        if (pattern) assert.match(err.message, pattern);
        return true;
    });

const main = { name: "main.c", content: "int main(){return 0;}" };

test("rejects unknown languages", () => rejects({ language: "python", files: [main] }, /Unsupported language/));

test("rejects paths that could escape the work dir", async () => {
    for (const name of ["../x.c", "a/../../b.c", "-o.c", "lib/-x.h", "a\0.c", "..", " a.c", "a$(id).c"]) {
        await rejects({ language: "c", files: [main, { name, content: "" }] });
    }
});

test("keeps absolute paths inside the work dir", async () => {
    const { normalizePath } = await import("../dist/validate.js");
    assert.equal(normalizePath("/etc/passwd.c"), "etc/passwd.c");
    assert.equal(normalizePath("./src//lib\\x.h"), "src/lib/x.h");
    assert.equal(normalizePath("My Code/main file.c"), "My Code/main file.c");
});

test("rejects an entry file in the wrong language", () =>
    rejects({ language: "c", files: [{ name: "main.cpp", content: "" }] }, /not a C source file/));

test("rejects unsupported file types", () =>
    rejects({ language: "c", files: [main, { name: "evil.so", content: "" }] }, /Unsupported file type/));

test("rejects duplicate files", () =>
    rejects({ language: "c", files: [main, { name: "./main.c", content: "" }] }, /Duplicate/));

test("rejects too many and too large files", async () => {
    await rejects({ language: "c", files: [] });
    const big = new Compiler({ limits: { maxSourceBytes: 10 } });
    await assert.rejects(big.run({ language: "c", files: [main] }), /too large/);
});

test("only allows safe compiler flags", async () => {
    for (const flag of ["-o/etc/x", "-fplugin=x.so", "-B/tmp", "-Wl,-rpath", "@file", "-include/etc/shadow", "-DX=$(id)"]) {
        await rejects({ language: "c", files: [main], flags: [flag] }, /not allowed/);
    }
});

test("accepts valid input and only then needs Docker", async () => {
    await assert.rejects(
        compiler.run({
            language: "cpp",
            files: [{ name: "src/main.cpp", content: "" }, { name: "./include/util.hpp", content: "" }],
            flags: ["-O0", "-std=c++17", "-DDEBUG=1", "-Wall"],
            stdin: "1 2",
        }),
        (err) => err instanceof CompilerError && err.code === "DOCKER_UNAVAILABLE",
    );
});
