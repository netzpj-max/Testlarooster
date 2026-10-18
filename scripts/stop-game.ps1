$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPidFile = Join-Path $taskRoot 'artifacts\server.pid'
if (Test-Path -LiteralPath $taskPidFile) {
  $taskServerPid = [int](Get-Content -LiteralPath $taskPidFile)
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $taskServerPid" -ErrorAction SilentlyContinue
  $taskExpected = Join-Path $PSScriptRoot 'serve.mjs'
  if ($taskProcess -and $taskProcess.Name -eq 'node.exe' -and $taskProcess.CommandLine.Contains($taskExpected)) {
    Stop-Process -Id $taskServerPid
  }
  Remove-Item -LiteralPath $taskPidFile
}
