# 从备份恢复可访问的应用

本章说明如何把已经恢复的八业务库接入一个新应用项目，确认业务数据可读写，再进行应用升级或回退。适用于恢复演练和故障后的隔离验证；恢复项目默认阻断业务服务外联，正式入口切流和外部集成启用需另行实施。本地完整实机及独立验收已通过，候选CI与合并状态见[验证记录](../validation/2026-09-12-restored-deployment.md)。

## 1. 准备输入与独立目录

在恢复目标机准备Node.js 20或以上、Docker Compose（支持`up --wait`）、镜像仓库登录，以及以下文件。Windows将命令中的`pnpm`改为`pnpm.cmd`。

| 输入 | 取得方式 | 要求 |
|---|---|---|
| 加密备份目录 | `backup:create`或`backup:ssh`生成的`backup-<backupId>` | 完整清单与三个密文，保留原32字节密钥 |
| 成功恢复回执 | 备份store内的`attempt-<restoreOperationId>.json` | 来自本次`backup:restore`，不是create或verify回执 |
| 发布制品目录 | 已通过镜像验证的发布结果 | 含release.json及三个运行文件，镜像固定digest |
| v1公开配置 | 参考infra/deployment-config.example.json | 新项目名、空闲网关端口；默认仅绑定127.0.0.1 |
| 私有运行env | 独立于状态与备份目录保存 | 八库连接使用备份中保留的角色密码，另配置网关访问令牌 |
| 新部署状态目录 | 恢复机上的持久目录 | 首次交接无成功历史，后续部署和回退持续复用 |

建议分开放置：`/backups/magictools`保存备份，`/etc/magictools/private`保存密钥和env，`/etc/magictools/recovery`保存公开配置，`/var/lib/magictools/recovery-state`保存部署状态。交接输出必须在整个备份store之外，且目标文件不存在。

一个数据库恢复实例只能绑定一个部署状态目录与项目。换恢复实例需要另建项目和状态目录。原业务项目、源数据库及其数据卷应保持原样，便于验证和故障回溯。

## 2. 恢复数据库并确认回执

按[备份说明](backup-recovery.md)校验密钥和备份，然后在目标机执行：

```sh
pnpm backup:restore --backup /backups/magictools/backup-<backupId> --key-file /etc/magictools/private/cluster.backup-key --target recovered-magictools
```

`recovered-magictools`容器、同名`-net`网络和`-data`卷必须尚不存在。成功结果包含operationId；据此找到store内对应`attempt-<operationId>.json`，确认`operation=restore`、`success=true`、`stage=complete`和`result.catalogVerified=true`。不要依据容器名称或一次`pg_isready`代替成功回执。

恢复保留备份里的角色密码。修改env中的POSTGRES_PASSWORD不能重置恢复库的密码；后续只启动应用，数据库容器和卷由恢复流程保留。

## 3. 生成交接配置

公开基线仍使用v1格式，例如：

```json
{
  "schema": "magictools-deployment-config/1",
  "project": "magictools-recovery",
  "gatewayBind": "127.0.0.1",
  "gatewayPort": 5300,
  "waitTimeoutSeconds": 120
}
```

确认项目名未被使用、5300端口空闲，再在能够访问恢复实例的机器执行：

```sh
pnpm backup:handoff --backup /backups/magictools/backup-<backupId> --key-file /etc/magictools/private/cluster.backup-key --restore-receipt /backups/magictools/attempt-<restoreOperationId>.json --config /etc/magictools/recovery/base.json --output /etc/magictools/recovery/deployment.json
```

命令验证清单HMAC、全部密文、恢复回执，以及实际Docker资源、PG系统标识和八库目录，生成`magictools-deployment-config/2`。独立分发脚本时另传`--catalog /path/to/ports.json`。

生成文件保存容器及网络的完整ID、卷名称和创建时间、备份及恢复ID、固定PG镜像、平台和首次目录摘要。它不包含连接口令；请保留原文件，不手工替换ID或修改绑定。已有输出不会被覆盖，重复生成请换新输出文件名。

命令失败时检查store里的handoff回执和备份事件目录。若输出已经创建但后续回执/清锁失败，CLI仍失败并可能返回`output`路径；先核对残留和失败原因，不能仅因输出存在就认定交接成功。

