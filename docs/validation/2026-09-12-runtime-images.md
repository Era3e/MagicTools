# P03/P05镜像、部署与回退验收

## 范围与结果

本轮基于main `531e82a`，实现P03独立镜像及P05不可变制品、本机/SSH部署、回执与回退。真实本地两源码版本验收和独立复验均通过，无遗留产品缺陷；最终PR候选仍由CI与其原始证据核验后合并。

## 两份干净源码制品

| 版本 | 完整源码SHA | build | runtime | release |
|---|---|---|---|---|
| A | cc03f425939448b3e720b0a29084ae479f9412db | 3e81c53cf8820353 | runtime-78f82b091b8c1b43 | d90f38182d37e0e8 |
| B | 5355139ec425dd0394f61e1d149ee1063ae1e486 | 58000eeb8c964e28 | runtime-669e234d2f8debd6 | 31adfd27e83e27a7 |

两版均为clean=true、mode=release，分别构建17镜像、通过9项运行检查及资源清理，然后推送本机测试registry并按实际digest回读。独立验收核对Git tree、工作树指纹、同批build/runtime/publish身份与bundle校验和，并GET核验B的102个registry index、manifest、config和构建证明对象原始SHA256。证明附件与运行镜像分开核对。

## 实际升级、故障与回退

部署验证run `c4382360ff95e4b9`（mode.upgrade=distinct-revisions）8项全部通过：首次部署A并写数据、升级B并改变公开配置、移动两个不同Manager digest的标签而固定部署不变、缺失digest拉取失败后恢复B、回退A并保留数据、错误密码触发真实数据库鉴权失败后恢复A、注入SELECT 1 / 0迁移触发实际division by zero启动失败后恢复A，以及env字节与PG容器ID保持。故障镜像明确标记validation-fault-injection，不作为普通发布制品。9份原始attempt回执为6成功、3失败（pull/up/up），成功指针与故障阶段经独立复核。

独立测试智能体使用另一项目 `mt-validation-review-775fc054580e`，在八个业务库分别写唯一marker，单独执行A→B→A：

| 操作 | attempt | 网关loopback端口 | 结果 |
|---|---|---|---|
| 部署A | 69e000afdfebd8c4 | 63472 | 18容器健康，八库数据已写入 |
| 升级B | 172632d0b65e07f4 | 63473 | 八库数据保留，配置生效 |
| 回退A | 7d401ea72f163f8d | 63472 | 八库数据保留，公开配置恢复 |

三步均核对实际17镜像digest、平台、源码及资源归属，private.env逐字节不变，PG容器ID始终为915ac59975598a33d5e9504eef46c0a7f6d56f5a901a0696bb247c29d87ff9f7。Gateway无令牌401、有测试令牌200。两次部署验证项目及B的runtime项目最终容器、网络、卷零残留，生成的私有env已删除；未操作原5432或共享测试PG。

本地回执分别位于 `.qa/deployment-validation/c4382360ff95e4b9/summary.json`、`.qa/releases/<publishRunId>/`；独立报告保存于工作区外部验收目录 `work/deployment-final-review/775fc054580e/`，含report.json、review.md及三个attempt原始回执/公开快照。临时证据不入Git。后续收尾提交不冒充本节被测源码。

## 早期运行切片证据

以下为实现阶段的工作树验收，保留定位历史缺陷：

| 验证 | 实际结果 | 证据标识 |
|---|---|---|
| 全部应用镜像 | 17镜像构建成功，linux/amd64、revision及探针一致 | build `60e9dd418cbde78a` |
| Compose完整回归 | 9项检查通过，18容器最终健康（含数据库），清理通过 | runtime `runtime-7edb3a63b0febb03` |
| Manager独立断连复验 | ready200→503，health200，恢复ready200；进程未重启、数据保留 | review `e866eb2ddc` |
| 本地仓库发布 | 17镜像推送后按实际digest拉回核验成功 | publish `782381fceab52b16` |
| 构建与隔离审查 | 构建清单6条、验证配置6条独立回归通过 | `infra/scripts/lib/runtime-artifacts.review.test.mjs`、`infra/scripts/lib/runtime-validation.review.test.mjs` |
| Assistant容器路由 | 排障与动作7条回归通过；实际容器探测9个服务成功 | trouble/action单测及runtime回执 |

