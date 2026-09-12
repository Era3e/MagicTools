# 备份入口与日常运行

本页说明 P04 的 PowerShell 入口与 Linux 日备样例。备份格式、数据库前置条件、恢复及数据边界见 [整集群备份与独立恢复](backup-recovery.md)。仓库只提供脚本和配置示例；没有安装、启用或启动任何计划任务，也没有配置生产通知接收者。

## PowerShell 使用同一套命令

`infra/backup.ps1` 把操作和参数交给 `infra/scripts/backup.mjs`，支持转交 `create`、`verify`、`restore`、`prune`、`ssh`。`infra/restore.ps1` 固定使用 `restore` 操作，其余参数完全相同。参数规则由 Node CLI 统一校验，未知操作、未知参数、缺少参数均失败，不会回退到旧脚本的单库导出流程。

以下路径是操作示例，容器名称和备份 ID 须替换为实际回执中的值。密钥与凭证文件应已按主文档准备好；值本身不写入命令、终端历史或 Git。

```powershell
& 'C:\MagicTools\infra\backup.ps1' create --container magictools-postgres-1 --directory 'D:\Backup Data\magictools' --key-file 'C:\Private\magictools.backup-key' --credentials-file 'C:\Private\pg-credentials.json' --keep 15 --events-dir 'D:\Backup Events\magictools'

& 'C:\MagicTools\infra\backup.ps1' verify --backup 'D:\Backup Data\magictools\backup-0123456789abcdef' --key-file 'C:\Private\magictools.backup-key' --events-dir 'D:\Backup Events\magictools'

& 'C:\MagicTools\infra\restore.ps1' --backup 'D:\Backup Data\magictools\backup-0123456789abcdef' --key-file 'C:\Private\magictools.backup-key' --target recovered-magictools --events-dir 'D:\Backup Events\magictools'

& 'C:\MagicTools\infra\backup.ps1' prune --directory 'D:\Backup Data\magictools' --key-file 'C:\Private\magictools.backup-key' --keep 15 --events-dir 'D:\Backup Events\magictools'
```

`create --keep 15` 在成功创建后执行保留处理，`prune` 用于独立执行同一策略。保留的是本工具同目录内经过验证的最近 15 份备份，不等同于固定 15 天；失败、跳过或漏跑会改变实际时间覆盖。

包装脚本从自身目录定位 CLI，保留调用者当前文件系统目录，因此可以从任意目录调用，相对文件参数也相对于调用目录解释。包含空格、单引号、中文的路径应按 PowerShell 字符串规则引用。不要用字符串拼接生成命令或使用 `Invoke-Expression`。SSH 操作也仅转交给同一 CLI，具体远端参数及异机成功判定见主操作说明，不采用旧版的远端 `pg_dump magictools` 管道。

脚本要求 PATH 中有 Node.js 20 或以上。参数先序列化为UTF8 JSON并以Base64数据传给静态`infra/scripts/backup-powershell.mjs`，再通过Node参数数组启动同一备份CLI；不把用户参数当成shell或JavaScript代码。分发PowerShell入口时必须同时带上该bootstrap和完整CLI依赖，不能仅复制两个ps1文件。

包装使用PowerShell标准文本流，支持变量捕获、管道及`1>`/`2>`重定向；空格、中文、引号和末尾反斜杠按原参数传入。文本文件的编码遵循PowerShell版本及重定向方式，Windows PowerShell 5.1可能将原生stderr包装为ErrorRecord；需要逐字节处理或直接解析原始stderr JSON时应直接调用Node CLI。可通过`$LASTEXITCODE`或外层进程退出状态判断结果；成功为0，CLI校验及业务失败为1，其它子进程退出码原样返回。缺少Node或无法启动包装入口时返回1。

## Linux 日备样例的目录与权限

样例位于 `infra/systemd/`：

| 文件 | 用途 |
|---|---|
| `magictools-backup.service` | 使用 Node 执行本机整集群 `create --keep 15` |
| `magictools-backup.timer` | 每天上海时区 02:30 触发，允许 1 分钟调度精度 |
| `backup.env.example` | 只保存公开的容器名和文件路径 |

