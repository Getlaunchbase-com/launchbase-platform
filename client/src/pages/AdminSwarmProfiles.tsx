import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminSwarmProfiles() {
  const profilesQuery = trpc.admin.swarm.profiles.list.useQuery({ limit: 100 });
  const promote = trpc.admin.swarm.profiles.promote.useMutation({
    onSuccess: () => profilesQuery.refetch(),
  });
  const create = trpc.admin.swarm.profiles.create.useMutation({
    onSuccess: () => { setName(""); profilesQuery.refetch(); }
  });

  const [name, setName] = useState("");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/swarm" className="text-sm text-blue-600 hover:underline">← Back to runs</Link>
          <h1 className="text-2xl font-semibold">Swarm Profiles</h1>
          <p className="text-sm text-muted-foreground">Saved run configurations you can reuse and promote.</p>
        </div>
        <Link href="/admin/swarm/new"><Button>New Run</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Create profile</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-2 items-start md:items-end">
          <div className="flex-1 space-y-1 w-full">
            <div className="text-xs text-muted-foreground">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Repair: fixtures v1" />
          </div>
          <Button
            onClick={() => create.mutate({
              name: name || "Untitled profile",
              config: {
                name: name || "Untitled profile",
                intention: "smoke_test",
                sourceType: "fixture",
                fixtureName: "f11-new-file-dep-context",
                primaryModel: "openai/gpt-5-2",
                fallbackModel: "openai/gpt-4o",
                role: "owner",
                timeoutSec: 180,
                runBudgetSec: 600,
                toggles: {
                  escalationRetryEnabled: true,
                  hunkRepairEnabled: true,
                  emptyPatchRetryEnabled: true,
                  reviewerEnabled: true,
                  arbiterEnabled: true,
                },
                scopePreset: "standard",
                maxFiles: 20,
                maxBytes: 200000,
                selectedFiles: [],
                testCommands: [],
              }
            })}
            disabled={create.isPending}
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Profiles</CardTitle></CardHeader>
        <CardContent>
          {profilesQuery.isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
          {profilesQuery.error ? <div className="text-sm text-red-600">{profilesQuery.error.message}</div> : null}
          <div className="space-y-2">
            {(profilesQuery.data ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border rounded-md p-3">
                <div className="space-y-1">
                  <div className="font-medium flex items-center gap-2">
                    <Link href={`/admin/swarm/profiles/${p.id}`} className="hover:underline">{p.name}</Link>
                    {p.isPromoted ? <Badge>Promoted</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    7d: {p.stats7d ? `${Math.round(p.stats7d.passRate*100)}% pass • ${p.stats7d.runs} runs • $${p.stats7d.avgCostUsd?.toFixed?.(3) ?? "—"} avg` : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    updated {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}
                  </div>
                </div>
                <Button
                  variant={p.isPromoted ? "secondary" : "default"}
                  onClick={() => promote.mutate({ id: p.id, isPromoted: !p.isPromoted })}
                  disabled={promote.isPending}
                >
                  {p.isPromoted ? "Unpromote" : "Promote"}
                </Button>
              </div>
            ))}
            {(profilesQuery.data ?? []).length === 0 && !profilesQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">No profiles yet.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
