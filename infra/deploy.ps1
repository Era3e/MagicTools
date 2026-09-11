param(
  [string]$ReleaseDirectory,
  [string]$ConfigFile,
  [string]$SecretsFile,
  [string]$StateDirectory,
  [string]$HostName,
  [string]$RemoteDirectory = "/opt/magictools/deployer",
  [switch]$Rollback,
  [switch]$Validation
)

$ErrorActionPreference = "Stop"
if (-not $SecretsFile -or -not $StateDirectory) { throw "必须指定SecretsFile和StateDirectory；秘密文件需预先存在" }
if (-not $Rollback -and (-not $ReleaseDirectory -or -not $ConfigFile)) { throw "部署必须指定ReleaseDirectory和ConfigFile" }
if ($Rollback -and ($ReleaseDirectory -or $ConfigFile)) { throw "回退使用成功快照，不接受新制品或配置" }

$deployScript = if ($HostName) { Join-Path $PSScriptRoot "scripts/deploy-ssh.mjs" } else { Join-Path $PSScriptRoot "scripts/deploy-release.mjs" }
$deployArgs = @($deployScript, "--secrets", $SecretsFile, "--state-dir", $StateDirectory)
if ($Rollback) { $deployArgs += "--rollback" }
else { $deployArgs += @("--release", $ReleaseDirectory, "--config", $ConfigFile) }
if ($HostName) { $deployArgs += @("--host", $HostName, "--remote-dir", $RemoteDirectory) }
if ($Validation) { $deployArgs += "--validation" }

& node @deployArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "部署流程完成，详细状态见上方回执。"
