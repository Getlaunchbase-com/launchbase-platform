param(
  [Parameter(Mandatory = $false)]
  [string]$ConfigPath = ".\scripts\gcp\launchbase_gcp.env",
  [Parameter(Mandatory = $false)]
  [string]$DisplayName = "",
  [Parameter(Mandatory = $false)]
  [string]$ModelDropPath = "models/",
  [Parameter(Mandatory = $false)]
  [string]$DatasetDropPath = "datasets/processed/",
  [switch]$DryRun
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

$cfg = Load-EnvFile $ConfigPath
$project = $cfg["PROJECT_ID"]
$region = $cfg["REGION"]
$runnerSa = "{0}@{1}.iam.gserviceaccount.com" -f $cfg["PIPELINE_RUNNER_SA_ID"], $project
$imageUri = $cfg["TRAINING_IMAGE_URI"]

if (-not $DisplayName) {
  $DisplayName = "launchbase-marketing-train-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

$jobConfig = @"
{
  "displayName": "$DisplayName",
  "jobSpec": {
    "serviceAccount": "$runnerSa",
    "workerPoolSpecs": [
      {
        "machineSpec": {
          "machineType": "n1-standard-8",
          "acceleratorType": "NVIDIA_TESLA_T4",
          "acceleratorCount": 1
        },
        "replicaCount": "1",
        "containerSpec": {
          "imageUri": "$imageUri",
          "command": ["python","-m","trainer.marketing_train"],
          "args": [
            "--project_id=$project",
            "--region=$region",
            "--models_bucket=gs://$($cfg["MODELS_BUCKET"])/$ModelDropPath",
            "--dataset_bucket=gs://$($cfg["DATA_BUCKET"])/$DatasetDropPath",
            "--artifacts_bucket=gs://$($cfg["ARTIFACTS_BUCKET"])/training/jobs/$DisplayName",
            "--bq_marketing_dataset=$($cfg["BQ_DATASET_MARKETING"])",
            "--bq_training_dataset=$($cfg["BQ_DATASET_TRAINING"])",
            "--bq_eval_dataset=$($cfg["BQ_DATASET_EVAL"])"
          ]
        }
      }
    ]
  }
}
"@

$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value $jobConfig -Encoding UTF8

Write-Host "Prepared Vertex custom job config: $tmp"
Write-Host "Display name: $DisplayName"
Write-Host "Image: $imageUri"
Write-Host "Model input: gs://$($cfg["MODELS_BUCKET"])/$ModelDropPath"
Write-Host "Data input:  gs://$($cfg["DATA_BUCKET"])/$DatasetDropPath"

if ($DryRun) {
  Write-Host "DryRun enabled; not submitting job."
  exit 0
}

& gcloud.cmd config set project $project | Out-Null
& gcloud.cmd ai custom-jobs create --region=$region --config=$tmp --project=$project

Write-Host "Submitted Vertex custom job: $DisplayName"
