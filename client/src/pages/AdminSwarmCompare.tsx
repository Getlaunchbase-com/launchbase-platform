import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Row = {
  model: string;
  runs: number;
  passRate: number;
  avgCostUsd: number | null;
  p95LatencyMs: number | null;
  topStopReason: string | null;
};

type RunRow = {
  modelUsed?: string | null;
  modelPrimary?: string | null;
  costUsd?: number | string | null;
  latencyMs?: number | null;
  stopReason?: string | null;
  testsPassed?: boolean | null;
  applied?: boolean | null;
  patchValid?: boolean | null;
  createdAt?: string | Date | null;
};

function p95(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(0.95 * (s.length - 1))];
}

export default function AdminSwarmCompare() {
  const profilesQ = trpc.admin.swarm.profiles.list.useQuery({ limit: 200 });
  const [profileId, setProfileId] = useState<number | null>(null);

  const profileQ = trpc.admin.swarm.profiles.get.useQuery(
    { id: profileId ?? 0 },
    { enabled: !!profileId }
  );

  const rows: Row[] = useMemo(() => {
    const runs = (profileQ.data as any)?.recentRuns ?? [];
    const byModel = new Map<string, any[]>();
    for (const r of runs) {
      const model = (r.modelPrimary || "unknown") as string;
      if (!byModel.has(model)) byModel.set(model, []);
      byModel.get(model)!.push(r);
    }
    const out: Row[] = [];
    for (const [model, rs] of Array.from(byModel.entries())) {
      const n = rs.length;
      const ok = rs.filter((r: RunRow) => r.stopReason === "ok").length;
      const passRate = n ? ok / n : 0;
      const costs = rs
        .map((r: RunRow) => (typeof r.costUsd === "number" ? r.costUsd : null))
        .filter((x): x is number => typeof x === "number");
      const avgCostUsd = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
      const lat = rs
        .map((r: RunRow) => (typeof r.latencyMs === "number" ? r.latencyMs : null))
        .filter((x): x is number => typeof x === "number");
      const p95LatencyMs = p95(lat);

      const freq = new Map<string, number>();
      for (const r of rs) {
        const key = (r.stopReason || "unknown") as string;
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
      const topStopReason = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      out.push({ model, runs: n, passRate, avgCostUsd, p95LatencyMs, topStopReason });
    }
    return out.sort((a, b) => b.runs - a.runs);
  }, [profileQ.data]);

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl shadow">
        <CardHeader>
          <CardTitle>Swarm Compare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Select
              value={profileId ? String(profileId) : ""}
              onValueChange={(v) => setProfileId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Swarm Profile" />
              </SelectTrigger>
              <SelectContent>
                {(profilesQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!profileId ? (
            <div className="text-sm text-muted-foreground">Choose a profile to compare models.</div>
          ) : profileQ.isLoading ? (
            <div className="text-sm">Loading…</div>
          ) : profileQ.error ? (
            <div className="text-sm text-red-600">{profileQ.error.message}</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Pass Rate</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>P95 Latency</TableHead>
                    <TableHead>Top StopReason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.model}>
                      <TableCell className="font-medium">{r.model}</TableCell>
                      <TableCell>{r.runs}</TableCell>
                      <TableCell>
                        <Badge variant={r.passRate >= 0.6 ? "default" : "secondary"}>
                          {(r.passRate * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{r.avgCostUsd == null ? "—" : `$${r.avgCostUsd.toFixed(4)}`}</TableCell>
                      <TableCell>{r.p95LatencyMs == null ? "—" : `${Math.round(r.p95LatencyMs)}ms`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.topStopReason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
