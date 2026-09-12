# P04恢复部署验证记录（本地验收完成）

恢复部署的本地完整演练、独立验收和全仓门禁已通过。测试绑定PR #74的09cb670基线加本轮恢复部署工作树，最终候选还需独立CI核验后合并；不以09cb670的旧CI证明本阶段代码。

## 最终本地结果

- 冻结源码指纹：`0ec68b78cb61dc9c1eea1f11daf0cc56b83beb4979869bef8d49f58286b59f9d`，HEAD为`09cb67046f1c018d2b78f09d409d0b15cf46f7ee`，`clean=false`。
- 完整qa:gate回执`53bfb05c458840171976eea1`：7阶段全通过，infra353/353、真实数据库31文件136/136且零跳过；源码smoke使用Node20.20.2，17/17、exit0。
- 独立完整实机`594bc2f98a44f636`：11/11场景、CLI exit0；cleanup=passed、privateFilesCleared=true、sourceUnchanged=true，与上述qa指纹相同。运行时间2026-09-12T04:51:46.607Z至05:01:03.483Z。
- 独立回读18/18：12份部署尝试回执及成功/失败阶段对应，全部17镜像与12条实际连接完整；原2容器/4网络/8卷及109个既有镜像ID保持，测试资源和故障镜像均不存在，原5432/55432/55433/55101及17源码预览的监听PID保持。原5432服务启动时间无法读取，保护证据不外推至该不可读字段。
- active cron在恢复库产生5次实际runs，本轮独立receiver正向请求计数为1，恢复项目启动及后续升级/回退期间仍为1，外联隔离通过。首次平台恢复样本61793ms，范围为开始数据库恢复至17应用及数据/API确认，不等同于生产RTO承诺。

完整证据位于`.qa/recovery-deployment/594bc2f98a44f636/summary.json`、`.qa/quality/53bfb05c458840171976eea1/quality.json`及仓库外`work/recovery-formal-independent-rerun/report.json`、`review.md`、`run.log`。本文件的收尾补记发生在测试之后，不把补记后的提交伪称为该工作树指纹；提交的完整身份由最终CI核对。

## 已取得的阶段证据

| 验证 | 结果与边界 |
|---|---|
| 配置、12连接、资源、持久归属、交接CLI | 先写失败契约再实现；Docker/PG边界使用I/O替身，文件和加密使用实际实现 |
| 资源/受控ingress/attachment独立复验 | 65/65通过、零跳过；孤立项目资源、网关任意外网和损坏claim问题关闭 |
| handoff/部署独立复验 | 14/14通过；源store内输出与校验期间密文变化问题关闭 |
| 当前新增SSH及部署回归 | 与旧部署/SSH测试联合58/58通过、零跳过；覆盖回退、错误回执、迁移后目录、阶段失败、首次检查中断、换库/claim和最终身份复核 |
| SSH回执独立复验 | 14/14通过；首次验证时间、完整业务库和应用DNS冲突三类RED关闭，补测时区/时间边界、34个冲突名称、集合顺序与v1兼容；使用实际文件和受控传输，未执行真实SSH |
| 基础设施整合测试 | 348/348通过，fail0/skip0；报告work/recovery-infra-integration.log，仍非全仓qa:gate |
| 操作文档独立事实审查 | 认证入口缺口已修，4份既有真实成功回执可被当前验证器接受，7个文档链接有效；未发HTTP或操作Docker |
| 真实备份核心210cae80d5e11edd | 八库、角色、向量、handoff、实际claim及首次验证通过；使用本阶段较早源码，后续还需最终重跑 |
| 真实全平台0ff243cfbca71e1f | 17ready、12条应用PG连接、Manager读写隔离、A→B→A和错误密码失败/恢复通过；最后挂载数组顺序比较误报，原summary仍为失败 |
| 挂载保持补验 | 16次只读比较证明仅数组顺序改变；源ID/启动时间/实际挂载/八库数据/env补核及清理通过，不改写原失败结果 |

本地证据位于工作区仓库外的`work/recovery-resource-review`、`work/recovery-deployer-review`、`work/recovery-ssh-receipt-review/20260912`、`work/recovery-docs-review`、`work/recovery-deploy-expanded.log`和`work/recovery-deploy-real/runs`。SSH复验绑定recovery-receipt.mjs摘要`7f82df8610842359a56599d359d18a9a3fca50e15aef0df064ca186afeac7330`与deploy-ssh.mjs摘要`84ea37d82bab28d50b2a0d1cbb9c531e9d61acb78e05a93fb03ac0c48ac2ce2f`；临时文件、私有env和备份密文不提交Git。

## 首轮故障与修复记录

正式入口、CI同制品配置变化接入及运维章节已经落地。冻结源码的qa回执`6ee46c804931dc0a2dcbcc74`通过全部7阶段，infra352/352、真实DB31文件136/136且零跳过；Node20.20.2源码smoke17/17、exit0。身份为HEAD09cb670的工作树，fingerprint`31aed96b9f6fc888c8384f99ee4c73f03a2bb6b5e5280d1563e8bb6d4f89135f`。

独立正式实机`5f865210d87e0f73`使用A=`cc03f425939448b3e720b0a29084ae479f9412db`、B=`5355139ec425dd0394f61e1d149ee1063ae1e486`，11/11场景通过：源八库/Manager、receiver正向对照、物理备份与交接、17ready/12真实连接/读写隔离、active cron外联隔离、A→B→A、坏密码、缺digest、真实迁移失败、同名身份替换及源/env/制品保持。实测从数据库恢复开始至首次应用数据确认60845ms，只代表该本机样本。

**该轮最终仍为失败**：containerd将故障镜像的本轮digest引用也列入RepoTags，清理器误判为额外标签，遗留一个测试镜像。全部容器/网络/卷回到原2/4/8数量，既有资源身份与启动时间、主机监听PID和17预览保持，私有文件清除且源码指纹不变；原summary和独立报告保留failure，不能用11项通过替代完整成功。证据在`work/recovery-formal-independent`。

修复以实际元数据为回归依据，先获得相同清理RED，再允许经过同仓库和实际RepoDigests核对的本轮已记录发布引用；其它标签、其它digest及仍有容器引用继续拒绝。正式入口保存发布reference供核对，预检/清理开发测试10/10通过。随后完成上述最小实机清理和新完整演练，不以旧352回执冒充修后结果。

清理补验已独立通过：26/26受控用例，补齐只出现在RepoDigests中的外来引用拒绝；实际使用修后helper仅删除原记录的故障镜像ID，全部其它镜像ID保持，原summary字节不变，见`work/recovery-formal-independent/cleanup-supplement.json`。helper摘要`729efc35a47e588ac0990b23ed38e99bbb2812f5bd36ff37560eb959ac4e57d9`。修复期间运行的qa`78c89059fb7c577b775ab2e7`因源码指纹改变而最终失败，保留失败记录，不计作修后门禁；重新冻结后的53b回执与594完整实机均已通过。

本章记录实现阶段事实，不代表生产部署、异地容灾或模型效果验收已完成。
