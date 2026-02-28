# LaunchBase Cross-Repo Handoff Baseline

Date: 2026-02-28  
Owner: Monica / incoming scientist handoff

## Canonical Repos

1. `launchbase-platform`  
   - Path: `C:\Users\Monica Morreale\Downloads\launchbase-platform`
   - Branch: `main`
   - HEAD: `872b65d1fbb8e4d6ef10162e29314f5bb02e4ab2`
   - Remote: `https://github.com/Getlaunchbase-com/launchbase-platform.git`
   - Local status: dirty (2 modified files)
     - `scripts/gcp/worker/main.py`
     - `scripts/gcp/worker/requirements.txt`

2. `launchbase-mobile`  
   - Path: `C:\Users\Monica Morreale\Downloads\launchbase-mobile`
   - Branch: `main`
   - HEAD: `c18bf424eda7e1169483dbe080db791ba21ed948`
   - Remote: `https://github.com/Getlaunchbase-com/launchbase-mobile.git`
   - Local status: clean

3. `agent-stack`  
   - Path: `C:\Users\Monica Morreale\Downloads\agent-stack`
   - Branch: `main`
   - HEAD: `c1ddb2d7601295f627af87528ebc4d128d6bef65`
   - Remote: `https://github.com/Getlaunchbase-com/agent-stack.git`
   - Local status: clean

## Runtime Status (VM)

VM:
- Name: `agent-stack-vm`
- Zone: `us-central1-c`
- External IP: `35.188.184.31`
- Status: `RUNNING`

Services on VM:
- `launchbase-platform.service`: `active (running)`
- Docker containers:
  - `agent-router` (`0.0.0.0:8080->8080`)
  - `agent-browser` (`0.0.0.0:9222->9222`)
  - `agent-runner`
  - `launchbase-platform-publish-db-1` (healthy)

## Smoke Results

Validated on VM localhost (authoritative checks):

1. Platform health  
   - `GET http://localhost:3000/healthz` -> `status: ok`

2. Platform build info  
   - `GET http://localhost:3000/api/build-info` -> returns build metadata

3. Agent health  
   - `GET http://localhost:8080/health` -> `status: ok`

4. Agent tools  
   - `GET http://localhost:8080/tools` -> tool schema list returned

5. Contract status  
   - `GET http://localhost:8080/contracts/status` -> `ok: true`

6. Platform handshake endpoint  
   - `GET http://localhost:3000/api/contracts/handshake` -> HTML app shell (endpoint not exposed as JSON at this path in current build)

Note:
- External checks from this workstation to `http://35.188.184.31:3000` and `:8080` were unreachable during this run, while VM-local checks were healthy. Investigate network path/firewall/host-level ingress if external reachability is required from arbitrary clients.

## Admin UI Routing Verification (Platform Repo)

From `client/src/App.tsx`:
- `/admin` route exists and maps to `AdminDashboard`
- `/admin/agent/chat` route exists
- `/admin/console/*` routes exist (dashboard, runs, approvals, files, tools, models, settings)

From `client/src/pages/AdminDashboard.tsx`:
- `setLocation("/admin/console")` in `useEffect`, so `/admin` redirects to console entry.

## Mobile Wrapper Validation

Repo `launchbase-mobile` API defaults:
- `lib/config.ts` default base URL includes `http://35.188.184.31:3000`
- `lib/api.ts` fallback URL list includes `http://35.188.184.31:3000`

Typecheck run:
- Command: `npm.cmd test` (script runs `tsc --noEmit`)
- Result: **FAIL**
- Primary failure class:
  - Test typing/runner setup drift (`jest` globals/types missing)
  - API contract/type mismatches in `lib/api.ts`
  - Missing module/type references (example: `@sentry/react-native`)

Interpretation:
- Mobile repo compiles are not currently in a clean TS baseline in this environment and need a deliberate typecheck cleanup pass before handoff sign-off.

## Scientist Access

Cloud IAM for `p.mcready5423@gmail.com` successfully granted:
- `roles/viewer`
- `roles/aiplatform.user`
- `roles/bigquery.jobUser`
- `roles/bigquery.dataViewer`
- `roles/logging.viewer`
- `roles/storage.objectAdmin`
- `roles/run.developer`
- `roles/cloudbuild.builds.editor`
- `roles/artifactregistry.writer`

Project policy override applied so external domain IAM members are permitted:
- `constraints/iam.allowedPolicyMemberDomains` -> `ALLOW`

## Immediate Next Actions (Scientist)

1. Resolve/commit or stash the two local dirty files in `launchbase-platform`.
2. Decide whether `35.188.184.31:3000` and `:8080` should be publicly reachable; if yes, fix ingress/firewall path and re-test externally.
3. Run a focused mobile TS baseline repair pass so `npm test` is green.
4. Re-run cross-repo smoke and capture a new locked baseline SHA set.
