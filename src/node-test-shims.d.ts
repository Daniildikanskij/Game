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
    notDeepEqual(actual: unknown, expected: unknown): void;
    ok(value: unknown): void;
    throws(block: () => unknown, error?: new (...args: never[]) => Error): void;
  }
  const assert: StrictAssert;
  export default assert;
}
