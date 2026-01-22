
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { spawnSync } from "child_process";
import { RepoSourceRow } from "./types";

export type RepoWorkdir = {
  workdir: string;
  headSha?: string;
};

const REPO_CACHE_DIR = resolve(process.cwd(), "data", "repos");

function runGit(args: string[], cwd: string) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || "").trim();
    throw new Error(`git ${args.join(" ")} failed: ${msg}`);
  }
  return (r.stdout || "").trim();
}

export async function ensureRepoWorkdir(repo: RepoSourceRow, opts?: { sync?: boolean }): Promise<RepoWorkdir> {
  if (repo.type === "local") {
    const p = repo.localPath ? resolve(repo.localPath) : "";
    if (!p || !existsSync(p)) throw new Error("Local repo path not found");
    const headSha = existsSync(join(p, ".git")) ? runGit(["rev-parse", "HEAD"], p) : undefined;
    return { workdir: p, headSha };
  }

  // Git repo: shallow clone / sync into data/repos/<id>
  if (!repo.repoUrl) throw new Error("repoUrl required for git repo source");
  const workdir = join(REPO_CACHE_DIR, String(repo.id));
  mkdirSync(REPO_CACHE_DIR, { recursive: true });

  const isCloned = existsSync(join(workdir, ".git"));
  const env = { ...process.env };

  // MVP: token auth via https URL only (store token separately and inject).
  // If repo.encryptedSecret is present and url is https, inject token as https://token@host/...
  let repoUrl = repo.repoUrl;
  if (repo.authType === "token" && repo.encryptedSecret && repoUrl.startsWith("https://")) {
    // encryptedSecret is stored as plaintext token for MVP (rename later)
    const token = repo.encryptedSecret;
    repoUrl = repoUrl.replace("https://", `https://${encodeURIComponent(token)}@`);
  }

  const sync = opts?.sync !== false;

  if (!isCloned) {
    const branch = repo.branch || "main";
    const r = spawnSync("git", ["clone", "--depth", "1", "--branch", branch, repoUrl, workdir], { env, encoding: "utf8" });
    if (r.status !== 0) {
      const msg = (r.stderr || r.stdout || "").trim();
      throw new Error(`git clone failed: ${msg}`);
    }
  } else if (sync) {
    // Sync (dangerous if there are uncommitted changes)
    runGit(["fetch", "--depth", "1", "origin", repo.branch || "main"], workdir);
    runGit(["reset", "--hard", `origin/${repo.branch || "main"}`], workdir);
    runGit(["clean", "-fd"], workdir);
  }

  const headSha = runGit(["rev-parse", "HEAD"], workdir);
  return { workdir, headSha };
}

export async function getRepoWorkdirNoSync(repo: RepoSourceRow): Promise<RepoWorkdir> {
  // Returns an existing workdir without fetch/reset, so applied changes can be pushed.
  return ensureRepoWorkdir(repo, { sync: false });
}

export type PushResult = {
  branch: string;
  headSha: string;
  pushedAtIso: string;
};

export async function pushCurrentChangesToBranch(
  repo: RepoSourceRow,
  branchName: string,
  commitMessage: string,
  opts?: { authorName?: string; authorEmail?: string }
): Promise<PushResult> {
  if (repo.type !== "git") throw new Error("Push is only supported for git repo sources");
  const { workdir } = await getRepoWorkdirNoSync(repo);

  // Ensure remote URL includes token if configured (so push succeeds)
  let repoUrl = repo.repoUrl || "";
  if (repo.authType === "token" && repo.encryptedSecret && repoUrl.startsWith("https://")) {
    const token = repo.encryptedSecret;
    repoUrl = repoUrl.replace("https://", `https://${encodeURIComponent(token)}@`);
    try {
      runGit(["remote", "set-url", "origin", repoUrl], workdir);
    } catch {
      // best-effort; git may already have usable auth
    }
  }

  // Configure author for commits (repo-local)
  const name = opts?.authorName || "LaunchBase Swarm";
  const email = opts?.authorEmail || "swarm@getlaunchbase.com";
  runGit(["config", "user.name", name], workdir);
  runGit(["config", "user.email", email], workdir);

  // If branch exists locally, delete it to make behavior deterministic
  try {
    runGit(["branch", "-D", branchName], workdir);
  } catch {
    // ignore
  }

  runGit(["checkout", "-b", branchName], workdir);

  const status = runGit(["status", "--porcelain"], workdir);
  if (!status.trim()) throw new Error("No changes to push");

  runGit(["add", "-A"], workdir);
  // Allow empty? No.
  runGit(["commit", "-m", commitMessage], workdir);
  runGit(["push", "-u", "origin", branchName], workdir);

  const headSha = runGit(["rev-parse", "HEAD"], workdir);
  return { branch: branchName, headSha, pushedAtIso: new Date().toISOString() };
}

export type FileSearchResult = { path: string; size: number };

export function searchRepoFiles(workdir: string, query: string, limit = 50): FileSearchResult[] {
  const q = query.trim().toLowerCase();
  const results: FileSearchResult[] = [];
  if (!q) return results;

  const maxBytes = 5_000_000; // avoid huge scans
  let scanned = 0;

  function walk(dir: string) {
    if (results.length >= limit) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (results.length >= limit) return;
      const full = join(dir, e.name);
      const rel = full.replace(workdir + "/", "");
      if (e.isDirectory()) {
        // skip heavy dirs
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "build") continue;
        walk(full);
      } else if (e.isFile()) {
        const st = statSync(full);
        scanned += st.size;
        if (scanned > maxBytes) return;
        if (rel.toLowerCase().includes(q)) {
          results.push({ path: rel, size: st.size });
        }
      }
    }
  }

  walk(workdir);
  return results;
}

export function readRepoFile(workdir: string, relPath: string): string {
  const full = resolve(workdir, relPath);
  if (!full.startsWith(resolve(workdir))) throw new Error("Invalid path");
  const st = statSync(full);
  if (!st.isFile()) throw new Error("Not a file");
  if (st.size > 300_000) throw new Error("File too large");
  return readFileSync(full, "utf8");
}
