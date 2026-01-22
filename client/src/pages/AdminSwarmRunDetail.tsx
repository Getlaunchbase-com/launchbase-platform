import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StopBadge({ value }: { value?: string | null }) {
  const v = value || "unknown";
  return <Badge variant={v === "ok" ? "default" : v === "running" ? "secondary" : "destructive"}>{v}</Badge>;
}

export default function AdminSwarmRunDetail() {
  const [match, params] = useRoute<{ repairKey: string }>("/admin/swarm/runs/:repairKey");
  const repairKey = params?.repairKey || "";
  const utils = trpc.useUtils();

  const runQuery = trpc.admin.swarm.runs.get.useQuery({ repairKey }, { enabled: !!repairKey });
  const ingestMutation = trpc.admin.swarm.runs.ingest.useMutation({
    onSuccess: async () => {
      await runQuery.refetch();
    },
  });

  const run: any = runQuery.data;
  const keys: string[] = Array.isArray(run?.artifactKeys) ? run.artifactKeys : [];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const urlQuery = trpc.admin.swarm.runs.artifactUrl.useQuery(
    selectedKey ? { repairKey, key: selectedKey } : ({} as any),
    { enabled: !!selectedKey }
  );

  const createProfileFromRun = trpc.admin.swarm.profiles.createFromRun.useMutation({
    onSuccess: async () => {
      // no-op
    },
  });

  const pushMutation = trpc.admin.swarm.runs.pushToBranch.useMutation({
    onSuccess: async () => {
      await runQuery.refetch();
    },
  });

  const defaultBranch = useMemo(() => `swarm/${repairKey}`, [repairKey]);
  const [branchName, setBranchName] = useState<string>(defaultBranch);
  const [commitMessage, setCommitMessage] = useState<string>(() => `Swarm repair ${repairKey}`);
  const [profileName, setProfileName] = useState<string>(() => `Profile from ${repairKey}`);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin/swarm" className="text-sm text-blue-600 hover:underline">← Back to runs</Link>
          <h1 className="text-2xl font-semibold">{repairKey}</h1>
          <div className="flex items-center gap-2">
            <StopBadge value={run?.stopReason} />
            <Badge variant="secondary">{run?.status ?? "unknown"}</Badge>
            <Badge variant="outline">applied: {run?.applied ? "true" : "false"}</Badge>
            <Badge variant="outline">tests: {run?.testsPassed ? "true" : "false"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => ingestMutation.mutate({ repairKey })}
            disabled={ingestMutation.isPending}
          >
            {ingestMutation.isPending ? "Ingesting…" : "Ingest artifacts"}
          </Button>
          <Link href="/admin/swarm/new"><Button>New Run</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Model</div><div>{run?.modelPrimary ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Cost</div><div>{typeof run?.costUsd === "number" ? `$${run.costUsd.toFixed(4)}` : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Latency</div><div>{typeof run?.latencyMs === "number" ? `${run.latencyMs}ms` : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Created</div><div>{run?.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Finished</div><div>{run?.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Artifact prefix</div><div className="break-all">{run?.artifactPrefix ?? "—"}</div></div>
        </CardContent>
      </Card>

      

<Card>
  <CardHeader>
    <CardTitle className="text-base">Save as Swarm Profile</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3 text-sm">
    <div className="text-muted-foreground">Save this run’s feature pack as a reusable profile (so you can re-run it and track stats).</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Profile name</div>
        <input
          className="w-full border rounded-md px-3 py-2 text-sm"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
        />
      </div>
      <div className="flex items-end">
        <Button
          disabled={createProfileFromRun.isPending}
          onClick={() => createProfileFromRun.mutate({ repairKey, name: profileName })}
        >
          {createProfileFromRun.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
    <div className="text-xs text-muted-foreground">
      Tip: After saving, visit <Link href="/admin/swarm/profiles" className="text-blue-600 hover:underline">Swarm Profiles</Link>.
    </div>
  </CardContent>
</Card>

{/* Push to branch */}
      {run?.repoSourceId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Push changes to a branch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-muted-foreground">
              This will create a branch and push the current applied changes from the repo workdir used for this run.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Branch name</div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder={defaultBranch}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Commit message</div>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={`Swarm repair ${repairKey}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={!run?.applied || pushMutation.isPending}
                onClick={() =>
                  pushMutation.mutate({
                    repairKey,
                    repoSourceId: run.repoSourceId,
                    branchName,
                    commitMessage,
                  })
                }
              >
                {pushMutation.isPending ? "Pushing…" : "Push branch"}
              </Button>
              {run?.pushedBranch ? (
                <Badge variant="outline">Pushed: {run.pushedBranch}</Badge>
              ) : null}
            </div>
            {pushMutation.error ? (
              <div className="text-red-600">{pushMutation.error.message}</div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Artifacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 ? (
            <div className="text-sm text-muted-foreground">No artifacts indexed yet. Click “Ingest artifacts”.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {keys.map((k) => (
                  <Button key={k} variant={k === selectedKey ? "default" : "secondary"} size="sm" onClick={() => setSelectedKey(k)}>
                    {k.split("/").pop()}
                  </Button>
                ))}
              </div>

              {selectedKey ? (
                <div className="text-sm">
                  {urlQuery.isLoading ? (
                    <div className="text-muted-foreground">Loading URL…</div>
                  ) : urlQuery.error ? (
                    <div className="text-red-600">{urlQuery.error.message}</div>
                  ) : urlQuery.data?.url ? (
                    <a className="text-blue-600 hover:underline" href={urlQuery.data.url} target="_blank" rel="noreferrer">
                      Open artifact
                    </a>
                  ) : (
                    <div className="text-muted-foreground">No URL</div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {runQuery.error ? <div className="text-sm text-red-600">{runQuery.error.message}</div> : null}
    </div>
  );
}
