# Scientist Handoff: Two 8B Model Lanes

Date: 2026-02-28  
Project: `engaged-style-456320-t4`  
Region: `us-central1`

## Objective

Stand up two separate 8B model lanes:

1. `main-8b-governed` (production-governed default)
2. `sandbox-8b-isolated` (research/stress lane, isolated from customer traffic)

## Canonical Model Targets

1. Main lane
- Model family: `Llama 3.1 8B Instruct`
- Intended use: production inference, customer-facing, policy-governed prompts

2. Sandbox lane
- Model family: `Dolphin Llama 3 8B` (or equivalent unrestricted research checkpoint)
- Intended use: isolated research/testing only
- Hard rule: no direct customer routing, no production data, no auto-publish

## Required Storage Layout

Models bucket:
- `gs://lb-ai-models-engaged-style-456320-t4-us/main-8b-governed/`
- `gs://lb-ai-models-engaged-style-456320-t4-us/sandbox-8b-isolated/`

Recommended subfolders per lane:
- `weights/`
- `tokenizer/`
- `config/`
- `manifests/`

## Copy/Paste Setup Commands

```powershell
$PROJECT_ID="engaged-style-456320-t4"
$REGION="us-central1"
$MODELS_BUCKET="lb-ai-models-engaged-style-456320-t4-us"

gcloud.cmd config set project $PROJECT_ID

# Folder markers for main lane
echo main-lane | Out-File -Encoding ascii -NoNewline "$env:TEMP\lane.txt"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/main-8b-governed/README.txt"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/main-8b-governed/weights/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/main-8b-governed/tokenizer/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/main-8b-governed/config/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/main-8b-governed/manifests/.keep"

# Folder markers for sandbox lane
echo sandbox-lane | Out-File -Encoding ascii -NoNewline "$env:TEMP\lane.txt"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/sandbox-8b-isolated/README.txt"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/sandbox-8b-isolated/weights/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/sandbox-8b-isolated/tokenizer/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/sandbox-8b-isolated/config/.keep"
gsutil cp "$env:TEMP\lane.txt" "gs://$MODELS_BUCKET/sandbox-8b-isolated/manifests/.keep"
```

## Scientist Drop Procedure

1. Upload model artifacts into each lane:
- Main: `.../main-8b-governed/weights/*`
- Sandbox: `.../sandbox-8b-isolated/weights/*`

2. Add lane manifest JSON files:
- `.../main-8b-governed/manifests/model.manifest.json`
- `.../sandbox-8b-isolated/manifests/model.manifest.json`

3. Register each lane in your runtime routing config:
- Main lane as default production model.
- Sandbox lane gated behind explicit non-prod flags.

## Minimal Manifest Template

```json
{
  "lane": "main-8b-governed",
  "model_family": "llama-3.1-8b-instruct",
  "version": "v1",
  "artifact_root": "gs://lb-ai-models-engaged-style-456320-t4-us/main-8b-governed/",
  "intended_use": "production_governed",
  "status": "active",
  "owner": "scientist",
  "created_at_utc": "2026-02-28T00:00:00Z"
}
```

```json
{
  "lane": "sandbox-8b-isolated",
  "model_family": "dolphin-llama3-8b",
  "version": "v1",
  "artifact_root": "gs://lb-ai-models-engaged-style-456320-t4-us/sandbox-8b-isolated/",
  "intended_use": "sandbox_research_only",
  "status": "active",
  "owner": "scientist",
  "created_at_utc": "2026-02-28T00:00:00Z"
}
```

## Guardrails

1. Sandbox lane must never receive production customer requests.
2. Sandbox lane must use non-production service account and separate endpoint.
3. Any promotion from sandbox to main requires explicit review + signed manifest change.
