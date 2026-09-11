# 独立镜像、运行验证与制品清单

## 运行方式

平台包含 Gateway、八个后端和八个 Web，共17个应用镜像。镜像清单及端口从 `infra/ports.yaml` 生成。Node镜像采用固定digest的Node 22基础镜像，通过 `pnpm deploy --prod` 携带生产依赖和公共包；运行用户为node（UID1000）。后端包含迁移，Gateway和Assistant包含端口映射，Designer包含esbuild、React、AntD及UI包。

构建阶段按锁文件安装依赖；pnpm 9的生产目录打包需要依赖元数据，因此deploy采用prefer-offline。构建上下文排除.env、.npmrc、密钥文件、测试输出和Git目录。使用者通过运行配置注入秘密，不把本机配置复制到镜像。

## 存活与就绪

| 服务 | 存活接口 | 就绪接口 | 就绪条件 |
|---|---|---|---|
| 八个后端 | `/api/<app>/health` | `/api/<app>/health/ready` | 数据库可访问，镜像声明的迁移均已登记 |
| Gateway | `/health` | `/ready` | 八个后端就绪及八个Web入口可访问 |
| Web | 应用入口 | `/<app>/` | Nginx可以提供应用入口 |

后端在迁移与初始化完成后监听端口；失败时非零退出。运行期间数据库断连返回503，空闲连接错误不会终止进程，数据库恢复后重新就绪。迁移目录缺失、没有迁移文件或迁移未完成均不就绪。就绪检查确认迁移名称是否登记，不证明数据库内容或迁移SQL未经修改。

Gateway启用令牌时，就绪接口遵循相同访问规则，镜像自身探针读取运行令牌。Assistant在容器模式使用服务名探测就绪并调用网关；身份和服务权限细分属于P06。

## 构建与验收命令

在仓库根目录运行，下列命令在Windows使用 `pnpm.cmd`。

```sh
# 从干净提交构建17镜像
pnpm images:build

# 开发中的完整容器回归：自动构建、冷启动、检查、清理
pnpm images:smoke

# 指定已经构建且源码未变的清单验收
pnpm images:validate .qa/images/<runId>/build.json

# 单镜像开发验证，不能作为完整发布清单
pnpm images:build --validation --only manager-server
```

`images:build` 默认要求干净提交，标签为完整源码SHA。`--validation` 允许开发工作树，标签使用工作树指纹，并明确标记为验证制品。构建清单同时记录本地image ID、源码、平台、服务及探针；构建期间源码变化则失败。单服务清单不能通过完整运行验收或正式发布。

`images:smoke` 使用独立Compose项目、网络和新数据库卷，只在127.0.0.1随机开放网关端口，不连接本机5432。开始前显式拉取固定digest的pgvector镜像并核对平台，支持没有数据库镜像缓存的CI机器；应用镜像继续使用本轮固定ID且不自动拉取替代品。验证配置拒绝宿主挂载、外部网络/容器/秘密引用及命令覆盖，并清除生产秘密。验证结束清理本轮资源；清理失败也不能报告整体验证成功。

检查包括：17服务健康、镜像身份与平台、Node非root且无源码挂载、八库迁移、Assistant容器探测、Web深链及JS/CSS、Manager新增修改、Designer实际编译、数据库断连恢复，以及删除容器并重建后的数据保留。此流程不评价真实模型回答质量。

## 发布清单

```sh
# 已构建的干净提交镜像发布到自己的仓库
pnpm images:publish --build-manifest .qa/images/<buildId>/build.json --runtime-manifest .qa/runtime/<runtimeId>/runtime.json --registry registry.example.com/magictools

# CI使用：从干净提交构建，验收同一批镜像后发布
pnpm images:release --registry registry.example.com/magictools
```

执行前需完成目标仓库的Docker登录，仓库参数必须包含显式主机和命名空间。发布须提供成功运行回执，核对9项完整检查、资源清理以及与构建完全一致的17个image ID和源码；main重新构建的镜像会重新验收。发布程序逐一推送SHA标签，从仓库记录读取实际digest，再按digest拉回核对镜像内容。最终清单中的引用为 `repository@sha256:...`。本地image ID与registry digest分字段记录；即使当前Docker存储模式下两者数值相同，也分别通过本地inspect和仓库推送/回读取得。

制品包含 `release.json`、`compose.json`、`ports.json`、`postgres-init.sql` 和发布回执，运行配置文件有SHA256校验和。秘密值不进入制品。验证工作树仅在显式 `--validation` 下发布为验证制品。

P05的本机与SSH部署入口、配置版本回执和回退见 [部署操作说明](deployment-receipts.md)。`infra/deploy.ps1` 已改为调用同一部署流程，不再覆盖env或清理镜像。生产Compose要求显式提供数据库密码与八库URL，外部集成变量透传到对应服务。当前整批仍需完成第二版制品及真实回退验收后合并。

## CI与证据

CI保留quality、smoke、e2e三个required check名称。qa:gate的构建/单测最多同时执行2个任务，避免多套Vite与动态预览编译争用资源导致测试超时。smoke执行实际镜像冷启动；失败和成功都保存 `.qa/images/` 与 `.qa/runtime/`。main通过全部检查后，有仓库配置才发布不可变清单；缺少配置时在workflow摘要记录未发布。

本地回执在 `.qa/`，不提交Git。CI的runtime-evidence与image-release制品分别保存运行和发布证据。回执绑定源码与运行身份；工作树证据、CI候选证据和生产部署回执应分别核对。

smoke还会启动一次性本机registry，推送已验收的当前制品，执行同制品配置升级、故障恢复和回退的实际部署回归。JSON回执保留，临时env不上传。不同源码SHA的两版本验证使用 `deploy:validate` 单独完成。

新应用模板包含独立镜像、迁移起点及ready接口。`new:app`仍负责生成目录和分配端口，生产Compose与数据库初始化注册需随新增应用补齐；服务清单不一致会在容器验证前失败。
