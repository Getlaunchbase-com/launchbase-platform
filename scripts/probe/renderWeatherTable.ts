type ProbeResultRow = {
  model: string;
  n: number;
  validRate: number;   // 0..1
  exact8Rate: number;  // 0..1
  avgAttempts: number;
  schemaFailRate: number; // 0..1
  timeoutRate: number;    // 0..1
  costUsdAvg: number;
  outputTokensAvg: number;
  // Stability metrics
  p50Count: number;
  p90Count: number;
  overCountRate: number;   // 0..1
  underCountRate: number;  // 0..1
  extremeDumpRate: number; // 0..1
};

function pct(x: number): string {
  // 0..1 -> "67%"
  const v = Math.round(x * 100);
  return `${v}%`;
}

function num(x: number, digits = 2): string {
  return x.toFixed(digits);
}

function pad(s: string, w: number, align: "left" | "right" = "left"): string {
  if (s.length >= w) return s.slice(0, w);
  const spaces = " ".repeat(w - s.length);
  return align === "left" ? s + spaces : spaces + s;
}

function line(w: number): string {
  return "-".repeat(w);
}

export function renderWeatherTable(opts: {
  lane: string;
  role: string;
  repsPerModel: number;
  mode: "tournament" | "production";
  rows: ProbeResultRow[];
}): string {
  const title = `MODEL WEATHER — lane=${opts.lane}, role=${opts.role}, reps=${opts.repsPerModel}, mode=${opts.mode}`;

  const cols = [
    { key: "model", label: "Model", width: 30, align: "left" as const },
    { key: "valid", label: "Valid%", width: 7, align: "right" as const },
    { key: "p50", label: "P50", width: 4, align: "right" as const },
    { key: "p90", label: "P90", width: 4, align: "right" as const },
    { key: "dump", label: "Dump%", width: 6, align: "right" as const },
    { key: "avgAtt", label: "AvgAtt", width: 6, align: "right" as const },
    { key: "cost", label: "$Avg", width: 6, align: "right" as const },
    { key: "tokOut", label: "TokOut", width: 6, align: "right" as const },
  ];

  const totalWidth = cols.reduce((acc, c) => acc + c.width, 0) + (cols.length - 1);

  const header =
    cols.map((c) => pad(c.label, c.width, c.align)).join(" ");

  const sep = line(totalWidth);

  const body = opts.rows
    .slice()
    .sort((a, b) => {
      // Sort by Valid desc, then Dump asc (lower dump is better), then Cost asc
      if (b.validRate !== a.validRate) return b.validRate - a.validRate;
      if (a.extremeDumpRate !== b.extremeDumpRate) return a.extremeDumpRate - b.extremeDumpRate;
      return a.costUsdAvg - b.costUsdAvg;
    })
    .map((r) => {
      const cells: Record<string, string> = {
        model: r.model,
        valid: pct(r.validRate),
        p50: String(Math.round(r.p50Count)),
        p90: String(Math.round(r.p90Count)),
        dump: pct(r.extremeDumpRate),
        avgAtt: num(r.avgAttempts, 2),
        cost: num(r.costUsdAvg, 3),
        tokOut: String(Math.round(r.outputTokensAvg)),
      };

      return cols.map((c) => pad(cells[c.key], c.width, c.align)).join(" ");
    })
    .join("\n");

  const legend =
    "Legend: P50/P90 = proposedChanges count distribution; Dump% = rate(count>=15); Valid% = role schema-valid";

  return [title, sep, header, sep, body, sep, legend].join("\n");
}
