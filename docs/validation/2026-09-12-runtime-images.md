# P03镜像运行切片验收

## 范围与结果

本轮基于main `531e82a`，实现P03与P05制品基础。P03运行切片已由独立测试智能体复核；P05部署、回退与最终CI合并仍属本批后续工作。

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

## 证据边界

本轮使用专用Docker数据库与本地registry，未修改原5432数据。容器测试验证真实数据库和esbuild，不调用真实外部模型；publish清单明确为validation模式。尚未据此声称生产上线、两个正式版本回退或回答准确率提升。

提交前完整 `qa:gate` 生成独立回执，PR的required checks继续验证候选源码。该记录中的本地工作树证明与后续CI/部署回执分别保留。
