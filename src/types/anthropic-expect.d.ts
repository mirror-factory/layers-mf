declare module "@anthropic-ai/expect" {
  import type { Page } from "@playwright/test";

  type ExpectContext = {
    page: Page;
  };

  type ExpectTestBody = (context: ExpectContext) => void | Promise<void>;
  type DescribeBody = () => void;

  interface DescribeApi {
    (name: string, body: DescribeBody): void;
    skip(name: string, body: DescribeBody): void;
  }

  interface TestApi {
    (name: string, body: ExpectTestBody): void;
    describe: DescribeApi;
  }

  interface NaturalLanguageExpect {
    toMatch(assertion: string): Promise<void>;
  }

  export const test: TestApi;
  export function expect(target: unknown): NaturalLanguageExpect;
}
