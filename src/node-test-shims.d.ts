declare module 'node:test' {
  type TestCallback = () => void | Promise<void>;
  interface TestFunction {
    (name: string, callback: TestCallback): void;
  }
  const test: TestFunction;
  export default test;
}

declare module 'node:assert/strict' {
  interface StrictAssert {
    equal(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
  }
  const assert: StrictAssert;
  export default assert;
}