运行机需要 Node.js 20+、Docker CLI 与可访问的 Docker daemon；源 PostgreSQL 必须满足主文档的八库、PG16、固定镜像和复制权限要求。样例使用 `magictools-backup` 账户及 `docker` 附加组。Docker socket 权限可以控制宿主机，不应把此账户理解为权限隔离后的普通只读账户。

| 位置 | 内容与权限 |
|---|---|
| `/opt/magictools/backup-runner` | 完整匹配版本的公开 CLI 及依赖；运行账户可读 |
| `/opt/magictools/backup-runner/infra/ports.json` | 由该版本 `ports.yaml` 生成的公开应用清单 |
| `/etc/magictools/backup/backup.env` | `backup.env.example` 的实际路径配置，无密码或密钥值 |
| `/etc/magictools/backup/pg-credentials.json` | 私有数据库凭证，文件 0600、父目录 0700，运行账户可读 |
| `/etc/magictools/backup/backup.key` | 私有 32 字节密钥，文件 0600，独立于备份数据保存 |
| `/etc/magictools/backup/webhook.json` | 可选私有通知配置，URL/认证头可能含秘密，文件 0600 |
| `/var/lib/magictools/backups` | 密文与认证清单，首次使用应为空，运行账户可读写，目录 0700 |
| `/var/lib/magictools/backup-events` | 持久失败事件及通知投递结果，运行账户可读写，目录 0700 |

数据库凭证、密钥及 webhook 配置均放在备份和事件目录之外。密钥另行保管一份可恢复副本；将密文复制到另一块磁盘却只在原服务器留密钥，不能抵御原服务器完全丢失。轮换密钥时另建备份目录，旧备份依赖的密钥在保留期内不能删除。

部署公开 CLI 时保留匹配版本的 `infra/scripts` 依赖模块。可在已安装仓库依赖的该版本源码根目录生成清单，再随公开脚本一起复制：

```sh
node --input-type=module -e 'import {readFileSync,writeFileSync} from "node:fs"; import {parse} from "yaml"; writeFileSync("infra/ports.json", JSON.stringify(parse(readFileSync("infra/ports.yaml", "utf8")), null, 2) + "\n");'
```

按实际系统确认 `/usr/bin/node`、`/opt/magictools/backup-runner`、Docker socket 权限及全部配置路径。不要把开发者工作目录、交互式 shell 的 PATH 或隐式当前目录当作服务环境。环境文件中带空格的值应使用双引号；样例 `ExecStart` 的 `${变量}` 由 systemd 作为一个参数展开，不经过 shell。

## 启用前的人工检查与运行

只有在实际运行账户已完成一次 `create` 和一次 `verify`，并核对容量、回执、保留策略及密钥备份后，才由运维将样例安装到系统。以下为操作说明，本次开发没有执行这些命令。

```sh
systemd-analyze calendar '*-*-* 02:30:00 Asia/Shanghai'
sudo systemd-analyze verify /etc/systemd/system/magictools-backup.service /etc/systemd/system/magictools-backup.timer
sudo systemctl daemon-reload
sudo systemctl start magictools-backup.service
sudo systemctl status magictools-backup.service
sudo systemctl enable --now magictools-backup.timer
```

检查服务中的 `User`、`Group` 已建立，样例文件已经按实际路径安装，公开配置文件中的容器名与现有 Docker 实例一致。样例没有使用 `ConditionPathExists` 静默跳过：缺文件、缺 Node 或缺权限应明确使服务失败。`TimeoutStartSec=6h` 是样例上限，需根据实际数据库大小和演练耗时调整；超时中断后先检查资源与锁再重跑。

同一 systemd service 不会同时重复启动；备份 CLI 还通过备份目录的独占锁阻止其它创建、验证、恢复或清理操作并发使用该目录。不要通过另设无锁脚本或清锁来绕过冲突。

`Persistent=true` 会在关机后的下一次 timer 启动时补触发一次，并不会补齐停机期间每天的多份备份。任务运行超过下一个触发时间也不能假定多次补跑。此日备样例只在数据库所在运行机创建本地密文，不会自动复制到异机。

