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
    templates.ts         # 文档与 scaffoldPaths 的文件/目录创建
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
  scaffoldPaths?: string[],        # 额外脚手架路径模板（可为空），每项必须包含 {slug}
  branchFormat: string,            # 默认 "feature-{slug}"
  defaultMergeTarget: string       # 默认 "main"
}
```

约束（MVP）：
- `scaffoldPaths` 中每个模板必须：
  - 为相对路径（不可为绝对路径）；
  - 不包含越界段（禁止 `..`、`~` 等）；
  - 必须包含占位符 `{slug}`；
  - 末尾带 `/` 视为目录模板；否则视为文件模板（父目录自动创建，文件内容为空）。
- 所有展开后的路径必须落在仓库根目录内。

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
  "scaffoldPaths": [
    "tests/e2e/{slug}.spec.ts",
    "tests/{slug}.test.ts"
  ],
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
  - 仅检测测试相关结构：例如 `tests/`、`tests/e2e/`、`tests/unit/`、`src/**/__tests__/` 等；
  - 基于扫描结果与已安装工具生成 `scaffoldPaths` 候选模板（示例：`tests/e2e/{slug}.spec.ts`、`tests/{slug}.test.ts`、`cypress/e2e/{slug}.cy.ts`），供用户一键勾选；用户可手动增删改。
  - MVP 仅覆盖 JS/TS 与 Pytest；不推荐任何 `src/**` 业务目录模板。
- 交互项（@clack/prompts）：
  - `docsDir`、`docTemplates`（默认三项且均为空白）；
  - `scaffoldPaths`（多条输入/选择，默认空数组）；
  - `branchFormat`、`defaultMergeTarget`。
- 校验与落盘：
  - `scaffoldPaths` 每项必须为相对路径、包含 `{slug}`、不得越界；
  - 使用 zod 验证，无效项要求重新输入；写入严格 JSON（无注释）。

自动扫描候选规则（MVP：JS/TS + Pytest）
- JS/TS 扩展名推断：若存在 `tsconfig.json` 或发现 `.ts/.tsx` 测试样本，则使用 `ts`，否则 `js`。若存在对应工具的 `*.config.ts/js`，优先沿用其扩展名。
- Jest/Vitest（单测）：
  - 检测信号：`jest.config.*`、`vitest.config.*`、或 `package.json` 的依赖含 `jest`/`vitest`。
  - 目录优先级：存在 `__tests__/` → `__tests__/{slug}.<suffix>.<ext>`；否则存在 `tests/` → `tests/{slug}.<suffix>.<ext>`；都不存在则建议 `tests/{slug}.<suffix>.<ext>`。
  - `<suffix>` 通过样本多数决（`.spec.` vs `.test.`）；若都未发现则默认 `test`。
- Playwright（E2E）：
  - 检测信号：`playwright.config.*` 或 `package.json` 依赖含 `@playwright/test`。
  - 目录优先级：存在 `tests/e2e/` → `tests/e2e/{slug}.spec.<ext>`；否则存在 `tests/` → `tests/{slug}.spec.<ext>`；否则建议 `e2e/{slug}.spec.<ext>`。
- Cypress（E2E）：
  - 检测信号：`cypress.config.*`、`cypress/` 目录、或 `package.json` 依赖含 `cypress`。
  - 目录优先级：存在 `cypress/e2e/` → `cypress/e2e/{slug}.cy.<ext>`；否则存在旧结构 `cypress/integration/` → `cypress/integration/{slug}.spec.<ext>`；否则建议 `cypress/e2e/{slug}.cy.<ext>`。
- Pytest（Python）：
  - 检测信号：`pytest.ini`、`pyproject.toml` 的 `[tool.pytest.ini_options]`、`tox.ini` 含 pytest 配置，或已有 `tests/test_*.py`。
  - 模板：存在 `tests/` → `tests/test_{slug}.py`；否则建议 `tests/test_{slug}.py`。

其他约束
- 仅为“测试”生成候选；不生成 `src/**` 下的业务目录模板。
- 最多保留 5 条候选；排序：E2E（Playwright/Cypress） > 单测（Jest/Vitest） > Pytest。
- 对已存在同名路径的候选进行去重与剔除。

### 6.2 spec create <description>

- 预检：
  - 在 Git 仓库内（`git rev-parse --show-toplevel` 成功）。
  - 工作区干净（`git status --porcelain` 为空）。
  - 读取配置成功并通过 zod 校验。
  - `OPENAI_API_KEY` 存在；网络可连通（可选小请求探测）。
- 生成 slug（仅 LLM）：
  - 使用 LangChain(OpenAI) 调用，温度 0；严格 Prompt（见 §7）。
  - 本地正则验证：`^[a-z0-9]+(?:-[a-z0-9]+)*$` 且长度 ≤ 50。
  - 若不合规，携带违规原因提示模型重试；最多 `maxAttempts` 次，失败则退出。
  - 唯一性检查：
    - 文档目录：`{docsDir}/{slug}/` 不存在；
    - 本地分支：`git show-ref --verify refs/heads/{branch}` 不存在（`{branch}` 由 `branchFormat` 展开）；
    - 展开 `scaffoldPaths` 后的所有目标路径均不存在；
    - 任一冲突都会把“已占用”事实反馈给 LLM 请求替代 slug，直至达到重试上限。
- 执行（顺序保证不污染主分支）：
  - 先创建并切换新分支：`git switch -c {branch}`（`branchFormat` 替换 `{slug}`）。若分支创建/切换失败，立即退出，不进行任何文件写入。
  - 在该新分支内创建目录：`{docsDir}/{slug}/`。
  - 在目录下生成空白文件：按 `docTemplates` 列表创建（内容为空）。
  - 依据 `scaffoldPaths` 逐条创建：
    - 末尾带 `/` → 创建目录（递归创建父级）。
    - 否则 → 创建文件（自动创建父目录，内容为空白）。
    - 若任何目标在执行前已存在，应在预检阶段失败，不进入写入阶段。
  - 初始提交：`git add` → `git commit -m "feat({slug}): scaffold feature structure"`。
- 输出：展示 slug、分支名、创建的路径；遇错给出明确恢复建议（所有变更均在 feature 分支内，主分支不受影响）。

### 6.3 spec list

- 数据源：仅基于 `{docsDir}` 下的一级子目录名；仅输出满足 slug 正则的目录名（MVP 不对分支做并集/去重）。
- 输出与排序：仅输出 slug，本行一个；按字母序（ASCII，升序，区分大小写但 slug 约定为小写）排序后打印，确保结果稳定且与需求一致。

### 6.4 spec merge <feature-slug>

- 目标：用最小且可预测的 Git 指令完成合并；不做远程解析、不创建/设置 upstream、不做自动回退。

- 预检（最小化）：
  - 在 Git 仓库内；工作区干净。
  - feature 分支存在（本地）。feature 分支名由 `branchFormat` 将 `<feature-slug>` 展开为 `{featureBranch}`；若找不到分支，直接失败（码 5）。
  - 目标分支本地存在：`target = defaultMergeTarget`。若本地不存在，直接失败（码 5），提示用户手动创建或设置 upstream（提供示例命令），但不自动执行。

- 执行顺序（固定四步）：
  1) `git switch {target}`
  2) `git pull`
  3) `git merge --no-ff {featureBranch}`
  4) `git push`

- 失败处理（不做自动修复，立即交还控制权）：
  - 任一步失败即以错误码 5 退出，并原样回显 Git 错误信息；不再尝试 `--ff-only`、额外 `fetch`、或自动设置 upstream。
  - 合并冲突：提示冲突文件与解决步骤（手动解决 → 提交 → 重新运行 `spec merge`），不执行 `git push`。
  - `pull/push` 因未设置 upstream 失败：仅给出示例命令（例如 `git push -u <remote> {target}` 或 `git branch --set-upstream-to <remote>/{target} {target}`），不自动修改任何配置。
  - 绝不删除 feature 分支；合并方式固定为普通 merge（`--no-ff`），不可配置。

- 输出：
  - 在 `--verbose` 下逐条回显将执行的四条命令；成功后打印合并提交哈希与已推送的远程（若存在 upstream）。

## 7. LLM 集成与 slug 规范

### 7.1 Prompt 约束（核心）

- 目标：从任意语言的自然语言描述生成规范 ASCII slug：
  - 必须是`kebab-case`；
  - 长度 ≤ 50；
  - 仅输出 slug 本身，无需解释或包装。

### 7.2 验证与重试

- 使用正则校验与长度校验；失败则构造“违规原因 + 需修正点”的反馈给模型，最多 `maxAttempts` 次。
- 唯一性冲突（目录/分支/`scaffoldPaths` 目标已存在）也作为上下文提示模型生成新 slug。
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
  - `switch/create/commit/merge/pull/push` 等封装，失败返回结构化错误（含 `hint`）。
- 安全原则（分支先行，写入隔离）：在通过预检后，先创建并切换到 feature 分支；任何文件写入仅发生在该分支内。任一步失败时主分支不受影响（原子性/隔离）。
- 路径安全：解析 `scaffoldPaths` 展开结果必须位于 repo 根内；若包含绝对路径或越界段，一律视为配置校验失败（码 2）。

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

- config：加载/默认值回填/非法配置报错；`scaffoldPaths` 的格式校验（相对路径、包含 `{slug}`、不越界、末尾 `/` 语义）。
- preflight：仓库检测、工作区清洁度解析、错误映射。
- slug：响应解析、正则校验、违规反馈拼接、重试上限逻辑、唯一性冲突处理。
- git 参数构造：普通 merge 的命令拼装（不包含 squash/rebase）。

### 10.3 集成测试（E2E）

- `spec init`：在空仓库内生成 `spec.config.json`，断言默认值；当扫描到常见测试工具及目录结构时，给出 `scaffoldPaths` 建议并持久化选中项。
- `spec create`：
  - 生成 `docs/{slug}/` 与空白模板；
  - 按 `scaffoldPaths` 正确创建目录/文件（文件为空白）；
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
