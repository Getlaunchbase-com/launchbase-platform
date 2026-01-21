/**
 * Whitelist-based test command validation.
 * Machine-safe commands only - no prose detection.
 */

const TEST_COMMAND_ALLOWLIST: RegExp[] = [
  // pnpm commands
  /^pnpm\s+(typecheck|test|lint|build)(\s+.*)?$/i,
  /^pnpm\s+-C\s+\S+\s+\S+(\s+.*)?$/i,
  // node -e with quotes (semicolons allowed inside the script)
  /^node\s+-e\s+["'].+["']$/i,
  // tsx
  /^tsx\s+.+$/i,
  // tsc
  /^tsc(\s+.*)?$/i,
];

export function validateTestCommandsOrThrow(testCommands: string[]) {
  if (!Array.isArray(testCommands) || testCommands.length === 0) {
    const err: any = new Error("testCommands missing or empty");
    err.errorCode = "test_commands_missing";
    throw err;
  }

  for (let i = 0; i < testCommands.length; i++) {
    const raw = testCommands[i];
    const cmd = String(raw ?? "").trim();
    
    if (!cmd) {
      const err: any = new Error(`testCommands[${i}] is empty`);
      err.errorCode = "test_command_empty";
      throw err;
    }

    // Block actual newlines (not semicolons - those are OK in node -e)
    if (/\n/.test(cmd)) {
      const err: any = new Error(`testCommands[${i}] contains literal newlines: ${cmd.substring(0, 100)}`);
      err.errorCode = "test_command_unsafe";
      throw err;
    }

    // Block command chains at shell level (but allow semicolons inside node -e quotes)
    if (/&&|\|\||;/.test(cmd) && !/^node\s+-e\s+["']/.test(cmd)) {
      const err: any = new Error(`testCommands[${i}] contains shell command chains: ${cmd.substring(0, 100)}`);
      err.errorCode = "test_command_unsafe";
      throw err;
    }

    // Block destructive operations
    if (/\b(rm|curl|wget|sudo|git\s+push)\b/.test(cmd)) {
      const err: any = new Error(`testCommands[${i}] contains destructive operation: ${cmd.substring(0, 100)}`);
      err.errorCode = "test_command_destructive";
      throw err;
    }

    const ok = TEST_COMMAND_ALLOWLIST.some((re) => re.test(cmd));
    if (!ok) {
      const err: any = new Error(`testCommands[${i}] not whitelisted: ${cmd.substring(0, 100)}`);
      err.errorCode = "test_command_not_whitelisted";
      throw err;
    }
  }
}
