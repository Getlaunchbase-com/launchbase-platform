import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

export default function AdminSwarmCompare() {
  const profilesQ = trpc.swarm.profiles.list.useQuery();
  const [profileId, setProfileId] = useState<string>("");

  const compareQ = trpc.swarm.reports.profileModelCompare.useQuery(
    { profileId, window: "7d" },
    { enabled: !!profileId }
  );

  const rows = compareQ.data?.rows ?? [];

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl shadow">
        <CardHeader>
          <CardTitle>Swarm Compare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Swarm Profile" />
              </SelectTrigger>
              <SelectContent>
                {(profilesQ.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!profileId ? (
            <div className="text-sm text-muted-foreground">Choose a profile to compare models.</div>
          ) : compareQ.isLoading ? (
            <div className="text-sm">Loading…</div>
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
                    <TableHead>StopReason Top</TableHead>
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
                      <TableCell>${r.avgCostUsd.toFixed(4)}</TableCell>
                      <TableCell>{Math.round(r.p95LatencyMs)}ms</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.topStopReason ?? "-"}</TableCell>
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
