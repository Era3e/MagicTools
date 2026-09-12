# 整集群备份与独立恢复

已提供创建、校验、恢复、保留清理、失败告警、SSH复制和恢复应用交接入口。本机八库恢复、保留、HTTP告警、同机真实SSH传输，以及17应用的恢复/回退/故障/外联隔离均已实测并独立复核。源码和候选交付状态见[恢复部署验证记录](../validation/2026-09-12-restored-deployment.md)，数据库或应用回执不等同于生产上线。

## 准备

运行机需有Node.js 20或以上、Docker及源实例的管理权限。源为PG16主库，八个业务库位于同一PGDATA；实例须能通过容器内postgres账户执行只读管理查询，并有固定digest的运行镜像。额外表空间、外置配置、数据目录符号链接或不足的复制资源会明确拒绝。

准备两个独立私有文件，放在备份目录之外：

| 文件 | 内容 | 用途 |
|---|---|---|
| 数据库凭证JSON | 参考infra/backup-credentials.example.json，填写user和password | 临时工具容器通过TCP连接源实例执行pg_basebackup；账户需要复制与相应管理权限 |
| 二进制密钥文件 | 32字节随机值 | 加密备份文件并认证完整清单；恢复时必须使用原密钥 |

凭证密码不能为空或含换行。`.private/`、`backups/`和`*.backup-key`已排除于Git。首次可在项目根目录生成密钥，已有同名文件会失败，不会覆盖：

```sh
node -e "const fs=require('node:fs'); fs.mkdirSync('.private',{recursive:true,mode:0o700}); fs.writeFileSync('.private/magictools.backup-key',require('node:crypto').randomBytes(32),{flag:'wx',mode:0o600});"
```

备份目录绑定一个数据库集群和一个密钥。轮换密钥时使用新目录；旧目录与原密钥保留到对应备份不再需要。角色密码、业务数据和配置文件可能包含秘密，不能把解密内容放入Git或CI公开制品。

## 创建备份

以下命令在Windows使用pnpm.cmd：

```sh
pnpm backup:create --container my-postgres --directory /backups/magictools --key-file /private/magictools.backup-key --credentials-file /private/backup-credentials.json
```

命令按当前ports.yaml检查业务库清单。独立复制的脚本使用`--catalog /path/to/ports.json`提供相同清单。

源实例保持运行。工具使用专用临时卷执行整集群物理备份，携带基础数据和恢复所需WAL；原生校验后，从备份启动另一个隔离PG，核对集群身份、数据库、角色及扩展。验证通过后逐文件认证加密，并原子发布`backup-<backupId>`目录。

目录包含三个密文文件和认证清单backup.json。清单记录源码之外的实际数据库身份、固定镜像、平台、WAL范围和验证结果；不是SQL逻辑导出，不支持直接跨PG大版本或平台恢复。每文件上限32GiB，超过限制会失败。

配置检查会同时读取当前运行路径和下次启动生效的路径，遍历include、include_if_exists、include_dir以及认证文件的@文件引用。数据目录内的空文件、嵌套引用和合法待重启设置可保留；目录外的依赖不能静默漏备。

## 保留与清理

创建成功后默认保留最近15份，可用`--keep 30`调整；本次创建的备份始终占一个保留名额，即使系统时钟回拨也不会成功返回已经被清理的路径。其余名额按认证清单的完成时间选择，文件修改时间不作为依据。手工清理使用同一目录锁：

```sh
pnpm backup:prune --directory /backups/magictools --key-file /private/magictools.backup-key --keep 15
```

真正删除前重新检查全部候选密文摘要，包括准备留下的副本；任一摘要不符就停止清理，避免删掉最后一份完好备份。目录必须属于该store、清单已认证且原生恢复验证通过；含额外文件、软链接、身份不符或未完成的目录会被跳过，并列入`skipped`。跳过的目录仍占磁盘空间，需检查回执并人工核对，不能把保留份数当作磁盘容量保证。

删除逐份先移入`.pruning-`隔离目录，复核归属后仅删除已知文件；失败会保留隔离现场并非零退出。锁或store标识在异步校验后发生变化，也会中止。未到清理阈值时不会因为`prune`成功就声称重读了所有历史密文，定期完整校验仍使用`backup:verify`。

## 失败告警

每个CLI失败都会在默认`.qa/backup-events/`或`--events-dir`指定的持久目录记录事件和投递回执，包含操作、阶段、备份ID和脱敏错误码。前置参数错误、密钥读取失败及取得store锁之前的失败也有事件；不依赖备份目录已经初始化。

可在备份目录和事件目录之外保存一个私有webhook配置：

```json
{
  "schema": "magictools-backup-alert/1",
  "type": "webhook",
  "url": "https://alerts.example.com/webhooks/magictools",
  "headers": { "Authorization": "Bearer replace-with-your-webhook-token" },
  "timeoutMilliseconds": 5000
}
```

将示例地址及token替换为自己的接收服务后，在命令末尾加`--notify-config /private/backup-alert.json --events-dir /var/lib/magictools/backup-events`。接收方收到`{text,event}`的JSON；当前为通用HTTP webhook，HTTP 2xx表示接收端接受请求，不代表飞书等平台的业务码已验证或用户已阅读。无配置明确返回`not-configured`；投递拒绝、超时或配置错误分别记录，原始备份失败始终保持非零退出。

