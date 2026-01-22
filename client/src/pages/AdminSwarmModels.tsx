import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

export default function AdminSwarmModels() {
  const q = trpc.swarm.models.list.useQuery();

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl shadow">
        <CardHeader>
          <CardTitle>Available AIMLAPI Models</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="text-sm">Loading…</div>
          ) : q.error ? (
            <div className="text-sm text-red-600">Failed to load models.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(q.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.provider ?? "-"}</TableCell>
                      <TableCell>
                        {m.contextWindow ? <Badge variant="secondary">{m.contextWindow}</Badge> : "-"}
                      </TableCell>
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
