param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$BackupDir = "./backups"
)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = "magictools-$stamp.dump.gz"
if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null }
ssh $HostName "docker exec magictools-postgres-1 pg_dump -U postgres magictools | gzip > /tmp/$file"
scp ("{0}:/tmp/{1}" -f $HostName, $file) (Join-Path $BackupDir $file)
ssh $HostName "rm -f /tmp/$file"
Get-ChildItem $BackupDir -Filter "*.dump.gz" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
Write-Host "备份完成: $file（本地保留最近 15 份）"
