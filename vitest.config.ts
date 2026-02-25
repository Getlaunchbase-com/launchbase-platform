import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    include: ["server/__tests__/**/*.test.ts", "shared/**/*.test.ts"],
    timeout: 30000,
    coverage: {
      provider: "v8",
    },
  },
});
