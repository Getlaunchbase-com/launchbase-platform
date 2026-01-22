
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

export default function AdminSwarmRepoSources() {
  const repoList = trpc.admin.swarm.repoSources.list.useQuery();
  const sync = trpc.admin.swarm.repoSources.sync.useMutation({ onSuccess: () => repoList.refetch() });
  const createLocal = trpc.admin.swarm.repoSources.createLocal.useMutation({ onSuccess: () => repoList.refetch() });
  const createGit = trpc.admin.swarm.repoSources.createGit.useMutation({ onSuccess: () => repoList.refetch() });

  const [localName, setLocalName] = useState("Local repo");
  const [localPath, setLocalPath] = useState("/home/ubuntu/launchbase");
  const [gitName, setGitName] = useState("Git repo");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [authToken, setAuthToken] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Swarm Repo Sources</h1>
          <p className="text-sm text-muted-foreground">Where the console reads files for snapshots and manual runs.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/swarm"><Button variant="outline">Runs</Button></Link>
          <Link href="/admin/swarm/new"><Button>New Run</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Existing sources</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {repoList.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {repoList.data?.length === 0 && <div className="text-sm text-muted-foreground">No repo sources yet.</div>}
          <div className="space-y-2">
            {repoList.data?.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border p-3">
                <div className="space-y-1">
                  <div className="font-medium">{r.name} <span className="text-xs text-muted-foreground">({r.type})</span></div>
                  {r.type === "local" ? (
                    <div className="text-xs text-muted-foreground">{r.localPath}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">{r.repoUrl} • {r.branch}</div>
                  )}
                  <div className="text-xs text-muted-foreground">HEAD: {r.lastHeadSha || "—"} • Sync: {r.lastSyncAt ? String(r.lastSyncAt) : "—"}</div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => sync.mutate({ id: r.id })}
                  disabled={sync.isPending}
                >
                  Sync
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Add local path</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={localName} onChange={(e) => setLocalName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Local repo path</Label>
              <Input value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
            </div>
            <Button onClick={() => createLocal.mutate({ name: localName, localPath })} disabled={createLocal.isPending}>
              Add local source
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Add git repo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={gitName} onChange={(e) => setGitName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Repo URL (https)</Label>
              <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo.git" />
            </div>
            <div className="space-y-1">
              <Label>Branch</Label>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Auth token (optional, stored as-is for MVP)</Label>
              <Input value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
            </div>
            <Button onClick={() => createGit.mutate({ name: gitName, repoUrl, branch, authToken: authToken || undefined })} disabled={createGit.isPending}>
              Add git source
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
