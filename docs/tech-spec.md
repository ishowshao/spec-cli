# Spec CLI 技术方案（MVP）

版本：v0.1（MVP）  
日期：2025-11-07  
适用：Node.js 22 LTS，TypeScript，纯 ESM

## 1. 目标与范围

- 以 CLI 工具规范化 Feature 开发流程：初始化配置、创建功能骨架、列出功能、合并功能。
- 面向个人开发者（MVP），后续可扩展到团队协作。
- 严格遵循用户约束：
  - 仅 TypeScript；
  - 仅使用 LLM 生成多语言场景下的 feature slug；
  - 配置文件为 JSON；
  - 发布形态为 `npm i -g` 全局安装；
  - 不使用打包器（如 tsup），仅 `tsc` 编译；
  - 提交信息采用 Conventional Commits。

## 2. 关键技术决策

1) 运行时与模块
- Node 22 LTS；`"type": "module"` 采用纯 ESM。
- 进程调用使用 `execa`，跨平台兼容（Windows/macOS/Linux）。

2) 构建与发布
- 仅用 `tsc` 输出到 `dist/`，入口文件保留 shebang；全局安装通过 `bin` 指向 `dist/cli.js`。
- 开发期使用 `tsx` 直接执行 TS 源码。

3) 配置
- 固定文件名：`spec.config.json`（仓库根目录）。
- 使用 `zod` 校验并回填默认值；严格 JSON（不支持注释与 JS 配置）。

4) CLI/交互
- 命令分发：`commander`。
- 交互式向导：`@clack/prompts`（`spec init`）。

5) LLM 客户端
- 使用 LangChain.js（`@langchain/openai`）封装 OpenAI；网络超时与重试由我们控制。
- LLM 调用失败时终止并提示用户重试。

6) Git 适配
- 通过 `execa` 调用本地 `git`；在执行步骤前做“预检”，确保在 Git 仓库内且工作区干净。

7) 提交信息
- 采用 Conventional Commits，例如：`feat(user-authentication): scaffold feature structure`。

## 3. 总体架构

分三层：
- CLI 层：命令解析、参数处理、交互提示、输出格式化。
- Core 领域层：配置加载/校验、预检（环境/Git/LLM）、文档与测试骨架生成、合并策略编排、错误与退出码约定。
- 适配层：`llm`（LangChain + OpenAI）、`git`（本地命令）、`fs`（文件系统）。

推荐目录结构：

```
src/
  cli.ts                 # 入口（带 shebang）
  commands/
    init.ts
    create.ts
    list.ts
    merge.ts
  core/
    config.ts            # 读取/校验 spec.config.json（zod）
    preflight.ts         # Git/工作区/网络/配置检查
    templates.ts         # 空白文档/测试文件创建（支持 testsMode/testsDirs）
    slug.ts              # 基于 LLM 的 slug 生成与校验
    git.ts               # Git 封装（execa）
    logger.ts            # 输出/颜色/verbose
  adapters/
    llm/openai.ts        # LangChain(OpenAI) 封装
  types.ts
templates/
  requirements.md        # 纯空白模板（随 CLI 安装分发）
  tech-spec.md           # 纯空白模板
  user-stories.md        # 纯空白模板
```

## 4. 依赖清单

- 运行时：`commander`、`@clack/prompts`、`execa`、`zod`
- LLM：`@langchain/core`、`@langchain/openai`
- 开发：`typescript`、`tsx`、`vitest`、`tempy`、`rimraf`（清理 dist）

## 5. 配置规范

本项目区分两类配置：
- 目标仓库配置（项目级，随仓库提交）：`spec.config.json`
- CLI 全局配置（工具级，随开发者环境）：环境变量（MVP）

### 5.1 目标仓库配置：`spec.config.json`

zod Schema（语义）：

```
{
  schemaVersion: 1,
  docsDir: string,                 # 默认 "docs"
  docTemplates: string[],          # 默认 ["requirements.md","tech-spec.md","user-stories.md"]
  testsMode?: "single"|"multiple"|"none", # 测试落盘策略（由 init 决定），默认：若 testsDirs 为空则 "none"，否则按长度推断
  testsDirs?: string[] | null,     # 由 init 自动探测并经用户确认；single: 恰 1 个；multiple: >=1 个；none/null: 不生成测试
  testFileExt?: string,            # 自动探测，例：".test.ts"
  branchFormat: string,            # 默认 "feature-{slug}"
  defaultMergeTarget: string       # 默认 "main"
}
```

