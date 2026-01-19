import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR =
  process.env.AI_TENNIS_FIXTURES_DIR ??
  join(process.cwd(), "server/__tests__/fixtures");

export function loadJsonFixture<T = unknown>(relPath: string): T {
  const abs = join(FIXTURES_DIR, relPath);
  return JSON.parse(readFileSync(abs, "utf8")) as T;
}
