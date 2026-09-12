# Serialize user arguments as data before crossing PowerShell's native argv boundary.
# The fixed bootstrap preserves native PowerShell capture, redirection, and pipelines.
$ErrorActionPreference = "Stop"
$backupExit = 1
$backupConsoleEncoding = [Console]::OutputEncoding

try {
  $backupNode = @(Get-Command node -CommandType Application -ErrorAction Stop)[0]
  $backupJson = ConvertTo-Json -InputObject @($args | ForEach-Object { [string]$_ }) -Compress
  $backupPayload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($backupJson))
  $backupArguments = @((Join-Path $PSScriptRoot "scripts/backup-powershell.mjs"), $backupPayload)
  [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
  # Native stderr is a nonterminating ErrorRecord in Windows PowerShell 5.1.
  # Neither that record nor a native nonzero exit may abort stream delivery.
  $ErrorActionPreference = "Continue"
  $PSNativeCommandUseErrorActionPreference = $false
  & $backupNode.Source @backupArguments
  $backupExit = $LASTEXITCODE
} catch {
  Write-Error "Unable to start the backup CLI. Check Node.js 20+ and the script path." -ErrorAction Continue
} finally {
  [Console]::OutputEncoding = $backupConsoleEncoding
}
exit $backupExit