告警不携带原始异常、URL、授权头或数据库口令，不跟随HTTP重定向。本地事件落盘失败时仍尝试投递，并在CLI结果内报告`persistence`失败。生产任务需把事件目录放在持久磁盘上，并通过systemd状态或独立监控发现进程没启动、漏跑及整机不可达等没有机会发送webhook的故障。

## SSH复制到备份机

在备份机执行以下命令，源主机需要Node.js 20以上、Docker、GNU sha256sum、OpenSSH的scp/sftp及已配置的SSH登录；备份机也需要Docker以实际解密和恢复校验。主机密钥必须已进入known_hosts，工具固定使用BatchMode和严格主机校验，不等待交互式密码。

```sh
pnpm backup:ssh --host magictools-source --container my-postgres --remote-directory /opt/magictools/backup-runner --remote-store /var/backups/magictools --remote-key-file /etc/magictools/backup/private.key --remote-credentials-file /etc/magictools/backup/credentials.json --directory /backups/magictools --key-file /private/magictools.backup-key --keep 15 --remote-keep 15
```

本地与源端必须已分别保存同一32字节备份密钥。数据库凭证只在源端使用；SSH仅上传公开脚本、ports.json和脚本摘要文件，命令传递远端私有文件路径。可用`--ssh-config /private/ssh-config`选择独立SSH配置，其User、Port、IdentityFile和UserKnownHostsFile按OpenSSH规则生效。运行目录、源备份目录和私有文件须分离。

源端创建备份后，持源store锁复制完整密文到本轮独立导出目录；这样后续保留清理不会改变正在下载的副本。备份机核对回读回执、清单HMAC和全部密文，再在`.incoming-`临时store执行完整`backup:verify`；验证成功才发布正式备份目录和`copy-<operationId>.json`。本地保留也复用统一锁与默认15份策略。

只有副本验证通过后才清理远端本轮导出的重复密文，源正式备份始终保留。网络或下载失败会保留源端导出供核对，不能推进副本已验证状态；远端命令中断时报告结果未知。若本地副本已验证但远端导出清理失败，整体命令仍失败，回执明确`copyVerified=true`，便于运维修复清理问题。公开脚本和远端事件保留在本轮transfer目录中，不混入备份文件保留统计。

传输回执位于`.qa/backup-transfers/<operationId>/transport.json`。源清单完成时间、本地`verifiedAt`和恢复覆盖下界分别记录；复制到本机另一个SSH容器只能验证协议与流程，无法证明物理异地保障。生产源机与备份机的独立故障域、调度和恢复演练需在实际部署后核对。

## 校验备份

```sh
pnpm backup:verify --backup /backups/magictools/backup-<backupId> --key-file /private/magictools.backup-key
```

命令先认证清单，再验证密文、解密到新卷、检查PG原生备份和WAL，并启动隔离数据库核对目录信息。完成后清理全部临时实例和卷。错误密钥、缺文件、篡改或恢复失败不会返回成功。镜像缓存中已有相同平台的固定digest时直接使用，缺少时才拉取。

## 恢复到独立实例

```sh
pnpm backup:restore --backup /backups/magictools/backup-<backupId> --key-file /private/magictools.backup-key --target recovered-magictools
```

目标容器、网络、卷必须不存在。成功后保留新的数据库实例和独立内部网络，返回其名称；不会覆盖原数据库、角色密码或应用env。恢复后的角色密码来自备份，新的POSTGRES_PASSWORD不会重置它。

当前实例可以通过Docker命令检查：

```sh
docker exec --user postgres recovered-magictools psql -U postgres -d postgres -c "SELECT datname FROM pg_database WHERE NOT datistemplate;"
```

恢复入口保留独立数据库，不自动修改现有应用连接地址。需要启动应用时，继续按[恢复应用操作章节](restored-deployment.md)执行`backup:handoff`，生成v2绑定配置后部署17个应用。备份之后的写入没有连续WAL归档保障，不能据此承诺任意时间点恢复或零数据损失。

## 查看失败与验证记录

已初始化的备份目录保存`attempt-<operationId>.json`，记录阶段、成功与否和清理情况。未完成目录使用`.pending-`前缀，不能作为正式备份恢复。目录锁用于防止并发操作，遇到遗留锁应先确认原任务和所属Docker资源的实际状态。

`pnpm backup:validate`在全新容器和卷中写入八库标记、角色和向量数据，再通过命令入口创建加密备份、恢复和校验；报告位于`.qa/backup-validation/`，绑定源码指纹。测试会检查备份后数据边界、角色密码及读写权限，最后清理测试资源。

报告记录源数据库时间、已恢复和未恢复的样本、提交后的确认时间，以及实际数据库恢复耗时。RPO给出本机样本支持的区间，使用微秒比较、毫秒向外取整；RTO涵盖镜像选择、解密、原生校验、启动、目录与业务检查及临时资源清理。明确标记热镜像缓存和测试规模，不计未发生的备份下载、应用切换或异机恢复。这些数据不等同于生产SLA。

CI的smoke阶段也执行该真实演练，增加两份真实备份的自动保留、手工prune幂等，以及已有目标拒绝时的本机HTTP告警。backup-evidence制品仅保存身份绑定的摘要、公开清单、目录标识、操作与投递回执。测试密钥、私有凭证和备份密文不上传。Windows包装、systemd样例及漏跑排查见[定时备份运维说明](backup-scheduling.md)，样例不会自动安装或启用生产任务。