兼容性（读取层面）：若旧版本仅存在 `testsDir: string` 字段，则等价于
`testsMode = "single"` 且 `testsDirs = [testsDir]`。

命名与位置（MVP）：
- 文件名：`spec.config.json`
- 位置：仓库根目录
- 支持范围：MVP 仅支持该文件名

示例：

```json
{
  "schemaVersion": 1,
  "docsDir": "docs",
  "docTemplates": ["requirements.md", "tech-spec.md", "user-stories.md"],
  "testsMode": "single",
  "testsDirs": ["tests"],
  "testFileExt": ".test.ts",
  "branchFormat": "feature-{slug}",
  "defaultMergeTarget": "main"
}
```

### 5.2 CLI 全局配置：环境变量（MVP）

LLM 相关配置属于 `spec-cli` 的工具级依赖配置，不写入目标仓库的 `spec.config.json`。

- `OPENAI_API_KEY`（必需）：OpenAI API Key。
- `OPENAI_BASE_URL`（可选）：自定义 API Base URL。
- `SPEC_OPENAI_MODEL`（可选，默认 `gpt-5-mini`）：模型名。
- `SPEC_LLM_TIMEOUT_MS`（可选，默认 `8000`）：调用超时毫秒数。
- `SPEC_LLM_MAX_ATTEMPTS`（可选，默认 `3`）：失败重试次数上限。

## 6. 命令设计与执行流程

### 6.1 spec init

- 目的：交互式创建 `spec.config.json`。
- 自动探测：
  - `docs/` 是否存在；
  - 常见测试目录与分层：例如 `tests/`、`tests/e2e/`、`tests/unit/`、`src/**/__tests__/`；
  - 测试扩展名：扫描现有 `*.test.*` 或 `*.spec.*` 推断优先候选。
- 交互项（@clack/prompts）：
  - `docsDir`、`docTemplates`（默认三项且均为空白）；
  - `testsMode`（`single`/`multiple`/`none`）与 `testsDirs`（基于探测结果给出候选，用户可增删改）；
  - `testFileExt`、`branchFormat`、`defaultMergeTarget`。
- 校验与落盘：
  - `testsMode = single` 时要求 `testsDirs.length === 1`；`multiple` 时要求 `>=1`；`none` 时 `testsDirs` 可省略/为空；
  - 所有 `testsDirs` 必须为相对路径且目录存在（如不存在可选择创建）；
  - 使用 zod 验证，无效项要求重新输入；写入严格 JSON（无注释）。

### 6.2 spec create <description>

- 预检：
  - 在 Git 仓库内（`git rev-parse --show-toplevel` 成功）。
  - 工作区干净（`git status --porcelain` 为空）。
  - 读取配置成功并通过 zod 校验。
  - `OPENAI_API_KEY` 存在；网络可连通（可选小请求探测）。
- 生成 slug（仅 LLM）：
  - 使用 LangChain(OpenAI) 调用，温度 0；严格 Prompt（见 §7）。
  - 本地正则验证：`^[a-z0-9]+(?:-[a-z0-9]+)*$` 且长度 ≤ 48。
  - 若不合规，携带违规原因提示模型重试；最多 `maxAttempts` 次，失败则退出。
  - 唯一性检查：
    - 文档目录：`{docsDir}/{slug}/` 不存在；
    - 本地分支：`git show-ref --verify refs/heads/{branch}` 不存在（`{branch}` 由 `branchFormat` 展开）；
    - 远端分支（最佳努力）：
      - 解析远程 R：复用 `resolveRemoteForTarget(defaultMergeTarget)` 的规则；若能解析，则执行 `git ls-remote --heads {R} {branch}`；
      - 若远端已存在同名分支，则视为“slug 已占用”，把该事实反馈给 LLM 生成替代 slug；
      - 若无法唯一解析远程（多远程且 `target` 无 upstream，或未配置远程），跳过远端唯一性校验并输出醒目告警，建议为 `target` 设置 upstream 以启用完整校验；
    - 任一冲突都会把“已占用”事实反馈给 LLM 请求替代 slug，直至达到重试上限。
