param(
  [string]$HealthUrl,
  [switch]$SkipTypecheck,
  [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'

function Step($message) {
  Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Warn($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Fail($message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

$hadError = $false

try {
  Step "Repository status"
  $branch = (git rev-parse --abbrev-ref HEAD).Trim()
  $lastCommit = (git log -1 --oneline).Trim()
  $status = git status --short

  Ok "Branch: $branch"
  Ok "Last commit: $lastCommit"

  if ($status) {
    Warn "Working tree is not clean:"
    $status | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
  } else {
    Ok "Working tree is clean"
  }
} catch {
  $hadError = $true
  Fail "Unable to read git repository status: $($_.Exception.Message)"
}

if (-not $SkipTypecheck) {
  try {
    Step "Type check"
    npm run typecheck | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Typecheck failed with exit code $LASTEXITCODE"
    }
    Ok "Typecheck passed"
  } catch {
    $hadError = $true
    Fail "$($_.Exception.Message)"
  }
} else {
  Warn "Typecheck skipped"
}

if (-not $SkipHealthCheck) {
  if (-not $HealthUrl) {
    Warn "HealthUrl not provided (use -HealthUrl https://your-app/api/health)"
  } else {
    try {
      Step "Health check"
      $response = Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing -TimeoutSec 20
      Ok "HTTP status: $($response.StatusCode)"

      $body = $null
      try {
        $body = $response.Content | ConvertFrom-Json
      } catch {
        Warn "Health response is not valid JSON"
      }

      if ($body) {
        $statusValue = $body.status
        if ($statusValue -eq 'ok' -or $statusValue -eq 'OK') {
          Ok "Health payload status: $statusValue"
        } elseif ($statusValue) {
          Warn "Health payload status: $statusValue"
        } else {
          Warn "Health payload has no 'status' field"
        }
      }
    } catch {
      $hadError = $true
      Fail "Health check failed: $($_.Exception.Message)"
    }
  }
} else {
  Warn "Health check skipped"
}

Step "Summary"
if ($hadError) {
  Fail "Release check completed with errors"
  exit 1
}

Ok "Release check completed successfully"
exit 0
