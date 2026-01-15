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
    { key: "exact8", label: "Exact8%", width: 8, align: "right" as const },
    { key: "avgAtt", label: "AvgAtt", width: 6, align: "right" as const },
    { key: "schemaFail", label: "SchemaFail%", width: 12, align: "right" as const },
    { key: "timeout", label: "Timeout%", width: 9, align: "right" as const },
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
      // Sort by Exact8 desc, then Valid desc, then Cost asc
      if (b.exact8Rate !== a.exact8Rate) return b.exact8Rate - a.exact8Rate;
      if (b.validRate !== a.validRate) return b.validRate - a.validRate;
      return a.costUsdAvg - b.costUsdAvg;
    })
    .map((r) => {
      const cells: Record<string, string> = {
        model: r.model,
        valid: pct(r.validRate),
        exact8: pct(r.exact8Rate),
        avgAtt: num(r.avgAttempts, 2),
        schemaFail: pct(r.schemaFailRate),
        timeout: pct(r.timeoutRate),
        cost: num(r.costUsdAvg, 3),
        tokOut: String(Math.round(r.outputTokensAvg)),
      };

      return cols.map((c) => pad(cells[c.key], c.width, c.align)).join(" ");
    })
    .join("\n");

  const legend =
    "Legend: Valid% = final schema-valid result; Exact8% = proposedChanges length==8; AvgAtt = retries";

  return [title, sep, header, sep, body, sep, legend].join("\n");
}
