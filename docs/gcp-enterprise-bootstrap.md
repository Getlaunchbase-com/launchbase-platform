# LaunchBase Cloud-First Bootstrap (Vertex + Marketing AI)

This is the production bootstrap path for your computer scientist.

Goal: provision Google Cloud once, then drop model/data into buckets and launch training/inference jobs with minimal setup.

## Scope

- Repo: `launchbase-platform`
- Cloud model: Google Cloud + Vertex AI (not local-first)
- Guardrails: Launchbase approvals/audit remain the control plane

## What This Bootstrap Creates

1. Required GCP APIs
2. Service accounts for orchestrator + Vertex runner
3. IAM role bindings
4. GCS buckets for models/data/artifacts/pipelines
5. Artifact Registry Docker repo
6. BigQuery datasets for marketing/training/eval
7. Secret Manager entries (placeholder values)
8. Folder structure markers for pipeline paths

## Files Added

- `scripts/gcp/launchbase_gcp.env.example`
- `scripts/gcp/bootstrap_launchbase_gcp.ps1`
- `scripts/gcp/submit_vertex_marketing_job.ps1`
- `scripts/gcp/configure_permissions.ps1`

## 1) Pre-reqs

Install and auth:

```powershell
gcloud.cmd auth login
gcloud.cmd auth application-default login
```

Make sure these CLIs work:

```powershell
gcloud.cmd --version
gsutil version -l
bq version
```

## 2) Configure

Copy the config template and edit values:

```powershell
cd /d "C:\Users\Monica Morreale\Downloads\launchbase-platform"
copy scripts\gcp\launchbase_gcp.env.example scripts\gcp\launchbase_gcp.env
```

Edit `scripts\gcp\launchbase_gcp.env`:

- `PROJECT_ID`
- unique bucket names
- service account ids
- optional secret name list
- default training image uri

## 3) Bootstrap Cloud Foundation

```powershell
powershell -ExecutionPolicy Bypass -File scripts\gcp\bootstrap_launchbase_gcp.ps1 -ConfigPath ".\scripts\gcp\launchbase_gcp.env"
```

This step is idempotent. Re-running is safe.

## 4) Drop AI Assets In Buckets

After bootstrap, place assets into:

- model artifacts: `gs://<MODELS_BUCKET>/models/`
- training/eval data: `gs://<DATA_BUCKET>/datasets/processed/`
- outputs auto-written to artifacts bucket under `training/jobs/<job-name>/`

Example:

```powershell
gsutil cp .\my_model.gguf gs://<MODELS_BUCKET>/models/
gsutil cp .\marketing_train.jsonl gs://<DATA_BUCKET>/datasets/processed/
```

## 5) Submit Vertex Job

```powershell
powershell -ExecutionPolicy Bypass -File scripts\gcp\submit_vertex_marketing_job.ps1 -ConfigPath ".\scripts\gcp\launchbase_gcp.env"
```

Optional dry run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\gcp\submit_vertex_marketing_job.ps1 -ConfigPath ".\scripts\gcp\launchbase_gcp.env" -DryRun
```

## 6) Apply Runtime + Engineer Permissions

```powershell
powershell -ExecutionPolicy Bypass -File scripts\gcp\configure_permissions.ps1 -ConfigPath ".\scripts\gcp\launchbase_gcp.env" -EngineerEmail "info@marketing-beast.com"
```

## 7) Monitor

```powershell
gcloud.cmd ai custom-jobs list --region us-central1 --project <PROJECT_ID>
gcloud.cmd ai custom-jobs stream-logs <JOB_ID> --region us-central1 --project <PROJECT_ID>
```

## 8) Secrets

Bootstrap creates placeholder versions (`CHANGE_ME`) for each configured secret name.

Update each secret with a real value:

```powershell
echo REAL_VALUE | gcloud.cmd secrets versions add <SECRET_NAME> --data-file=- --project <PROJECT_ID>
```

Recommended first secrets:

- `aimlapi-key`
- `openai-api-key`
- `google-ads-dev-token`
- `meta-ads-access-token`
- `hubspot-api-key`

## 9) Marketing Department Agent Pattern (Cloud)

Use Vertex for model execution and BigQuery for measurement:

1. CMO planner agent (strategy + budget split)
2. Growth agent (experiments)
3. Content agent (copy variants)
4. Analytics agent (KPI deltas)
5. Ops agent (publish workflow)

All external actions require Launchbase approval gates.

## 10) Handoff Checklist

1. Bootstrap script completed without failures
2. Buckets and datasets visible
3. Secrets updated from placeholders
4. Training image exists in Artifact Registry
5. First Vertex custom job submitted and logged
6. Artifacts written to artifacts bucket
7. Launchbase platform health + smoke tests green

## Notes

- This setup intentionally avoids hardcoding old/expired project IDs.
- Keep all secrets in Secret Manager only.
- Keep model and data paths stable so “drop in bucket and run” remains reliable.
- To fix ADC quota warning:

```powershell
gcloud.cmd auth application-default set-quota-project engaged-style-456320-t4
```
