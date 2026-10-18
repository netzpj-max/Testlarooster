param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskUrl = 'http://127.0.0.1:4188/'
function Test-GameReady {
  try {
    $taskResponse = Invoke-WebRequest -Uri $taskUrl -UseBasicParsing -TimeoutSec 2
    return $taskResponse.StatusCode -eq 200 -and $taskResponse.Content.Contains('TESTLA ROOSTER')
  } catch { return $false }
}
if (-not (Test-GameReady)) {
  $taskNode = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $taskNode) { throw 'Node.js was not found. Install Node.js, then run START-GAME.cmd again.' }
  New-Item -ItemType Directory -Path (Join-Path $taskRoot 'artifacts') -Force | Out-Null
  $taskServer = Join-Path $PSScriptRoot 'serve.mjs'
  $taskProcess = Start-Process -FilePath $taskNode.Source -ArgumentList @('"' + $taskServer + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'artifacts\server.log') -RedirectStandardError (Join-Path $taskRoot 'artifacts\server-error.log')
  Set-Content -LiteralPath (Join-Path $taskRoot 'artifacts\server.pid') -Value $taskProcess.Id
  $taskReady = $false
  for ($taskAttempt = 0; $taskAttempt -lt 25; $taskAttempt++) {
    if (Test-GameReady) { $taskReady = $true; break }
    Start-Sleep -Milliseconds 150
  }
  if (-not $taskReady) { throw 'The local game server did not start. See artifacts/server-error.log.' }
}
if (-not $NoBrowser) { Start-Process $taskUrl }
Write-Output 'TESTLA ROOSTER is ready. Run STOP-GAME.cmd when finished.'
