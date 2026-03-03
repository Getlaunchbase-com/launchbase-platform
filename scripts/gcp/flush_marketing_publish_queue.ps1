param(
  [string]$QueueDir = "C:\Users\Monica Morreale\agent-runs\publish-queue"
)

$ErrorActionPreference = "Continue"

function Test-GcloudReachable {
  try {
    $t = Test-NetConnection oauth2.googleapis.com -Port 443 -WarningAction SilentlyContinue
    return [bool]$t.TcpTestSucceeded
  } catch {
    return $false
  }
}

if (-not (Test-Path $QueueDir)) {
  Write-Host "No publish queue directory: $QueueDir"
  exit 0
}

$items = Get-ChildItem $QueueDir -Filter "publish-intent-*.json" | Sort-Object LastWriteTime
if (-not $items) {
  Write-Host "No queued publish intents."
  exit 0
}

# Always dedupe queue first, even when GCP is unreachable.
$dedupeSeen = @{}
foreach ($it in $items) {
  try {
    $intent = Get-Content $it.FullName -Raw | ConvertFrom-Json
    $key = "$($intent.latestPack)|$($intent.datasetDest)|$($intent.artifactDest)"
    if ($dedupeSeen.ContainsKey($key)) {
      Remove-Item $it.FullName -Force -ErrorAction SilentlyContinue
      Write-Host "Removed duplicate queued intent: $($it.Name)"
      continue
    }
    $dedupeSeen[$key] = $true
  } catch {
    Write-Host "Malformed queue intent kept for manual inspection: $($it.Name)" -ForegroundColor Yellow
  }
}

$items = Get-ChildItem $QueueDir -Filter "publish-intent-*.json" | Sort-Object LastWriteTime
if (-not $items) {
  Write-Host "No queued publish intents after dedupe."
  exit 0
}

if (-not (Test-GcloudReachable)) {
  Write-Host "GCP lane unreachable (oauth2:443). Leaving deduped queued intents in place."
  exit 0
}

$seen = @{}
foreach ($it in $items) {
  try {
    $intent = Get-Content $it.FullName -Raw | ConvertFrom-Json
    $key = "$($intent.latestPack)|$($intent.datasetDest)|$($intent.artifactDest)"
    if ($seen.ContainsKey($key)) {
      Remove-Item $it.FullName -Force -ErrorAction SilentlyContinue
      Write-Host "Removed duplicate queued intent: $($it.Name)"
      continue
    }
    $seen[$key] = $true
    Write-Host "Flushing intent: $($it.Name)"

    & gcloud.cmd storage cp -r "$($intent.latestPack)" "$($intent.datasetDest)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pack->dataset failed" }
    & gcloud.cmd storage cp -r "$($intent.latestPack)" "$($intent.artifactDest)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pack->artifact failed" }

    foreach ($f in $intent.files) {
      & gcloud.cmd storage cp -r "$f" "$($intent.artifactDest)" | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "file->artifact failed: $f" }
    }

    $tmp = New-TemporaryFile
    ($intent.handoff | ConvertTo-Json -Depth 8) | Out-File -FilePath $tmp -Encoding utf8
    & gcloud.cmd storage cp -r "$tmp" "$($intent.artifactDest)/vertex-handoff.json" | Out-Null
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue

    Remove-Item $it.FullName -Force
    Write-Host "Flushed and removed: $($it.Name)" -ForegroundColor Green
  } catch {
    Write-Host "Flush failed (kept queued): $($it.Name) :: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