## 4. 配置私有连接并启动17个应用

私有env需要八个变量：APPLICANT_DATABASE_URL、GATHERER_DATABASE_URL、INVESTIGATOR_DATABASE_URL、ASSESSOR_DATABASE_URL、MANAGER_DATABASE_URL、DESIGNER_DATABASE_URL、SCHOLAR_DATABASE_URL和ASSISTANT_DATABASE_URL。

每个变量使用`postgres://<用户>:<百分号编码的密码>@postgres:5432/<对应库名>`，也接受生成配置中的恢复容器名。用户名与密码不能为空；不接受其它主机、端口、连接查询参数或片段。库名必须与变量一致。GATEWAY_TOKEN按私有模板配置，其余集成设置仍保存在env中。

部署器让Compose解析env，在进程内把八个变量的目标重绑为恢复实例，同时覆盖四条跨库连接：Assessor→Investigator、Manager→Assessor、Scholar→Gatherer、Assistant→Scholar，共12条。原env和原始发布制品字节保持不变，公开Compose及回执不写入口令。

```sh
pnpm deploy:release --release /releases/selected --config /etc/magictools/recovery/deployment.json --secrets /etc/magictools/private/runtime.env --state-dir /var/lib/magictools/recovery-state
```

首次部署检查项目为空，再以Docker唯一名称创建归属claim，持久记录`reserved → initial-verified`，完成首次目录校验后才启动应用。claim保持created状态且不挂载恢复数据；这是正常的归属记录，不能当作废弃容器删除。

运行结构如下：

| 资源 | 网络 | 管理范围 |
|---|---|---|
| 8个server | 项目内部网、恢复数据库内部网 | Compose管理应用生命周期 |
| 8个web | 项目内部网 | 无宿主公开端口 |
| gateway | 项目内部网、专属ingress网 | 仅网关允许加入ingress并暴露配置端口 |
| 恢复PG | 原恢复内部网 | 不由应用Compose重建、停止或删除 |
| claim | none，永不启动 | 绑定恢复实例、项目与状态目录 |

业务定时任务可能在恢复库启动并写入本地任务记录，但业务服务没有外部路由。配置了真实集成凭证也不代表此隔离项目已能正常调用集成。不得为了让某个任务成功而直接给server接入任意外部网络。

## 5. 确认应用恢复成功

CLI返回成功后，从输出的attemptId定位`<state-dir>/attempts/<attemptId>/receipt.json`，核对：

1. `success=true`、`stage=succeeded`、`secretsPreserved=true`，17条ready全部健康且对应选定制品。
2. `database`匹配交接配置的容器、网络、卷、恢复ID、备份ID，且running与internalNetwork为true。
3. `databaseInitialVerification`包含首次验证时间和备份目录摘要；`databaseClaim`匹配项目和bindingHash；`databaseConnections`完整记录12条公开连接映射。
4. `state.json.current.attemptId`指向该成功回执。
5. 通过携带`x-access-token`的API或已配置认证的入口读取一条备份前已有记录；新增一条带唯一标记的测试记录，确认只出现在恢复项目；对照源项目确认备份后的源记录没有误出现在恢复项目。

当前网关要求每个请求携带`x-access-token`，普通浏览器地址栏访问不会自动附加该头，页面和静态资源会返回401。使用浏览器验收时，需要已有的受控反向代理先认证用户，再向网关附加该头；浏览器访问该代理入口。尚无该入口时，先用API验收；生产用户登录及服务权限由P06补齐。

例如在已将私有GATEWAY_TOKEN读入当前进程环境的PowerShell中，查询Manager中的一条已知需求：

```powershell
$recoveryHeaders = @{ 'x-access-token' = $env:GATEWAY_TOKEN }
Invoke-RestMethod -Uri 'http://127.0.0.1:5300/api/manager/requirements/<requirementId>' -Headers $recoveryHeaders
```

把requirementId替换为备份前真实存在的ID，并确认返回的标题和描述。不要通过清空token或把token写进公开URL来绕过入口认证。

首次目录证明一旦持久化，后续应用迁移可改变目录摘要；回执中的当前catalogSha256因此可以不同于备份，但恢复资源身份和首次验证证明仍必须有效。只看到17个容器healthy不能替代业务读写验收。

