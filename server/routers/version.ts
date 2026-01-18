import { publicProcedure, router } from "../_core/trpc.js";
import { execSync } from "child_process";

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

function getBuildTime(): string {
  try {
    // Try to read from build artifact if it exists
    const fs = require("fs");
    const buildInfoPath = "./dist/build-info.json";
    if (fs.existsSync(buildInfoPath)) {
      const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf-8"));
      return buildInfo.builtAt;
    }
  } catch {
    // Fall through to current time
  }
  return new Date().toISOString();
}

export const versionRouter = router({
  get: publicProcedure.query(async () => {
    const sha = getGitSha();
    const builtAt = getBuildTime();
    
    return {
      sha,
      builtAt,
      env: process.env.NODE_ENV || "development",
    };
  }),
});
