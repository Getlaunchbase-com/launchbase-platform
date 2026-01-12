type ConsoleMethod = "log" | "warn" | "error" | "info" | "debug";

export function captureConsole(methods: ConsoleMethod[] = ["log", "warn", "error"]) {
  const original: Partial<Record<ConsoleMethod, any>> = {};
  const lines: string[] = [];

  const toLine = (args: any[]) => {
    try {
      return args
        .map((a) => {
          if (typeof a === "string") return a;
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          return JSON.stringify(a);
        })
        .join(" ");
    } catch {
      return args.map((a) => String(a)).join(" ");
    }
  };

  for (const m of methods) {
    original[m] = console[m];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console as any)[m] = (...args: any[]) => {
      lines.push(`[${m}] ${toLine(args)}`);
      // keep console quiet in tests; comment next line in if you want passthrough
      // original[m]!(...args);
    };
  }

  return {
    lines,
    restore() {
      for (const m of methods) {
        if (original[m]) (console as any)[m] = original[m];
      }
    },
  };
}
