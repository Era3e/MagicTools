# P04保留、告警与SSH传输阶段验证

本记录是feat-infra-P04-backup上的阶段性工作树证据；PR74完整范围尚未合并。核心提交93bf的CI run34660010365已通过quality/smoke/e2e，实际E2E102项、0跳过；该CI不覆盖本页的新未提交改动。

## 独立文件与接口验收

- 保留策略12项通过：默认15份、数量边界、目录链接/额外文件、异store、锁和标识变化、删除中断及本次创建保护。修复较新密文损坏却删除旧份、失去锁仍删除、时钟回拨删除刚创建制品三项缺陷。
- 告警13项通过：真实本机HTTP接受/拒绝/超时/重定向、18种无效配置、白名单事件、CLI前置失败、落盘失败仍发送、阶段与备份身份传递。未向真实用户或第三方发送。
- 传输19项通过：实际文件与GCM/HMAC验证；SSH和原生PG边界在这些独立接口测试中为受控替身。修复恢复验证后同长度密文变化仍发布，以及copy回执失败遗留正式目录两项缺陷；已验证副本与后续清理/保留失败分别记录。

独立原始材料分别保存在工作区work/backup-retention-review、work/backup-alert-review/20260912、work/backup-transfer-review/20260912；不将替身测试计为真实数据库或SSH验证。

## 真实本机保留与告警

run`0abf00edd79f1024`绑定dirty fingerprint`c1e479bef46ef91924cbd717eac57cf18aa806f7bd2009a39b8e3a781d5de71c`。

实际连续创建两份PG16整集群备份，`keep=1`删除旧份、保留新份；手动prune重复执行没有额外删除。恢复八库微秒标记、角色密码/读写权限和向量数据，故意向已有恢复目标再次restore时被拒绝，HTTP接收器收到一次202确认，原目标marker仍可读。

三份密文共103,114,866字节，独立重算SHA256一致。热缓存本机数据库RTO19,784ms，恢复点年龄区间0.314–11.484秒，提交确认窗口150ms；源端测试资源、恢复资源和私有文件已回收。工作区work/backup-retention-real-review保存只读复核报告与公开证据。

## 真实SSH复制与副本恢复

run`26b370064292f597`绑定dirty fingerprint`2dd59c0a1b73cf914c4946e924c112594a7c1088b5510e7609a082094c602998`，测试期间源码未变化。

真实链路为本机Node20 CLI、Windows OpenSSH、隔离Docker内的Node22.23.2/sshd/Docker CLI以及新建PG16源。SSH通过独立测试密钥及预先核对的known_hosts登录，公开脚本传输后由GNU sha256sum核对。源端完成八库备份与持锁导出，SCP下载后在本机实际执行解密、pg_verifybackup及隔离数据库启动，再从副本再次恢复并核对八库marker、角色密码/读写限制、pgvector和源数据保持。

- transfer operation：`f214d1d555321583`。
- backup：`86090f715851d1a4`。
- 本机副本校验operation：`6b25f7d04595907d`。
- 密文体积102,910,026字节；从SSH命令开始到源创建、复制、恢复校验和远端临时副本清理结束共28,865ms。这是完整复制任务耗时，不冒称纯数据库恢复RTO。
- 源正式备份在远端导出清理后仍存在；测试最终清理源、relay、恢复实例及测试私有文件。

前两次演练因测试SSH镜像未安装远端scp失败，失败回执与清理结果保留；安装openssh-client后以全新测试资源重跑通过，未放宽StrictHostKeyChecking或改用桩。

证据位于工作区work/backup-ssh-real/runs/26b370064292f597及本分支`.qa/backup-transfers/f214d1d555321583/`。测试密钥已按收尾删除，后续只能独立重算密文摘要及核对已记录的认证链路，不声称事后重新持钥验签。

本测试的源和SSH容器仍使用同一台Docker主机；它证明真实协议与恢复流程，不能证明物理异地、生产调度或生产SLA。部署交接和整批最终qa/CI继续实施，后续候选需要按实际源码身份验证。

## 运维入口与提交前检查

PowerShell包装独立复验42次调用全部通过，Windows PowerShell 5.1.22000.2538与pwsh7.6.5均实跑，零失败/跳过。原实现绕过PowerShell重定向的四个反例已关闭，覆盖复杂参数、空字符串、cwd、23/255退出码、UTF8大双流、文件重定向、变量捕获和真实CLI前置失败事件。输出遵循PowerShell标准文本与ErrorRecord格式；原始二进制和直接解析stderr JSON使用Node CLI。

systemd样例经过独立静态语义核对，没有运行systemd-analyze或启用主机计划任务。原始证据在工作区work/backup-wrappers-review；开发回归11项、独立42调用各自记录，不相加成同一种测试口径。

提交前完整qa:gate通过，回执`.qa/quality/9ae6007ad4b197b83d7f7c5f/quality.json`：infra228/228、31文件真实数据库136/136、零跳过，以及构建、单测、coverage、设计和文档检查；指纹`6a53e2d2774a18b79c03d9993eb75501f86bc91d752c816593b5686cedcca953`。smoke17/17通过，检查的是保留的源码预览服务，本批未修改这些前后端源码；备份及SSH行为由上面的专门实测证明。

本段与即时记忆在门禁完成后追加，记录的是提交前工作树，不把该指纹改称后续Git提交。发布候选还需要其自身CI；完整P04的部署交接尚未实现，当前草稿不提前合并。
