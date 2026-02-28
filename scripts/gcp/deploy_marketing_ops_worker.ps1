param(
  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = ".\scripts\gcp\launchbase_gcp.env",
  [Parameter(Mandatory = $false)]
  [string]$ServiceName = "launchbase-marketing-ops-worker",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { throw "Config file not found: $path" }
  $vars = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) { $vars[$parts[0].Trim()] = $parts[1].Trim() }
  }
  return $vars
}

$cfg = Load-EnvFile $ConfigPath
$project = $cfg["PROJECT_ID"]
$region = $cfg["REGION"]
$repo = $cfg["AR_REPO"]
$runnerSa = "{0}@{1}.iam.gserviceaccount.com" -f $cfg["PIPELINE_RUNNER_SA_ID"], $project

if (-not $project -or -not $region -or -not $repo) {
  throw "PROJECT_ID, REGION, AR_REPO are required."
}

$image = "$region-docker.pkg.dev/$project/$repo/${ServiceName}:latest"
$src = "scripts/gcp/worker"

Write-Host "Project: $project"
Write-Host "Region:  $region"
Write-Host "Service: $ServiceName"
Write-Host "Image:   $image"

if ($DryRun) {
  Write-Host "DryRun enabled; not building or deploying."
  exit 0
}

& gcloud.cmd config set project $project | Out-Null

# Build and push with Cloud Build
& gcloud.cmd builds submit $src --tag $image --project $project

# Deploy Cloud Run service (private, Pub/Sub push with OIDC)
& gcloud.cmd run deploy $ServiceName `
  --image $image `
  --region $region `
  --service-account $runnerSa `
  --no-allow-unauthenticated `
  --set-env-vars "PROJECT_ID=$project,BQ_DATASET_MARKETING=$($cfg["BQ_DATASET_MARKETING"])" `
  --project $project

$url = (& gcloud.cmd run services describe $ServiceName --region $region --project $project --format="value(status.url)")
if (-not $url) { throw "Failed to resolve Cloud Run service URL." }
Write-Host "Cloud Run URL: $url"

# Allow Pub/Sub push identity to invoke service.
$projectNumber = & gcloud.cmd projects describe $project --format="value(projectNumber)"
$pubsubSa = "service-$projectNumber@gcp-sa-pubsub.iam.gserviceaccount.com"
& gcloud.cmd run services add-iam-policy-binding $ServiceName `
  --region $region `
  --member "serviceAccount:$pubsubSa" `
  --role "roles/run.invoker" `
  --project $project | Out-Null
& gcloud.cmd run services add-iam-policy-binding $ServiceName `
  --region $region `
  --member "serviceAccount:$runnerSa" `
  --role "roles/run.invoker" `
  --project $project | Out-Null

# Allow Pub/Sub service agent to mint OIDC tokens as the push auth service account.
& gcloud.cmd iam service-accounts add-iam-policy-binding $runnerSa `
  --member "serviceAccount:$pubsubSa" `
  --role "roles/iam.serviceAccountTokenCreator" `
  --project $project | Out-Null

# Convert existing subscriptions to push endpoint.
$subs = @(
  "lb-marketing-fetch-trends-sub",
  "lb-marketing-research-verticals-sub",
  "lb-marketing-generate-campaigns-sub",
  "lb-marketing-ab-eval-sub",
  "lb-marketing-daily-report-sub"
)

foreach ($sub in $subs) {
  Write-Host "Updating subscription push endpoint: $sub"
  & gcloud.cmd pubsub subscriptions update $sub `
    --push-endpoint "$url/pubsub/push" `
    --push-auth-service-account $runnerSa `
    --project $project | Out-Null
}

Write-Host ""
Write-Host "Marketing ops worker deployed and subscriptions set to push."
Write-Host "Service URL: $url"