## 6. SSH执行与回退

交接配置要在恢复机上生成。取回这一公开文件至控制机后，可从控制机上传它和固定制品；私有env只传目标机路径：

```sh
pnpm deploy:ssh --host recovery-server --release /local/releases/selected --config /local/recovery/deployment.json --secrets /etc/magictools/private/runtime.env --state-dir /var/lib/magictools/recovery-state
```

SSH会回读成功回执，同时核对制品、公开配置、数据库身份、claim、首次验证和12条连接。传输中断或回执不完整时返回失败或结果未知；先查目标机attempt，不要立即并发再发一轮部署。

后续升级使用相同v2配置和状态目录。恢复最近成功版本或回退前版：

```sh
pnpm deploy:release --rollback --secrets /etc/magictools/private/runtime.env --state-dir /var/lib/magictools/recovery-state
pnpm deploy:ssh --host recovery-server --rollback --secrets /etc/magictools/private/runtime.env --state-dir /var/lib/magictools/recovery-state
```

成功版本A→B后回退到A；B部署失败后恢复到最近成功版本。回退依据状态目录保存的制品和配置快照，SSH还会回读并验证该快照。回退不逆向数据库迁移，也不把env切回旧值；不兼容迁移需从备份另建恢复实例及项目。

## 7. 故障处置

| 回执阶段或现象 | 检查与处置 | 保留的边界 |
|---|---|---|
| handoff认证/目录失败 | 核对密钥、完整备份、正确restore回执和实际恢复资源 | 不手改清单、ID或摘要绕过校验 |
| recovery-connections | 核对八个变量的角色密码、编码、主机、库名及端口 | 工具不覆盖私有env |
| recovery-ownership | 检查同项目孤立资源、已有claim、恢复网络成员和外网连接 | 无法证明归属的资源不能接管 |
| recovery-initial-validation | 检查首次恢复目录与备份是否一致；中断修复后同目录重试 | reused claim不等于首次检查成功 |
| pull | 修复仓库权限、网络或digest缺失，再重试 | current仍指向此前成功版本 |
| up/verify | 查看失败服务迁移与连接日志，必要时恢复最近成功版本 | 部分应用可能已经更新；数据库迁移不会自动撤销 |
| recovery-final-validation | 检查容器/网络/卷/claim是否被替换或接入未知成员 | 17应用就绪也不能推进成功指针 |
| deploy.lock遗留 | 确认原进程及远端命令均已结束，再按对应attempt核对资源 | 不因超时直接删锁或claim |

结束演练时先停止本次新应用项目，再按成功回执中的完整ID与归属逐项清理本次资源。保留正式恢复项目的状态目录、claim、数据库及数据卷；不能使用全局prune或凭名称批量删除。源平台及其它验证环境不属于本次清理范围。

## 8. 验证范围

使用本机测试registry中的两份不同源码制品，执行完整演练。current会作为新建源平台，其POSTGRES_PASSWORD和全部数据库连接必须使用私有env变量引用；含旧版字面默认凭证的current会在预检拒绝。previous作为恢复应用版本，仍支持已发布的精确旧默认连接兼容：

```sh
pnpm recovery:validate --previous /releases/previous --current /releases/current
```

报告保存在`.qa/recovery-deployment/<id>/summary.json`，包括源码指纹、输入制品、每项检查和清理结果。默认拒绝相同源码revision；显式`--config-change`使用同制品时会实际修改网关端口并回退，报告标记config-change。CI的images:smoke使用当前提交发布到本机registry的验证制品，覆盖这一配置变化链路；不同源码A→B→A的证据由本地双制品演练提供。

基础设施测试区分实际文件状态机与Docker/PG/SSH替身。完整容器演练须独立验证八库恢复、12条实际应用连接、业务读写、A→B→A、故障重试、身份替换、active cron外联隔离和资源清理；源码、制品与结果见[恢复部署验证记录](../validation/2026-09-12-restored-deployment.md)。

数据库RTO与应用恢复耗时分别记录，只有实际测过的环境与数据量才支持相应指标。物理异地备份、正式服务器切流、生产调度以及真实模型效果不由一次本机恢复演练证明。