- 执行（顺序保证不污染主分支）：
  - 先创建并切换新分支：`git switch -c {branch}`（`branchFormat` 替换 `{slug}`）。若分支创建/切换失败，立即退出，不进行任何文件写入。
  - 在该新分支内创建目录：`{docsDir}/{slug}/`。
  - 在目录下生成空白文件：按 `docTemplates` 列表创建（内容为空）。
  - 测试文件创建严格按配置落盘（不再运行期猜测层级）：
    - 当 `testsMode = "single"` 且 `testsDirs=[d]` 时，在 `d/{slug}{testFileExt}` 创建；
    - 当 `testsMode = "multiple"` 且 `testsDirs=[d1,d2,...]` 时，分别在每个目录创建同名占位测试文件；
    - 当 `testsMode = "none"` 或 `testsDirs` 为空时，不创建测试文件；
    - 仅作为占位文件，不强制绑定特定框架命名习惯。
  - 初始提交：`git add` → `git commit -m "feat({slug}): scaffold feature structure"`。
- 输出：展示 slug、分支名、创建的路径；遇错给出明确恢复建议（所有变更均在 feature 分支内，主分支不受影响）。

### 6.3 spec list

- 数据源：仅基于 `{docsDir}` 下的一级子目录名；仅输出满足 slug 正则的目录名（MVP 不对分支做并集/去重）。
- 输出与排序：仅输出 slug，本行一个；按字母序（ASCII，升序，区分大小写但 slug 约定为小写）排序后打印，确保结果稳定且与需求一致。

### 6.4 spec merge <feature-slug>

- 预检（含远程健壮性）：
  - 解析远程名 R（不硬编码）：
    - 若目标分支 `target` 已设置 upstream，取其远程作为 R；
    - 否则读取 `git remote`：
      - 若仅有一个远程，取该远程为 R；
      - 若有多个远程且无 upstream，直接失败（码 5），提示用户为 `target` 设置 upstream（示例：`git push -u <remote> {target}` 或 `git branch --set-upstream-to <remote>/{target} {target}`）。
  - 工作区干净；
  - feature 分支存在（本地）；
  - 目标分支 `target = defaultMergeTarget`：
    - 远程存在性：`git ls-remote --heads {R} {target}` 成功，否则以错误码 5 退出（提示“远程不存在该目标分支”）。
    - 本地存在性：
      - 若本地不存在：`git fetch {R} {target}` 后，`git switch -c {target} --track {R}/{target}` 创建并跟踪；失败则以 5 退出。
      - 若本地存在但未设置 upstream：`git branch --set-upstream-to {R}/{target} {target}`；失败以 5 退出。
- 执行：
  - `git fetch {R}`（刷新远程引用）；
  - `git switch {target}`（已确保有 upstream）；
  - 优先快进拉取：`git -c pull.rebase=false pull --ff-only`（避免受用户全局 rebase 配置影响）。
  - 若因“非快进”导致失败（fast-forward not possible），自动回退为普通拉取：`git -c pull.rebase=false pull`，将远端更新合入本地 `target` 后继续；其它错误（网络/认证等）以 5 退出并给出提示。
  - 普通合并：`git merge --no-ff {feature}`；
  - 合并成功后自动推送：`git push`（已设置 upstream；若被远程拒绝则以 5 退出并提示远端存在新的更新，建议重新执行本流程：fetch → ff-only → 必要时回退到普通 pull → 合并 → 推送）。
- 冲突与失败处理：
  - 合并产生冲突（`git merge --no-ff {feature}`）：打印解决步骤并以非零码退出，不执行推送；
  - 回退为普通 `git pull` 时若产生冲突：提示先在 `target` 上解决并提交冲突，然后重新执行 `spec merge`；
  - `push` 被拒绝：提示远端有新提交产生竞态，建议重新执行合并流程（将再次经历 fetch → ff-only → 必要时回退到普通 pull → 合并 → 推送）。

## 7. LLM 集成与 slug 规范

