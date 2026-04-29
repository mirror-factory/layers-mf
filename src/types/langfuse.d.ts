declare module "langfuse" {
  export class Langfuse {
    constructor(args: Record<string, unknown>);
    generation(args: Record<string, unknown>): {
      end(args?: Record<string, unknown>): void;
      update(args?: Record<string, unknown>): void;
    };
  }
}
