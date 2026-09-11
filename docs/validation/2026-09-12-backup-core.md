# P04本机备份与恢复核心验收

## 范围

本记录覆盖源配置检查、整集群物理备份、认证加密、独立恢复及本机指标。P04的SSH异机保存、保留策略、失败告警、定时任务、应用切换及完整候选CI仍待交付，不能把本记录当成完整P04或生产上线结论。

## 实现和原始证据

本机入口为backup:create、backup:verify、backup:restore和backup:validate，操作说明见 [备份恢复](../features/backup-recovery.md)。代码分别位于infra/scripts/backup.mjs、lib/backup-local.mjs、backup-docker.mjs、backup-source.mjs、backup-config-files.mjs、backup-crypto.mjs和backup-metrics.mjs。

真实回归run `37ef4dcc212ff7bd`通过创建、八库恢复与校验，源码为未提交工作树，fingerprint为`0bd5cc9778806003f6b61999c591d39e0a60ef4f859f13098ad0c3c1d16d0453`。对应备份ID为8d783096db35a18d，回执保存在`.qa/backup-validation/37ef4dcc212ff7bd/`。源容器、目标和临时资源独立，未使用原5432或共享测试PG。

该次实际核对八库唯一标记、恢复记录的原生微秒时间戳、角色密码与SELECT允许/INSERT拒绝、pgvector数据，以及备份后新增记录不在恢复结果中。校验命令再次解密、原生验证WAL并启动独立PG，最后其所属容器/网络/卷零残留。

| 本机样本 | 实际结果 |
|---|---|
| 密文体积 | 103,114,866字节 |
| 源数据库体积 | 69,704,911字节 |
| 数据库恢复耗时 | 19,533毫秒，热镜像缓存，含业务与角色检查 |
| 最后恢复样本间隔 | 12.8353秒 |
| 恢复点年龄保守区间 | 0.293至11.718秒，按源时钟和控制流界定 |
| 提交确认采样窗口 | 147毫秒 |
| 清理 | 通过 |

此规模以测试标记为主，以上数据不是冷镜像下载、生产负载、平台切换或异机RPO/RTO。后续代码或文档改变后须按对应候选的指纹和CI证据重新核对，不能把本次工作树记录改称最终提交验收。

## 独立审查闭环

独立配置检查使用真实PG16、独占容器与新卷且无宿主端口。空include、PGDATA下划线的LIKE通配符、HBA/ident递归引用、合法pending_restart及待生效认证路径均已实测；最终限定复验e68975f723ed通过，新旧内部根和依赖同时保留，外部待生效路径拒绝，源实例启动时间/PID/系统标识和标记数据未改变。

加密独立14项覆盖32MiB分块和背压、生产者与消费者错误、截断/追加/认证标签/摘要/长度损坏，以及清单JSON稳定性。稀疏数组和数组根问题经RED复现后修复。

本机编排独立16组使用真实文件及加密、受控Docker进程边界。目录junction绕过私有文件隔离、回执写入失败无声保留目标两项已修复；已有目标保护、错误密钥、15种坏清单、损坏密文、资源归属变化、清理失败及CLI失败身份均通过。独立测试已沉淀至backup-local.review.test.mjs，另增加固定digest缓存离线可用回归。真实Docker结果仍以上述实测分别记录，不用受控边界冒充。

指标独立6项发现Date.parse丢失微秒会缩小保守区间并放过亚毫秒倒序；现使用BigInt微秒比较，展示时向外取整。原5c2324cb355d75a2样本仅离线重算为0.294至16.373秒，未改写原始报告；其23,752毫秒RTO没有冒充新一次恢复。新实测的原生时间戳相等性也按微秒检查。

独立原始材料在工作区work/backup-foundation-review、work/backup-local-review/20260912-local及work/backup-metrics-review，临时数据不提交Git。真实回归与门禁结果由`.qa/`保存；P04剩余范围完成后仍需整批独立验收和最终CI。
