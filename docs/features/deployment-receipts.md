# 固定制品部署、回执与回退

## 准备部署环境

部署机需要Node.js 20或以上、Docker以及支持 `up --wait` 的Docker Compose。部署账户需要运行Docker和读写部署状态目录的权限。跨主机使用SSH入口，目标机预先完成SSH主机信任和镜像仓库登录。脚本采用BatchMode，不会停下来交互输入密码。

每次部署准备三个输入：

| 输入 | 内容 | 管理方式 |
|---|---|---|
| 制品目录 | release.json、compose.json、ports.json、postgres-init.sql | 从已通过容器验收的发布结果取得，按SHA256校验，镜像固定registry digest |
| 公开配置 | 项目名、网关绑定地址/端口、就绪等待时间 | 参考infra/deployment-config.example.json，内容形成configVersion |
| 已有env文件 | 数据库URL、访问令牌、模型和外部集成设置 | 放状态目录之外，真实值不提交Git；部署和回退均不覆盖它 |

首次部署可参考 `.env.production.template` 创建私有env文件。已有文件须保留并人工编辑所需配置，不能用模板覆盖。八个业务URL分别指向applicant、gatherer、investigator、assessor、manager、designer、scholar、assistant数据库；密码在URL中使用百分号编码。数据库默认服务名为postgres、端口5432。

POSTGRES_PASSWORD只初始化新数据卷中的数据库角色，不会轮换已有数据库密码。升级已有实例时，连接URL须与其实际密码一致；轮换凭证是单独的运维操作。公开配置的configVersion只覆盖该JSON的字段；env中的外部集成配置与秘密不纳入回退快照，也不会自动恢复旧值。

默认网关只绑定127.0.0.1。主机入口、安全代理和P06的用户/服务权限按实际环境配置。状态目录必须长期保存，不能放在每次发布会清空的目录。第一次使用一个部署项目时，应为空项目；脚本会拒绝接管缺少本部署所有权标识的既有容器。

## 本机部署

从仓库根执行，Windows使用pnpm.cmd：

```sh
pnpm deploy:release --release /path/to/release --config /path/to/public-config.json --secrets /private/runtime.env --state-dir /persistent/deployment-state
```

PowerShell也可使用包装入口：

```powershell
./infra/deploy.ps1 -ReleaseDirectory <制品目录> -ConfigFile <公开配置文件> -SecretsFile <已有env文件> -StateDirectory <持久状态目录>
```

按顺序执行配置检查、拉取固定镜像、启动并等待就绪、核验实际容器。17个应用必须使用预期digest、平台和源码revision，数据库也必须健康。脚本不执行image prune、down或删除数据卷。

同一状态目录只能同时运行一项部署。初始化SQL按内容摘要存放到稳定挂载路径，重复部署不会仅因新的attempt目录而重建数据库。运行前后应保持env文件稳定；检测到内容变更会停止记录成功，脚本不会把它写回旧值。

## SSH部署

本地提供制品与公开配置；secrets和state-dir是目标服务器上已经规划好的路径：

```sh
pnpm deploy:ssh --host deploy@server.example --release /local/release --config /local/public-config.json --secrets /opt/magictools/private/runtime.env --state-dir /opt/magictools/state --remote-dir /opt/magictools/deployer
```

PowerShell入口增加HostName即可，RemoteDirectory可选：

```powershell
./infra/deploy.ps1 -HostName deploy@server.example -ReleaseDirectory <本机制品目录> -ConfigFile <本机公开配置> -SecretsFile /opt/magictools/private/runtime.env -StateDirectory /opt/magictools/state
```

上传内容仅包含公开制品、公开配置和无需额外npm依赖的部署脚本。私有env值不会被上传；目标机脚本读取已经存在的文件。远端路径使用绝对POSIX路径，主机可使用已经配置的SSH别名。