完整运行及发布对应工作树指纹 `80886088305412174e151c51d393f5aef6797f43883c67fee1b60f1158e77045`，不是某个已合并提交。最终候选以CI生成的quality/runtime证据为准。

## 发现与修复

1. Manager数据库停机时，pg空闲连接error事件未监听导致进程退出；补监听并限制日志内容后，真实断连与恢复通过。
2. pnpm离线deploy缺依赖元数据；保留锁文件安装，生产打包采用prefer-offline。运行镜像实际只包含生产依赖。
3. 构建清单曾允许部分release、服务引用错配和平台偏离；独立回归先失败，修复后通过。
4. 验证Compose可能保留外部资源引用及硬编码秘密；改为字段白名单、测试数据库地址、秘密清空和全资源所有权标签。
5. 第一次全平台冷启动发现Assistant未声明yaml依赖。改用已声明的配置包，补端口资源与容器服务寻址后，完整冷启动通过。失败run `runtime-08deee48ae9463a5`正确记录失败，资源已清理。
6. 全仓门禁中Designer预览超时；停止Docker构建后仍复现，不能只归因于Docker。直接运行和单独通过Turbo运行均25/25、约7秒；全仓 `build test --concurrency=2 --force` 实际46/46通过，用时4分22秒，Designer预览编译约1.6秒。门禁固定最多2个并发任务，未扩大测试超时或跳过断言。Turbo依赖图保证UI等公共包先构建完成；预览读取的依赖目录与并行应用的dist输出分别归属各自包。
7. 独立审查发现新CI runner没有数据库镜像缓存；运行器改为创建容器前显式拉取固定pgvector digest并核验平台，应用镜像仍不允许漂移拉取。发布前缀与清单同时拒绝隐式Docker Hub地址。
8. main重新构建的制品必须重新验收。发布入口现为构建→同批容器验收→推送；底层publisher要求完整运行回执并逐个比对image ID。独立10条回归覆盖模式、来源、失败回执、平台及运行证据门禁（Docker调用在这些单测中明确拦截/模拟）；运行证据完整性另有纯函数回归。新增运行回执用例首次执行即已通过，不把它们记录成观察过失败的用例。
9. 首个干净提交b4bcc0a的发布链路在PG预拉取后发现基础镜像缺少可选Labels/Healthcheck字段，旧Go模板因此报错。改用index读取可选字段，真实PG返回null、应用仍返回正确revision和探针。失败run `runtime-9c9c9e512af3465f`发生在创建容器前，没有发布制品；修复后继续对干净提交执行完整发布验收。
10. P05独立审查发现回执/状态写入顺序、锁提前释放、同名制品checksum判重、SSH回退快照完整性及验证器资源隔离问题；修复后本地部署11条、SSH28条和配置/隔离测试全部通过。初始化SQL改用内容摘要的稳定挂载，同版本重部署不重建PG。PowerShell原生失败退出1且无成功文案，成功退出0。

## 质量门禁与证据边界

完整本地qa:gate回执 `64d0fd261f5931e7b020db33` 全部7阶段通过：infra136/136、真实数据库31文件136/136且skip=0；源码smoke17/17。收尾变更再次执行所需门禁，候选提交的quality/smoke/e2e与artifact身份由GitHub最终检查确认。

CI smoke从实际checkout构建并验收17镜像，再使用一次性registry验证同一制品的两份公开配置、实际移动标签与部署故障恢复；报告明确为config-change，不能替代本地不同源码的distinct-revisions验收。独立审查run34647098949的原始artifact后补充上传两份公开配置，使configVersion可重新计算；CI保留JSON证据，不上传私有env。SSH传输、退出码、回执/快照回读使用可控适配器回归，尚未连接真实生产SSH主机。

本轮真实数据库和容器验证使用独立测试资源，本机registry发布不代表生产上线。应用回退不逆向SQL迁移；数据备份恢复由P04继续落实。真实外部模型未调用，本报告不评价回答准确率。
