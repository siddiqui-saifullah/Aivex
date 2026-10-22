/** WebAssembly exception handling (in all current browsers, not yet in TypeScript's lib). */
declare namespace WebAssembly {
  class Tag {
    constructor(type: { parameters: string[] });
  }
  class Exception {
    constructor(tag: Tag, payload: unknown[]);
    is(tag: Tag): boolean;
    getArg(tag: Tag, index: number): unknown;
  }
}