SSH退出成功并不直接判定部署成功，还需通过受限attempt标识回读服务器的JSON回执，检查制品、配置、就绪结果和秘密文件保护结果。连接或回读中断时会记录远端状态未确认，不能据此认定服务器没有发生变更；重新连接后应先查看该服务器的state与attempt回执。

## 查看结果

成功和失败尝试都保存在状态目录的 `attempts/<attemptId>/receipt.json`。成功的attempt还包含公开配置、原始制品快照及渲染后的Compose文件。回执包含制品校验和、configVersion、源码revision、各应用就绪结果和前次成功版本。

成功回执先原子落盘，再更新state.json，期间持续持锁。state.json记录current、previous及lastAttempt；任何未通过拉取、就绪、镜像身份或回执记录的尝试均不能推进成功指针。制品同名但校验和不同会保留前一快照，不会当成重复部署抹掉回退点。

SSH本地另存 `.qa/deploy-transfers/<runId>/transport.json` 和回读回执。传输失败或远端结果不匹配时进程非零退出，PowerShell不会显示完成。Docker配置错误可能包含敏感信息，公开错误只显示阶段、退出码与可识别的缺失变量名；进一步排查应在受控环境检查Docker和对应服务日志。

## 回退或恢复

```sh
pnpm deploy:release --rollback --secrets /private/runtime.env --state-dir /persistent/deployment-state
```

SSH在原参数中使用 `--rollback`，不再传release/config；PowerShell使用Rollback开关。秘密文件仍由本次调用显式指定。

| 当前记录 | 回退目标 |
|---|---|
| A成功、B成功 | 保存的A制品及公开配置 |
| A成功、B成功、C失败 | 最近成功的B，用于恢复稳定部署 |
| 只有A成功且无后续失败 | 没有更早的成功版本，返回错误 |
| 恢复同一成功版本 | 保留更早回退点，不覆盖为重复记录 |

回退读取持久状态中的快照，原下载目录或原公开配置文件变化不会改变目标；快照校验失败会在操作Docker前拒绝。回退只恢复应用镜像与公开部署配置，不逆向数据库迁移。数据库备份恢复由P04覆盖；不兼容迁移需要相应恢复方案。

## 失败处置与验证边界

- 配置阶段失败：检查必填数据库变量和配置JSON；现有env保持原样。
- 拉取失败：检查仓库登录、固定digest可访问性和网络；保留成功版本。
- 启动或就绪失败：依据失败回执检查服务、迁移及数据库连接，再选择恢复最近成功版本。
- 部署锁遗留：先确认原进程与远端操作是否仍在运行，不得因为等待超时就直接清锁。确认原操作已终止后再清理对应锁并恢复。

本批代码提供本机和SSH入口。真实Docker部署与两版本验证使用独立测试项目；SSH传输、退出码及回读逻辑使用可控适配器回归，实际生产SSH主机需在提供地址和凭证后验证。这些结果不代表生产环境已经上线或真实模型质量已经提升。

## 部署回归入口

`pnpm deploy:validate <上一版制品目录> <当前版制品目录>` 要求两份不同源码revision、已发布到本机测试registry的制品。验证器检查原始bundle，拒绝5432宿主端口、共享卷/外部网络、外部数据库直连和固化凭证，再创建全新的测试项目。

回归包括真实数据写入、两版升级及配置变化、别名标签移动但digest部署保持、缺镜像拉取失败、错误数据库凭证、迁移失败及恢复、回退与数据保留。迁移失败通过在当前Manager基础镜像额外注入失败SQL实现；这种制品明确标记为validation故障注入，不进入普通发布流程。结束后验证该项目容器/网络/卷零残留，清除生成的临时env。

CI smoke另用当前提交的同一份制品、两份公开配置验证部署和回退，并用不同镜像实际移动临时别名；其报告明确为config-change。本批不同源码SHA的升级验收单独记录为distinct-revisions，不能用前者替代后者。
