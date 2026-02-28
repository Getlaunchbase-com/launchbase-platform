param(
  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = ".\scripts\gcp\launchbase_gcp.env",
  [Parameter(Mandatory = $false)]
  [string]$PolicyPath = ".\scripts\gcp\marketing_ops_policy.json"
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

function Test-GcloudResource([string[]]$args) {
  try {
    & gcloud.cmd @args 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
  } catch {
    return $false
  }
}

function Ensure-Api([string]$project, [string]$service) {
  $enabled = & gcloud.cmd services list --enabled --project $project --format="value(config.name)" 2>$null
  if ($enabled -contains $service) {
    Write-Host "API already enabled: $service"
  } else {
    Write-Host "Enabling API: $service"
    & gcloud.cmd services enable $service --project $project | Out-Null
  }
}

function Ensure-PubSubTopic([string]$project, [string]$topic) {
  $exists = Test-GcloudResource @("pubsub","topics","describe",$topic,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating Pub/Sub topic: $topic"
    & gcloud.cmd pubsub topics create $topic --project $project | Out-Null
  } else {
    Write-Host "Pub/Sub topic exists: $topic"
  }
}

function Ensure-PullSubscription([string]$project, [string]$topic, [string]$sub) {
  $exists = Test-GcloudResource @("pubsub","subscriptions","describe",$sub,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating Pub/Sub subscription: $sub"
    & gcloud.cmd pubsub subscriptions create $sub --topic $topic --project $project | Out-Null
  } else {
    Write-Host "Pub/Sub subscription exists: $sub"
  }
}

function Ensure-SchedulerPubSubJob([string]$project, [string]$region, [string]$jobName, [string]$schedule, [string]$tz, [string]$topic, [string]$payloadJson) {
  $exists = Test-GcloudResource @("scheduler","jobs","describe",$jobName,"--location",$region,"--project",$project)
  if (-not $exists) {
    Write-Host "Creating Scheduler job: $jobName ($schedule)"
    & gcloud.cmd scheduler jobs create pubsub $jobName `
      --location $region `
      --schedule $schedule `
      --time-zone $tz `
      --topic $topic `
      --message-body $payloadJson `
      --project $project | Out-Null
  } else {
    Write-Host "Updating Scheduler job: $jobName ($schedule)"
    & gcloud.cmd scheduler jobs update pubsub $jobName `
      --location $region `
      --schedule $schedule `
      --time-zone $tz `
      --topic $topic `
      --message-body $payloadJson `
      --project $project | Out-Null
  }
}

function Ensure-BQTable([string]$project, [string]$dataset, [string]$table, [string]$schema) {
  $tableRef = "$project`:$dataset.$table"
  & bq --project_id=$project show $tableRef 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating BigQuery table: $dataset.$table"
    & bq --project_id=$project mk --table $tableRef $schema | Out-Null
  } else {
    Write-Host "BigQuery table exists: $dataset.$table"
  }
}

if (-not (Test-Path $PolicyPath)) { throw "Policy file not found: $PolicyPath" }
$policy = Get-Content $PolicyPath -Raw | ConvertFrom-Json
$cfg = Load-EnvFile $ConfigPath

$project = $cfg["PROJECT_ID"]
$region = $cfg["REGION"]
$marketingDataset = $cfg["BQ_DATASET_MARKETING"]
if (-not $project -or -not $region -or -not $marketingDataset) {
  throw "PROJECT_ID, REGION, and BQ_DATASET_MARKETING are required."
}

& gcloud.cmd config set project $project | Out-Null

Ensure-Api -project $project -service "pubsub.googleapis.com"
Ensure-Api -project $project -service "cloudscheduler.googleapis.com"

# BigQuery tracking tables for autonomous marketing learning loop
Ensure-BQTable -project $project -dataset $marketingDataset -table "trend_snapshots" -schema "captured_at:TIMESTAMP,source:STRING,vertical:STRING,signal:STRING,score:FLOAT,raw:STRING"
Ensure-BQTable -project $project -dataset $marketingDataset -table "campaign_variants" -schema "created_at:TIMESTAMP,campaign_id:STRING,vertical:STRING,channel:STRING,variant_id:STRING,copy:STRING,status:STRING"
Ensure-BQTable -project $project -dataset $marketingDataset -table "ab_results" -schema "captured_at:TIMESTAMP,campaign_id:STRING,variant_id:STRING,impressions:INT64,clicks:INT64,replies:INT64,booked_calls:INT64,spend_usd:FLOAT"
Ensure-BQTable -project $project -dataset $marketingDataset -table "lead_events" -schema "captured_at:TIMESTAMP,lead_id:STRING,vertical:STRING,event_type:STRING,event_value:STRING,source:STRING"
Ensure-BQTable -project $project -dataset $marketingDataset -table "agent_run_audit" -schema "started_at:TIMESTAMP,finished_at:TIMESTAMP,job:STRING,status:STRING,rows_processed:INT64,cost_estimate_usd:FLOAT,notes:STRING"

foreach ($rule in $policy.rules) {
  if (-not $rule.approved) { continue }
  $topic = [string]$rule.topic
  $job = [string]$rule.job
  $schedule = [string]$rule.schedule
  $tz = [string]$policy.timezone
  $jobName = "lb-" + $job
  $subName = "$topic-sub"

  Ensure-PubSubTopic -project $project -topic $topic
  Ensure-PullSubscription -project $project -topic $topic -sub $subName

  $payload = @{
    job = $job
    approved = $true
    source = "cloud-scheduler"
    off_peak = $true
    max_runtime_minutes = $rule.max_runtime_minutes
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Compress

  Ensure-SchedulerPubSubJob -project $project -region $region -jobName $jobName -schedule $schedule -tz $tz -topic $topic -payloadJson $payload
}

Write-Host ""
Write-Host "Marketing ops bootstrap complete."
Write-Host "Project: $project"
Write-Host "Region: $region"
Write-Host "Dataset: $marketingDataset"
Write-Host "Policy: $PolicyPath"
Write-Host "Pre-approved jobs installed from policy."