### 7.1 Prompt 约束（核心）

- 目标：从任意语言的自然语言描述生成规范 ASCII slug：
  - 仅小写英文字母、数字、短横线；
  - 不允许连续短横线、前后短横线；
  - 长度 ≤ 48；
  - 需要语义转写（中文/日文/俄文等转为拉丁字符）；
  - 仅输出 slug 本身，无需解释或包装。

示例系统提示（摘要）：

```
你是一个 slug 生成器。给定特性描述，输出单个 slug：
- 仅 [a-z0-9-]；
- 用短横线分词；
- 无前后短横线与重复短横线；
- 最长 48 字符；
- 需要将非拉丁字符转写为拉丁字母；
- 仅输出 slug，不输出其他内容。
```

示例用户输入与期望输出：
- 输入：`“用户认证系统”` → 输出：`yong-hu-ren-zheng-xi-tong`（示例）
- 输入：`Add user authentication system` → 输出：`user-authentication-system`

### 7.2 验证与重试

- 使用正则校验与长度校验；失败则构造“违规原因 + 需修正点”的反馈给模型，最多 `maxAttempts` 次。
- 唯一性冲突（目录/分支已存在）也作为上下文提示模型生成新 slug。
- 达到上限仍失败则报错退出；不支持手工 `--slug` 覆盖（MVP，取舍说明见 §13.1）。

### 7.3 网络与超时

- 通过 LangChain 设置请求超时（默认 8s）与调用层重试策略（指数退避，最多 2 次）。
- 不记录或回显 API Key；支持通过环境变量：
  - `OPENAI_API_KEY`（必需）、`OPENAI_BASE_URL`（可选）；
  - `SPEC_OPENAI_MODEL`、`SPEC_LLM_TIMEOUT_MS`、`SPEC_LLM_MAX_ATTEMPTS`（可选，见 §5.2）。

## 8. Git 适配与预检

- 预检函数：
  - `getRepoRoot()`：通过 `git rev-parse --show-toplevel` 判定；
  - `isClean()`：`git status --porcelain`；
  - `branchExists(name)`：`git show-ref --verify refs/heads/{name}`；
  - `getUpstream(branch)`：解析 `@{u}`，判断是否已设置 upstream；
  - `resolveRemoteForTarget(target)`：远程解析——若 `target` 有 upstream，返回其远程；否则读取 `git remote`，仅有一个远程则返回该远程；若多远程且无 upstream，返回错误与修复提示。
  - `ensureTracking(target)`：
    - 调用 `resolveRemoteForTarget(target)` 确定远程 R；
    - 若远程 `{R}/{target}` 存在且本地不存在，创建并跟踪；
    - 若本地存在但无 upstream，设置 `{R}/{target}` 为 upstream；
  - `switch/create/commit/merge/pull/push` 等封装，失败返回结构化错误（含 `hint`）。
- 安全原则（分支先行，写入隔离）：在通过预检后，先创建并切换到 feature 分支；任何文件写入仅发生在该分支内。任一步失败时主分支不受影响（原子性/隔离）。

## 9. 日志、错误与退出码

- 输出：简洁明了，关键步骤配合 `@clack/prompts` 的 spinner/step。
- 日志级别：`--verbose` 开启详细命令行回显；`SPEC_DEBUG=1` 输出调试信息。
- 退出码约定：
  - 0：成功；
  - 2：配置/参数校验失败；
  - 3：预检失败（例如非 Git 仓库/工作区不干净）；
  - 4：LLM 调用或校验失败；
  - 5：Git 操作失败；
  - 1：其他未知错误。

## 10. 测试策略

### 10.1 测试框架与工具

- 使用 `vitest` 作为测试框架；
- 使用 `tempy` 创建临时目录与临时 Git 仓库；
- 通过依赖注入提供 `FakeLlmClient`，在测试中不访问网络；
- 测试前设置 git 用户信息：`git config user.name test && git config user.email test@example.com`。

### 10.2 单元测试（示例）

