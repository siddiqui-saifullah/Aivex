import { test } from "node:test";
import assert from "node:assert/strict";
import { Compiler } from "../dist/index.js";

const compiler = new Compiler({ limits: { runTimeoutMs: 3_000, maxOutputBytes: 4096 } });
const skip = (await compiler.isAvailable()) ? false : "Docker is not available";
if (!skip) await compiler.prepare();

const c = (content, extra = {}) => compiler.run({ language: "c", files: [{ name: "main.c", content }], ...extra });

test("runs C with stdin", { skip }, async () => {
    const result = await c(`#include <stdio.h>
int main(void) { int a, b; scanf("%d %d", &a, &b); printf("%d\\n", a + b); return 3; }`, { stdin: "40 2" });
    assert.equal(result.compile.code, 0);
    assert.equal(result.run.stdout, "42\n");
    assert.equal(result.run.code, 3);
    assert.match(result.version, /^\d+\.\d+/);
});

test("runs multi-file C++ with headers in subfolders", { skip }, async () => {
    const result = await compiler.run({
        language: "cpp",
        files: [
            { name: "main.cpp", content: `#include <iostream>\n#include "lib/greet.hpp"\nint main() { std::cout << greet("Aivex") << std::endl; }` },
            { name: "lib/greet.hpp", content: `#pragma once\n#include <string>\nstd::string greet(const std::string&);` },
            { name: "lib/greet.cpp", content: `#include "greet.hpp"\nstd::string greet(const std::string& n) { return "Hello, " + n + "!"; }` },
        ],
    });
    assert.equal(result.compile.code, 0, result.compile.stderr);
    assert.equal(result.run.stdout, "Hello, Aivex!\n");
});

test("reports compile errors with project-relative paths", { skip }, async () => {
    const result = await c("int main(void) { return undefined_name; }");
    assert.notEqual(result.compile.code, 0);
    assert.equal(result.run, undefined);
    assert.match(result.compile.stderr, /^main\.c:1:\d+: error/m);
    assert.doesNotMatch(result.compile.stderr, /\/work\//);
});

test("kills programs that run too long", { skip }, async () => {
    const result = await c("int main(void) { for (;;) {} }");
    assert.equal(result.run.timedOut, true);
    assert.equal(result.run.signal, "SIGKILL");
    assert.ok(result.run.durationMs < 6_000);
});

test("reports crashes as signals", { skip }, async () => {
    const result = await c("int main(void) { volatile int *p = 0; return *p; }");
    assert.equal(result.run.code, null);
    assert.equal(result.run.signal, "SIGSEGV");
});

test("truncates runaway output", { skip }, async () => {
    const result = await c(`#include <stdio.h>\nint main(void) { for (;;) puts("spam"); }`);
    assert.equal(result.run.truncated, true);
    assert.match(result.run.stdout, /\[output truncated\]$/);
});

test("has no network, no writable filesystem and few processes", { skip }, async () => {
    const result = await c(`#include <stdio.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
int main(void) {
    int s = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in a = { .sin_family = AF_INET, .sin_port = htons(53) };
    inet_pton(AF_INET, "1.1.1.1", &a.sin_addr);
    printf("net=%d\\n", connect(s, (struct sockaddr*)&a, sizeof a));
    printf("work=%d\\n", fopen("/work/x", "w") != NULL);
    printf("etc=%d\\n", fopen("/etc/x", "w") != NULL);
    int forks = 0;
    for (int i = 0; i < 500; i++) { pid_t p = fork(); if (p == 0) { pause(); _exit(0); } if (p > 0) forks++; }
    printf("forks<500=%d\\n", forks < 500);
    return 0;
}`);
    assert.equal(result.compile.code, 0, result.compile.stderr);
    assert.match(result.run.stdout, /net=-1\nwork=0\netc=0\nforks<500=1/);
});

test("enforces the memory limit", { skip }, async () => {
    const result = await c(`#include <stdlib.h>
#include <string.h>
int main(void) { for (;;) { char *p = malloc(16 << 20); if (!p) return 7; memset(p, 1, 16 << 20); } }`);
    assert.ok(result.run.code === 7 || result.run.signal === "SIGKILL", JSON.stringify(result.run));
});

test("streams program output", { skip }, async () => {
    let streamed = "";
    const result = await c(`#include <stdio.h>\nint main(void) { puts("a"); puts("b"); }`, {
        onStdout: (chunk) => { streamed += chunk; },
    });
    assert.equal(streamed, "a\nb\n");
    assert.equal(result.run.stdout, "a\nb\n");
});
