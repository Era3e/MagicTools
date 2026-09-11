# 整集群备份与独立恢复（P04实施中）

当前分支已提供本机创建、校验和恢复入口，实际八库恢复链路正在验收。异机保存、保留策略、失败告警、定时执行、应用切换和完整RPO/RTO报告仍在实施，不能把本页的数据库回执当成生产上线结果。

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

应用切换与部署交接还需随P04完成，当前恢复入口不自动修改现有应用连接地址。备份之后的写入没有连续WAL归档保障，不能据此承诺任意时间点恢复或零数据损失。

## 查看失败与验证记录

已初始化的备份目录保存`attempt-<operationId>.json`，记录阶段、成功与否和清理情况。未完成目录使用`.pending-`前缀，不能作为正式备份恢复。目录锁用于防止并发操作，遇到遗留锁应先确认原任务和所属Docker资源的实际状态。

`pnpm backup:validate`在全新容器和卷中写入八库标记、角色和向量数据，再通过命令入口创建加密备份、恢复和校验；报告位于`.qa/backup-validation/`，绑定源码指纹。测试会检查备份后数据边界、角色密码及读写权限，最后清理测试资源。

报告记录源数据库时间、已恢复和未恢复的样本、提交后的确认时间，以及实际数据库恢复耗时。RPO给出本机样本支持的区间，使用微秒比较、毫秒向外取整；RTO涵盖镜像选择、解密、原生校验、启动、目录与业务检查及临时资源清理。明确标记热镜像缓存和测试规模，不计未发生的备份下载、应用切换或异机恢复。这些数据不等同于生产SLA。

CI的smoke阶段也执行该真实演练，backup-evidence制品仅保存身份绑定的摘要、公开清单、目录标识与操作回执。测试密钥、私有凭证和备份密文不上传。P04剩余功能的专项回归还需随实现补齐。
