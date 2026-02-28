param(
  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = ".\scripts\gcp\launchbase_gcp.env",
  [switch]$CreatePlaceholderSecrets = $true
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Test-GcloudResource([string[]]$args) {
  try {
    & gcloud.cmd @args 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Test-GsutilBucket([string]$uri) {
  try {
    gsutil ls -b $uri 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) {
    throw "Config file not found: $path"
  }
  $vars = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      $vars[$parts[0].Trim()] = $parts[1].Trim()
    }
  }
  return $vars
}

function GCloud-ApiEnabled([string]$project, [string]$service) {
  $enabled = & gcloud.cmd services list --enabled --project $project --format="value(config.name)" 2>$null
  return $enabled -contains $service
}

function Ensure-Api([string]$project, [string]$service) {
  if (GCloud-ApiEnabled -project $project -service $service) {
    Write-Host "API already enabled: $service"
  } else {
    Write-Host "Enabling API: $service"
    & gcloud.cmd services enable $service --project $project | Out-Null
  }
}

function Ensure-Bucket([string]$bucket, [string]$location, [string]$project) {
  $uri = "gs://$bucket"
  $exists = Test-GsutilBucket $uri
  if (-not $exists) {
    Write-Host "Creating bucket: $uri"
    gsutil mb -p $project -l $location -b on $uri | Out-Null
    gsutil versioning set on $uri | Out-Null
  } else {
    Write-Host "Bucket exists: $uri"
  }
}

function Ensure-ServiceAccount([string]$project, [string]$saId, [string]$displayName) {
  $email = "$saId@$project.iam.gserviceaccount.com"
  $exists = Test-GcloudResource @("iam","service-accounts","describe",$email,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating service account: $email"
    & gcloud.cmd iam service-accounts create $saId --display-name $displayName --project $project | Out-Null
  } else {
    Write-Host "Service account exists: $email"
  }
  return $email
}

function Ensure-ProjectBinding([string]$project, [string]$member, [string]$role) {
  Write-Host "Granting $role to $member"
  & gcloud.cmd projects add-iam-policy-binding $project --member $member --role $role --quiet | Out-Null
}

function Ensure-ArtifactRepo([string]$project, [string]$region, [string]$repo) {
  $exists = Test-GcloudResource @("artifacts","repositories","describe",$repo,"--location",$region,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating Artifact Registry repo: $repo"
    & gcloud.cmd artifacts repositories create $repo `
      --repository-format=docker `
      --location=$region `
      --description="LaunchBase AI images" `
      --project=$project | Out-Null
  } else {
    Write-Host "Artifact Registry repo exists: $repo"
  }
}

function Ensure-BQDataset([string]$project, [string]$dataset, [string]$location) {
  bq --project_id=$project show --dataset "$project`:$dataset" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating BigQuery dataset: $dataset"
    bq --project_id=$project mk --dataset --location=$location "$project`:$dataset" | Out-Null
  } else {
    Write-Host "BigQuery dataset exists: $dataset"
  }
}

function Ensure-Secret([string]$project, [string]$secretName, [switch]$CreateValue) {
  $exists = Test-GcloudResource @("secrets","describe",$secretName,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating secret: $secretName"
    & gcloud.cmd secrets create $secretName --replication-policy=automatic --project=$project | Out-Null
  } else {
    Write-Host "Secret exists: $secretName"
  }

  if ($CreateValue) {
    $tmp = New-TemporaryFile
    "CHANGE_ME" | Set-Content -Path $tmp -NoNewline
    & gcloud.cmd secrets versions add $secretName --data-file=$tmp --project=$project | Out-Null
    Remove-Item $tmp -Force
  }
}

Require-Command "gcloud.cmd"
Require-Command "gsutil"
Require-Command "bq"

$cfg = Load-EnvFile $ConfigPath
$project = $cfg["PROJECT_ID"]
$region = $cfg["REGION"]
$multiRegion = $cfg["MULTI_REGION"]

if (-not $project) { throw "PROJECT_ID missing in $ConfigPath" }
if (-not $region) { throw "REGION missing in $ConfigPath" }
if (-not $multiRegion) { throw "MULTI_REGION missing in $ConfigPath" }

Write-Host "Using project: $project"
& gcloud.cmd config set project $project | Out-Null

