param(
  [Parameter(Mandatory = $true)][string]$HostName,
  [string]$Registry = "registry.cn-hangzhou.aliyuncs.com",
  [string]$ImageTag = "latest"
)

$remoteCmd = "cd /opt/magictools && echo REGISTRY={0} > .env && echo IMAGE_TAG={1} >> .env && docker compose -f infra/compose.prod.yml pull && docker compose -f infra/compose.prod.yml up -d && docker image prune -f" -f $Registry, $ImageTag
ssh $HostName $remoteCmd
Write-Host "部署完成: $HostName (registry={0}, tag={1})" -f $Registry, $ImageTag