## 失败事件、通知与漏跑

```sh
systemctl list-timers --all magictools-backup.timer
systemctl show magictools-backup.timer -p LastTriggerUSec -p NextElapseUSecRealtime
systemctl show magictools-backup.service -p Result -p ExecMainStatus -p ExecMainStartTimestamp -p ExecMainExitTimestamp
journalctl -u magictools-backup.service --since '2 days ago' --no-pager
```

Node 成功回执写入 journal。已进入备份目录的操作另有 `attempt-*.json`；CLI 失败事件位于配置的事件目录，`*.event.json` 包含脱敏的操作、阶段和操作 ID，`*.delivery.json` 记录通知结果。未配置接收端会明确记录 `not-configured`，通知投递失败记录 `failed`，不能作为已通知。Node 根本没有启动、主机宕机或 systemd 配置错误时，CLI 无法生成事件，应从 systemd/journal 和外部主机监控发现。

基础 service 只记录本地失败事件。需要外部通知时，先准备私有 `webhook.json`，其 schema 为 `magictools-backup-alert/1`、type 为 `webhook`，并配置 HTTPS `url`、可选认证 `headers` 和 `timeoutMilliseconds`（1 至 60000，默认 5000）。不要把真实接收地址或认证头放入公开的 service/env 文件。由运维增加 `MT_BACKUP_NOTIFY_CONFIG` 的路径配置，并在 service 的 `ExecStart` 末尾增加 `--notify-config ${MT_BACKUP_NOTIFY_CONFIG}`；修改后重新校验 unit、执行 `daemon-reload`，再用专门的测试接收端验证失败事件确实收到。仅设置环境变量而没有增加 CLI 参数，不会启用通知。

每天还需核对最近一次 **已完成并验证** 的备份时间、实际最旧保留时间、空闲磁盘、最近验证失败及遗留资源。timer 的 LastTrigger 只说明调度触发，不代表备份成功。持续超过目标时间窗口未出现新成功备份，应视为漏跑或失败；此样例没有独立的外部漏跑告警器，生产需由另一监控系统检查备份新鲜度和主机在线状态。

## 遗留锁与恢复演练

遇到「备份目录正被使用或锁状态待确认」时，先读取该目录 `.lock/owner.json` 中的 host、pid、operationId、startedAt，对照原主机进程、systemd 状态、Docker 临时资源与操作回执。PID 可能复用，不能只凭本机找不到一个 PID 就认定远端任务结束。若 owner 文件损坏或来源主机不可达，应保留现场并停止该目录上的写操作。

确定所属任务已终止、没有同目录的验证/恢复/传输正在执行后，由运维按具体资源归属清理该次遗留资源并处理遗留锁。CLI 不自动删除旧锁；不要使用定时 `rm -rf .lock`、全局 Docker prune 或批量删除备份目录来恢复运行。未完成 `.pending-*` 与清理中断的 `.pruning-*` 目录不属于可恢复成功备份，需结合该次回执判断，不能改名伪装为完成目录。

定期从独立保存位置实际恢复到新容器和新卷，确认八库、角色权限和向量查询，并记录恢复耗时、备份大小与可恢复数据时间。每日触发、保留 15 份和一次小规模本机演练均不能直接证明生产 RPO/RTO。异机需要另外配置源主机 SSH、独立保存位置、匹配密钥及目标验证环境，完成真实跨主机传输与恢复后才能宣称异机保障已启用。

## 包装验证的证据边界

`infra/scripts/lib/backup-wrappers.test.mjs` 使用真实 Windows PowerShell 5.1 / PowerShell 7 执行包装：真实 CLI 的未知/缺参请求必须退出 1 并记录 preflight 失败事件；参数和退出码边界使用临时目录内受控的 Node 子进程验证，覆盖任意工作目录、空格路径和 shell 特殊字符。受控子进程不会调用 Docker、数据库、SSH 或 webhook，也不能作为真实备份或异机恢复成功证据。未安装 PowerShell 的测试机明确报告 skip；正式验收需另有真实 PowerShell 运行结果。