# 1) Enable required services
$apis = @(
  "aiplatform.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "secretmanager.googleapis.com",
  "bigquery.googleapis.com",
  "storage.googleapis.com",
  "run.googleapis.com",
  "cloudscheduler.googleapis.com",
  "monitoring.googleapis.com",
  "logging.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "dlp.googleapis.com"
)
$apis | ForEach-Object { Ensure-Api -project $project -service $_ }

# 2) Service accounts
$orchestratorSa = Ensure-ServiceAccount -project $project -saId $cfg["ORCHESTRATOR_SA_ID"] -displayName "LaunchBase AI Orchestrator"
$runnerSa = Ensure-ServiceAccount -project $project -saId $cfg["PIPELINE_RUNNER_SA_ID"] -displayName "LaunchBase Vertex Runner"

# 3) IAM roles (pragmatic default for bootstrap)
$roles = @(
  "roles/aiplatform.user",
  "roles/aiplatform.admin",
  "roles/storage.admin",
  "roles/bigquery.admin",
  "roles/secretmanager.admin",
  "roles/artifactregistry.admin",
  "roles/logging.logWriter",
  "roles/monitoring.metricWriter",
  "roles/iam.serviceAccountUser"
)
foreach ($role in $roles) {
  Ensure-ProjectBinding -project $project -member "serviceAccount:$orchestratorSa" -role $role
  Ensure-ProjectBinding -project $project -member "serviceAccount:$runnerSa" -role $role
}

# 4) Buckets
Ensure-Bucket -bucket $cfg["MODELS_BUCKET"] -location $region -project $project
Ensure-Bucket -bucket $cfg["DATA_BUCKET"] -location $region -project $project
Ensure-Bucket -bucket $cfg["ARTIFACTS_BUCKET"] -location $region -project $project
Ensure-Bucket -bucket $cfg["PIPELINE_BUCKET"] -location $region -project $project

# 5) Artifact Registry
Ensure-ArtifactRepo -project $project -region $region -repo $cfg["AR_REPO"]

# 6) BigQuery datasets
Ensure-BQDataset -project $project -dataset $cfg["BQ_DATASET_MARKETING"] -location $multiRegion
Ensure-BQDataset -project $project -dataset $cfg["BQ_DATASET_TRAINING"] -location $multiRegion
Ensure-BQDataset -project $project -dataset $cfg["BQ_DATASET_EVAL"] -location $multiRegion

# 7) Secrets
$secretNames = @()
if ($cfg.ContainsKey("SECRET_NAMES")) {
  $secretNames = $cfg["SECRET_NAMES"].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
}
foreach ($secret in $secretNames) {
  Ensure-Secret -project $project -secretName $secret -CreateValue:$CreatePlaceholderSecrets
}

# 8) Seed folder markers
$folders = @(
  "models/",
  "datasets/raw/",
  "datasets/processed/",
  "training/jobs/",
  "eval/reports/",
  "artifacts/marketing/",
  "artifacts/agents/"
)
$tmpReadme = New-TemporaryFile
"LaunchBase bootstrap marker" | Set-Content -Path $tmpReadme
foreach ($f in $folders) {
  gsutil cp $tmpReadme ("gs://{0}/{1}README.txt" -f $cfg["PIPELINE_BUCKET"], $f) | Out-Null
}
Remove-Item $tmpReadme -Force

Write-Host ""
Write-Host "Bootstrap complete."
Write-Host "Project:                $project"
Write-Host "Region:                 $region"
Write-Host "Orchestrator SA:        $orchestratorSa"
Write-Host "Vertex Runner SA:       $runnerSa"
Write-Host "Models bucket:          gs://$($cfg["MODELS_BUCKET"])"
Write-Host "Data bucket:            gs://$($cfg["DATA_BUCKET"])"
Write-Host "Artifacts bucket:       gs://$($cfg["ARTIFACTS_BUCKET"])"
Write-Host "Pipeline bucket:        gs://$($cfg["PIPELINE_BUCKET"])"
Write-Host "Artifact Registry repo: $($cfg["AR_REPO"])"
Write-Host ""
Write-Host "Next: run scripts\\gcp\\submit_vertex_marketing_job.ps1 -ConfigPath $ConfigPath"
