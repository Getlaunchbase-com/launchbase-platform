/**
 * normalizeTestCommands - Convert prose test plans into safe, executable commands
 * 
 * Goal: Reduce preflight friction by intelligently mapping common prose patterns
 * to whitelisted commands, while preserving safety through the final validator.
 * 
 * Strategy:
 * 1. If missing/empty → default to ["pnpm typecheck"]
 * 2. If prose detected → map to known safe commands
 * 3. Keep whitelist validator as final safety gate
 */

/**
 * Prose-to-command mapping patterns
 */
const PROSE_PATTERNS: Array<{ pattern: RegExp; command: string }> = [
  // Typecheck patterns
  { pattern: /\b(run\s+)?typecheck/i, command: "pnpm typecheck" },
  { pattern: /\b(check|verify)\s+(types?|typescript|ts)/i, command: "pnpm typecheck" },
  { pattern: /\btsc\b/i, command: "pnpm typecheck" },
  
  // Test patterns
  { pattern: /\b(run\s+)?tests?/i, command: "pnpm test" },
  { pattern: /\b(run|execute)\s+(unit|integration)\s+tests?/i, command: "pnpm test" },
  { pattern: /\bvitest\b/i, command: "pnpm test" },
  
  // Lint patterns
  { pattern: /\b(run\s+)?lint/i, command: "pnpm lint" },
  { pattern: /\b(check|verify)\s+linting/i, command: "pnpm lint" },
  
  // Build patterns
  { pattern: /\b(run\s+)?build/i, command: "pnpm build" },
  { pattern: /\bcompile/i, command: "pnpm build" },
];

/**
 * Detect if a string is prose (not a command)
 */
function isProse(str: string): boolean {
  const trimmed = str.trim();
  
  // Already a valid command format (starts with known command prefix)
  if (/^(pnpm|npm|yarn|node|tsx|tsc)\s+/.test(trimmed)) {
    return false;
  }
  
  // Contains natural language indicators
  if (/^(run|execute|check|verify|please|should|make sure|ensure)/i.test(trimmed)) {
    return true;
  }
  
  // Contains dangerous keywords (delete, remove, clean, etc.)
  if (/\b(delete|remove|rm|clean|destroy|wipe|purge)\b/i.test(trimmed)) {
    return true; // Treat as prose to force mapping to safe default
  }
  
  // Contains spaces but no command structure
  if (trimmed.includes(" ") && !/^[\w-]+\s+[\w-]+/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Map prose to a safe command
 */
function proseToCommand(prose: string): string | null {
  const trimmed = prose.trim();
  
  // Try each pattern
  for (const { pattern, command } of PROSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return command;
    }
  }
  
  // Default fallback for unmapped prose
  return "pnpm typecheck";
}

/**
 * Normalize test commands array
 * 
 * Rules:
 * 1. If missing/empty → ["pnpm typecheck"]
 * 2. If prose detected → map to safe command
 * 3. If already valid → preserve as-is
 * 4. Strip markdown code fences and backticks
 */
export function normalizeTestCommands(
  testCommands: string[] | undefined | null,
  context?: {
    errorMessage?: string;
    failureType?: string;
  }
): string[] {
  // Rule 1: Missing/empty → default to typecheck
  if (!testCommands || !Array.isArray(testCommands) || testCommands.length === 0) {
    // If failure indicates TS error, default to typecheck
    if (context?.errorMessage?.toLowerCase().includes("typescript") ||
        context?.errorMessage?.toLowerCase().includes("type error") ||
        context?.failureType === "typescript_error") {
      return ["pnpm typecheck"];
    }
    
    // Otherwise default to typecheck (safest default)
    return ["pnpm typecheck"];
  }
  
  // Rule 2-4: Normalize each command
  return testCommands.map(cmd => {
    let normalized = String(cmd ?? "").trim();
    
    // Strip markdown code fences
    normalized = normalized.replace(/^```[\w]*\n?/gm, "").replace(/\n?```$/gm, "");
    
    // Strip backticks
    normalized = normalized.replace(/^`+|`+$/g, "");
    
    // Trim again after stripping
    normalized = normalized.trim();
    
    // If empty after stripping, default to typecheck
    if (!normalized) {
      return "pnpm typecheck";
    }
    
    // If prose, map to command
    if (isProse(normalized)) {
      return proseToCommand(normalized) || "pnpm typecheck";
    }
    
    // Already valid, preserve as-is
    return normalized;
  });
}

/**
 * Normalize test commands with context from FailurePacket
 */
export function normalizeTestCommandsFromFailurePacket(pkt: any): string[] {
  return normalizeTestCommands(
    pkt.testCommands,
    {
      errorMessage: pkt.failure?.errorMessage || pkt.error?.message,
      failureType: pkt.failure?.type,
    }
  );
}