- config：加载/默认值回填/非法配置报错；`testsMode/testsDirs` 的组合校验与旧字段 `testsDir` 的兼容映射。
- preflight：仓库检测、工作区清洁度解析、错误映射。
- slug：响应解析、正则校验、违规反馈拼接、重试上限逻辑、唯一性冲突处理。
- git 参数构造：普通 merge 的命令拼装（不包含 squash/rebase）。

### 10.3 集成测试（E2E）

- `spec init`：在空仓库内生成 `spec.config.json`，断言内容与默认值；当探测到多层测试结构时，提示并持久化 `testsMode = multiple` 与 `testsDirs`。
- `spec create`：
  - 生成 `docs/{slug}/` 与空白模板；
  - 按 `testsMode/testsDirs` 正确落盘占位测试文件（single: 正好 1 个；multiple: 在每个目录各 1 个；none: 0 个）；
  - 新建分支并提交；
  - 冲突与不合规返回路径验证（借助 FakeLlmClient 注入不同响应）。
- `spec list`：基于 docs 目录正确枚举；断言输出按字母序（ASCII 升序）排序且仅包含 slug 文本。
- `spec merge`：在无冲突条件下普通 merge 执行路径正确；冲突路径仅断言提示信息。

## 11. 构建与发布

- `tsconfig.json` 关键项：

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "strict": true,
    "noEmitOnError": true
  },
  "include": ["src/**/*"]
}
```

- `package.json` 关键项（示例）：

```json
{
  "name": "spec-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "spec": "dist/cli.js" },
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p tsconfig.json",
    "clean": "rimraf dist",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  }
}
```

注意：`src/cli.ts` 顶部需包含 `#!/usr/bin/env node`（`tsc` 会保留）。

## 12. 兼容性与本地化

- 跨平台命令行：统一通过 `execa` 执行 Git；路径拼接使用 Node 官方 `path` API。
- 输出语言：MVP 使用英文/中文简洁提示；后续可抽象 i18n。

## 13. 设计取舍说明：LLM 强依赖与 LangChain 保留

### 13.1 不支持 `--slug` 覆盖（MVP）

- 核心目标是“标准化 Feature 开发流程”。slug 统一由 LLM 生成可确保：
  - 跨语言一致的转写规则与分词风格，避免人工随意命名导致的不可比性；
  - 与分支命名、提交信息中的 `{slug}` 保持一致，减少人为偏差；
  - 后续可复用同一套生成策略扩展到更多需要规范化命名/标签的场景（不仅是 slug）。
- 取舍结论：MVP 阶段不提供 `--slug` 手工覆盖，也不提供离线模式。`spec create` 依赖 LLM 成功返回才会继续执行（详见 §6.2、§7）。当网络/配额/模型暂不可用时，命令以退出码 4 失败并给出明确提示与恢复建议（检查 `OPENAI_API_KEY`、网络、稍后重试）。

### 13.2 保留 LangChain 作为 LLM 适配层

- 规划导向：未来版本会有更多依赖 LLM 的能力（不仅是 slug）。保留 LangChain 有利于：
  - Provider 抽象与可扩展性：在不改变核心业务代码的前提下扩展到其他模型/供应商；
  - 统一的调用与重试/超时控制接口，降低自研通用基础设施的成本；
  - 后续需要的结构化输出、流水线式调用等能力具备成熟生态支持。
- MVP 实施：
  - 仍由我们在调用层控制超时与重试（见 §7.3），不依赖 LangChain 的默认策略；
  - 仅封装最小必要功能（生成 slug 的文本补全），避免引入与当前需求无关的复杂度。

### 13.3 可用性与可恢复性的边界

- 本工具将 LLM 视为“硬依赖”，不做“LLM 不可用时仍能完成 `spec create`”的假设。对应的工程缓解措施为：
  - 预检阶段尽早失败：校验 `OPENAI_API_KEY` 是否存在，必要时进行最小连通性检查（可配置），以减少在写入阶段才失败的概率（见 §6.2、§7.3）。
  - 明确失败语义：LLM 相关失败统一返回退出码 4，并附带可操作的恢复建议；
  - 验证与重试：严格正则校验 + 违规原因回传 + 有上限的重试（见 §7.2）。
- 测试与可维护性：通过依赖注入在测试中提供 `FakeLlmClient`，保证测试不依赖网络且可稳定复现（见 §10）。
