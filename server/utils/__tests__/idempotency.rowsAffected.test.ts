/**
 * Micro-tests for _getRowsAffected helper
 * 
 * Purpose: Prevent affectedRows regression that caused "row stuck in started" bug
 * These tests verify the exact shapes Drizzle MySQL returns
 */

import { describe, it, expect } from "vitest";
import { _getRowsAffected } from "../idempotency";

describe("_getRowsAffected", () => {
  it("handles drizzle mysql array shape", () => {
    expect(_getRowsAffected([{ affectedRows: 0 }, null] as any)).toBe(0);
    expect(_getRowsAffected([{ affectedRows: 1 }, null] as any)).toBe(1);
  });

  it("handles direct object shapes", () => {
    expect(_getRowsAffected({ affectedRows: 2 } as any)).toBe(2);
    expect(_getRowsAffected({ rowsAffected: 3 } as any)).toBe(3);
  });

  it("handles unknown/undefined safely", () => {
    expect(_getRowsAffected(undefined as any)).toBe(0);
    expect(_getRowsAffected(null as any)).toBe(0);
    expect(_getRowsAffected({} as any)).toBe(0);
  });
});
