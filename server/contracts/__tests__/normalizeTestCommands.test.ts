import { describe, it, expect } from "vitest";
import { normalizeTestCommands } from "../normalizeTestCommands";

describe("normalizeTestCommands", () => {
  it("should default to typecheck when missing", () => {
    expect(normalizeTestCommands(undefined)).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(null)).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands([])).toEqual(["pnpm typecheck"]);
  });

  it("should preserve valid commands", () => {
    expect(normalizeTestCommands(["pnpm test"])).toEqual(["pnpm test"]);
    expect(normalizeTestCommands(["pnpm typecheck"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["tsx server/test.ts"])).toEqual(["tsx server/test.ts"]);
  });

  it("should convert prose to commands", () => {
    expect(normalizeTestCommands(["Run typecheck"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["run tests"])).toEqual(["pnpm test"]);
    expect(normalizeTestCommands(["Check types"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["verify typescript"])).toEqual(["pnpm typecheck"]);
  });

  it("should strip markdown code fences", () => {
    expect(normalizeTestCommands(["```\npnpm test\n```"])).toEqual(["pnpm test"]);
    expect(normalizeTestCommands(["```bash\npnpm typecheck\n```"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["`pnpm test`"])).toEqual(["pnpm test"]);
  });

  it("should handle mixed prose and valid commands", () => {
    const input = ["Run typecheck", "pnpm test", "check lint"];
    const expected = ["pnpm typecheck", "pnpm test", "pnpm lint"];
    expect(normalizeTestCommands(input)).toEqual(expected);
  });

  it("should use context to infer default command", () => {
    const context = {
      errorMessage: "TypeScript error: Property 'foo' does not exist",
      failureType: "typescript_error",
    };
    expect(normalizeTestCommands(undefined, context)).toEqual(["pnpm typecheck"]);
  });

  it("should handle empty strings after stripping", () => {
    expect(normalizeTestCommands(["```\n\n```"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["   "])).toEqual(["pnpm typecheck"]);
  });

  it("should not hallucinate dangerous commands from prose", () => {
    // These should map to safe defaults, not create dangerous commands
    expect(normalizeTestCommands(["delete node_modules"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["remove files"])).toEqual(["pnpm typecheck"]);
    expect(normalizeTestCommands(["clean everything"])).toEqual(["pnpm typecheck"]);
  });
});
