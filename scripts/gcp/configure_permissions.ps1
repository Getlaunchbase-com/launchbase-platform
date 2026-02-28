param(
  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = ".\scripts\gcp\launchbase_gcp.env",
  [Parameter(Mandatory = $false)]
  [string]$EngineerEmail = ""
)

$ErrorActionPreference = "Stop"

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

function Add-ProjectRole([string]$project, [string]$member, [string]$role) {
  Write-Host "Granting $role to $member"
  & gcloud.cmd projects add-iam-policy-binding $project --member $member --role $role --quiet | Out-Null
}

function Add-SecretAccessor([string]$project, [string]$secretName, [string]$member) {
  Write-Host "Granting secretAccessor on $secretName to $member"
  & gcloud.cmd secrets add-iam-policy-binding $secretName `
    --member=$member `
    --role=roles/secretmanager.secretAccessor `
    --project=$project | Out-Null
}

$cfg = Load-EnvFile $ConfigPath
$project = $cfg["PROJECT_ID"]
if (-not $project) { throw "PROJECT_ID missing in config" }

$orchestratorSa = "{0}@{1}.iam.gserviceaccount.com" -f $cfg["ORCHESTRATOR_SA_ID"], $project
$runnerSa = "{0}@{1}.iam.gserviceaccount.com" -f $cfg["PIPELINE_RUNNER_SA_ID"], $project

& gcloud.cmd config set project $project | Out-Null

# Runtime service accounts (least-privilege runtime additions)
$runtimeRoles = @(
  "roles/aiplatform.user",
  "roles/storage.objectAdmin",
  "roles/bigquery.dataEditor",
  "roles/bigquery.jobUser",
  "roles/artifactregistry.reader",
  "roles/logging.logWriter",
  "roles/monitoring.metricWriter"
)

foreach ($role in $runtimeRoles) {
  Add-ProjectRole -project $project -member "serviceAccount:$orchestratorSa" -role $role
  Add-ProjectRole -project $project -member "serviceAccount:$runnerSa" -role $role
}

# Secret access for runtime SAs
$secretNames = @()
if ($cfg.ContainsKey("SECRET_NAMES")) {
  $secretNames = $cfg["SECRET_NAMES"].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
}
foreach ($s in $secretNames) {
  Add-SecretAccessor -project $project -secretName $s -member "serviceAccount:$orchestratorSa"
  Add-SecretAccessor -project $project -secretName $s -member "serviceAccount:$runnerSa"
}

# Optional engineer access
if ($EngineerEmail) {
  $eng = "user:$EngineerEmail"
  $engineerRoles = @(
    "roles/viewer",
    "roles/aiplatform.user",
    "roles/storage.objectAdmin",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/secretmanager.secretAccessor",
    "roles/artifactregistry.reader",
    "roles/logging.viewer",
    "roles/monitoring.viewer"
  )
  foreach ($role in $engineerRoles) {
    Add-ProjectRole -project $project -member $eng -role $role
  }
}

Write-Host ""
Write-Host "Permissions configured."
Write-Host "Project: $project"
Write-Host "Orchestrator SA: $orchestratorSa"
Write-Host "Runner SA: $runnerSa"
if ($EngineerEmail) { Write-Host "Engineer: $EngineerEmail" }
