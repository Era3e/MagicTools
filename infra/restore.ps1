# Restore always uses the same validated Node CLI as backup.ps1.
$ErrorActionPreference = "Stop"
try {
  $restoreArguments = @("restore") + @($args)
  & (Join-Path $PSScriptRoot "backup.ps1") @restoreArguments
  exit $LASTEXITCODE
} catch {
  Write-Error "Unable to start the restore CLI. Check backup.ps1 and Node.js 20+." -ErrorAction Continue
  exit 1
}
