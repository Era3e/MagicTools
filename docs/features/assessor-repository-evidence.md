# Assessor 仓库证据反向整理

P10 在既有调研评审流程之外，新增按 Git 提交反推代码能力证据的任务。它回答“这个提交实际改了哪类业务入口、契约和行为”，但不把代码差异直接冒充业务动机。

## 采集规则

入口为 `POST /api/assessor/repository-evidence/reverse-engineer`，参数为 `repo`（owner/repo）和 7–40 位 `commitSha`。GitHub Client 会先读取提交元数据与完整变更文件清单：

- GitHub 标记提交清单截断时立即失败；
- 变更文件超过 200 个时立即失败，不做静默截断；
- 仅筛选 routes、controller、service、schema、tests 五类源码文件；
- 按该提交 SHA 读取内容并计算 SHA-256；删除文件先读取父提交下删除前内容，证据链接也指向父提交；
- 记录提交文件总数、命中源码数、提交信息和任务时间。

仓库上下文的旧目录树能力同样移除了200条切片；GitHub 目录树被标记截断时显式失败。

## 候选与证据

每个命中文件生成一个反向整理候选，落库字段包含：

- 候选标题、说明、类别和源码路径；
- `motivation` 固定为 `unknown`，表示仅凭源码与提交无法可靠推断业务动机；
- `contentSha256`，绑定该提交下实际读取到的文件内容；
- `evidence` 对象，包含 commit、path、startLine、endLine、GitHub blob 链接和变更片段。

行号优先来自 unified diff hunk；无 patch 时回退为文件首个非空行。证据链接使用提交 SHA，而不是可移动分支。

相同仓库相同规范化提交 SHA 的任务由数据库唯一键去重。重复请求返回既有任务和候选，不重复插入；并发请求通过 `ON CONFLICT DO NOTHING` 归一到同一任务。

## 数据与接口

迁移 004 新增：

- `repository_evidence_tasks`：任务、提交、文件计数和幂等键；
- `repository_evidence_candidates`：候选、类别、内容哈希和证据 JSON，随任务级联删除。

查询接口：

- `GET /api/assessor/repository-evidence/tasks?limit=50`
- `GET /api/assessor/repository-evidence/tasks/:id`

Assessor 后台新增「仓库证据」页面，支持输入仓库和提交 SHA、查看任务列表、点击任务查看候选，并直接打开 GitHub 源码行级证据。

## 验证

- GitHub Client 单测覆盖目录不截断、API截断失败、提交超过200文件失败和按提交读取文件。
- Assessor 真实数据库用例覆盖五类文件筛选、候选证据、动机 unknown、重复提交幂等、任务列表和详情。
- 浏览器 E2E 覆盖 API候选数量和页面证据链接。
