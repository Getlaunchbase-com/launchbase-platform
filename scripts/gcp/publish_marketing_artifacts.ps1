param(
  [string]$RepoRoot = "C:\Users\Monica Morreale\Downloads\launchbase-platform",
  [string]$ConfigPath = "C:\Users\Monica Morreale\Downloads\launchbase-platform\scripts\gcp\launchbase_gcp.env",
  [switch]$DryRun,
  [string]$QueueDir = "C:\Users\Monica Morreale\agent-runs\publish-queue"
)

$ErrorActionPreference = "Stop"

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return @{} }
  $vars = @{}
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      $vars[$parts[0].Trim()] = $parts[1].Trim()
    }
  }
  return $vars
}

function Latest-Dir([string]$base, [string]$prefix) {
  if (-not (Test-Path $base)) { return "" }
  return Get-ChildItem $base -Directory |
    Where-Object { $_.Name.StartsWith($prefix) } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

function Latest-File([string]$base, [string]$pattern) {
  if (-not (Test-Path $base)) { return "" }
  return Get-ChildItem $base -File |
    Where-Object { $_.Name -match $pattern } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

function Copy-ToGcs([string]$src, [string]$dest) {
  if (-not $src) { return }
  if ($DryRun) {
    Write-Host "[dryrun] gcloud storage cp -r `"$src`" `"$dest`""
    return
  }
  & gcloud.cmd storage cp -r "$src" "$dest"
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud storage cp failed: $src -> $dest"
  }
}

function Queue-PublishIntent([object]$intent) {
  if (-not (Test-Path $QueueDir)) { New-Item -ItemType Directory -Path $QueueDir -Force | Out-Null }
  $existing = Get-ChildItem $QueueDir -Filter "publish-intent-*.json" -ErrorAction SilentlyContinue
  foreach ($e in $existing) {
    try {
      $parsed = Get-Content $e.FullName -Raw | ConvertFrom-Json
      if (
        $parsed.latestPack -eq $intent.latestPack -and
        $parsed.datasetDest -eq $intent.datasetDest -and
        $parsed.artifactDest -eq $intent.artifactDest
      ) {
        Write-Host "Publish intent already queued: $($e.Name)" -ForegroundColor Yellow
        return
      }
    } catch {
      # Ignore malformed queue files and continue.
    }
  }
  $file = Join-Path $QueueDir ("publish-intent-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json")
  ($intent | ConvertTo-Json -Depth 8) | Out-File -FilePath $file -Encoding utf8
  Write-Host "Queued publish intent: $file" -ForegroundColor Yellow
}

function Test-GcloudReachable {
  try {
    $t = Test-NetConnection oauth2.googleapis.com -Port 443 -WarningAction SilentlyContinue
    return [bool]$t.TcpTestSucceeded
  } catch {
    return $false
  }
}

$cfg = Load-EnvFile $ConfigPath
$project = if ($cfg.ContainsKey("PROJECT_ID")) { $cfg["PROJECT_ID"] } else { $env:PROJECT_ID }
$modelsBucket = if ($cfg.ContainsKey("MODELS_BUCKET")) { $cfg["MODELS_BUCKET"] } else { $env:MODELS_BUCKET }
$dataBucket = if ($cfg.ContainsKey("DATA_BUCKET")) { $cfg["DATA_BUCKET"] } else { $env:DATA_BUCKET }
$artifactsBucket = if ($cfg.ContainsKey("ARTIFACTS_BUCKET")) { $cfg["ARTIFACTS_BUCKET"] } else { $env:ARTIFACTS_BUCKET }
if (-not $dataBucket) { $dataBucket = $modelsBucket }
if (-not $artifactsBucket) { $artifactsBucket = $modelsBucket }

if (-not $project -or -not $dataBucket -or -not $artifactsBucket) {
  throw "PROJECT_ID, DATA_BUCKET, ARTIFACTS_BUCKET required (via $ConfigPath or process env vars)."
}

$runs = Join-Path $RepoRoot "runs\marketing"
$latestPack = Latest-Dir $runs "fine-tune-pack-"
$latestSwarm = Latest-File $runs "^swarm-improve-\d+\.md$"
$latestOps = Latest-File $runs "^ops-cycle-\d+\.json$"
$latestReflection = Latest-File $runs "^ops-reflection-\d+\.md$"
$latestCorpus = Latest-File $runs "^corpus-manifest-\d+\.json$"
$latestBacklog = Latest-File $runs "^agency-learning-backlog-\d+\.json$"

if (-not $latestPack) {
  throw "No fine-tune pack found in $runs"
}

$stamp = Get-Date -Format "yyyy/MM/dd"
$packName = Split-Path $latestPack -Leaf
$datasetDest = "gs://$dataBucket/datasets/processed/marketing/$stamp/$packName/"
$artifactDest = "gs://$artifactsBucket/training/marketing/$stamp/$packName/"

Write-Host "Publishing marketing artifacts..."
Write-Host "Pack: $latestPack"
Write-Host "Dataset dest:  $datasetDest"
Write-Host "Artifact dest: $artifactDest"

 $handoff = @{
  publishedAt = (Get-Date).ToUniversalTime().ToString("o")
  projectId = $project
  datasetBucket = $dataBucket
  artifactsBucket = $artifactsBucket
  fineTunePackLocal = $latestPack
  fineTunePackDatasetGcs = $datasetDest
  fineTunePackArtifactsGcs = $artifactDest
  related = @{
    swarmImprove = $latestSwarm
    opsCycle = $latestOps
    opsReflection = $latestReflection
    corpusManifest = $latestCorpus
    learningBacklog = $latestBacklog
  }
} | ConvertTo-Json -Depth 6

$intent = @{
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  latestPack = $latestPack
  datasetDest = $datasetDest
  artifactDest = $artifactDest
  files = @($latestSwarm, $latestOps, $latestReflection, $latestCorpus, $latestBacklog) | Where-Object { $_ }
  handoff = ($handoff | ConvertFrom-Json)
}

if (-not $DryRun -and -not (Test-GcloudReachable)) {
  Write-Host "GCP lane unreachable (oauth2:443). Deferring publish." -ForegroundColor Yellow
  Queue-PublishIntent -intent $intent
  exit 0
}

if (-not $DryRun) {
  try {
    & gcloud.cmd config set project $project | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "gcloud config set project failed"
    }
  } catch {
    Write-Host "Unable to set gcloud project. Deferring publish." -ForegroundColor Yellow
    Queue-PublishIntent -intent $intent
    exit 0
  }
}

try {
  Copy-ToGcs -src $latestPack -dest $datasetDest
  Copy-ToGcs -src $latestPack -dest $artifactDest
  foreach ($f in @($latestSwarm, $latestOps, $latestReflection, $latestCorpus, $latestBacklog)) {
    if ($f) { Copy-ToGcs -src $f -dest $artifactDest }
  }
  $tmp = New-TemporaryFile
  $handoff | Out-File -FilePath $tmp -Encoding utf8
  Copy-ToGcs -src $tmp -dest "$artifactDest/vertex-handoff.json"
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Write-Host "Publish complete."
} catch {
  Write-Host "Publish failed; deferring to queue: $($_.Exception.Message)" -ForegroundColor Yellow
  Queue-PublishIntent -intent $intent
}
