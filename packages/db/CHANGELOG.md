# @mt/db

## 0.0.2

### Patch Changes

- b4bcc0a: 补齐独立生产镜像所需的公共包文件声明，增加数据库就绪检查并修复数据库断连导致进程退出的问题。应用镜像携带生产依赖、迁移及必要资源，使用真实容器回归和固定 digest 制品清单验证交付。

  部署使用同一批已验收镜像、独立公开配置和已有秘密文件，记录成功/失败回执及可回退快照，提供本机和 SSH 入口。

- Updated dependencies [b4bcc0a]
  - @mt/types@0.0.1

## 0.0.1

### Patch Changes

- 8c4c045: 后端健壮性与工程化收尾：

  - `@mt/model-client` 新增健壮 `parseJson`（容错无引号键 / 代码围栏 / 夹杂文字），applicant/gatherer/investigator/assessor/scholar 服务替换裸 `JSON.parse`，规避 LLM 非法输出导致 500；assistant/designer 本地 `json.ts` 改为 re-export；
  - `@mt/db` outbox 失败达 `maxAttempts` 进入 `dead` 终态；
  - 前端合并 applicant 冗余 api 层、ChatPage 自动滚动、清理硬编码色值；
  - CI 合并重复 build 步骤并缓存 turbo 构建；新增 `pnpm test:affected`（`turbo run test --affected`）作为回归层。
