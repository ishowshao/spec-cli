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
    templates.ts         # 空白文档/测试文件创建
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
  testsDir?: string | null,        # 自动探测，可为空表示不生成测试文件
  testFileExt?: string,            # 自动探测，例：".test.ts"
  branchFormat: string,            # 默认 "feature-{slug}"
  defaultMergeTarget: string       # 默认 "main"
}
```

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
  "testsDir": "tests",
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
- 自动探测：`docs/` 是否存在；常见测试目录（`tests/`、`src/**/__tests__/`）；测试扩展名（扫描现有 `*.test.*` 或 `*.spec.*`）。
- 交互项（@clack/prompts）：docsDir、docTemplates（默认三项且均为空白）、testsDir、testFileExt、branchFormat、defaultMergeTarget。
- 校验与落盘：使用 zod 验证，无效项要求重新输入；写入严格 JSON（无注释）。

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
    - `docs/{slug}/` 不存在；
    - `git show-ref --verify refs/heads/feature-{slug}` 不存在（或按 `branchFormat` 展开）。
    - 冲突则将“slug 已占用”的事实反馈给 LLM 请求替代 slug，直至达到重试上限。
- 执行：
  - 创建目录：`{docsDir}/{slug}/`。
  - 在该目录下生成空白文件：按 `docTemplates` 列表创建（内容为空）。
  - 若配置了 `testsDir` 与 `testFileExt`，依据项目结构自动选择层级创建测试文件：
    - 若存在 `tests/e2e/`，则在 `tests/e2e/{slug}{testFileExt}` 创建；
    - 若存在 `__tests__/` 或 `tests/unit/`，则在对应目录下创建；
    - 否则在 `{testsDir}/{slug}{testFileExt}` 创建；
    - 仅作为占位文件，不强制绑定特定框架命名习惯。
  - 创建并切换新分支：`git switch -c {branch}`（`branchFormat` 替换 `{slug}`）。
  - 初始提交：`git add` → `git commit -m "feat({slug}): scaffold feature structure"`。
- 输出：展示 slug、分支名、创建的路径；遇错给出明确恢复建议。

### 6.3 spec list

- 数据源：仅基于 `{docsDir}` 下的一级子目录名；仅输出满足 slug 正则的目录名（MVP 不对分支做并集/去重）。

### 6.4 spec merge <feature-slug>

- 预检：
  - 目标分支存在（`defaultMergeTarget`）；
  - 工作区干净；
  - feature 分支存在；
  - 可选：提示未推送的提交。
- 执行：
  - `git switch {target}` → `git pull`；
  - 进行普通合并：`git merge --no-ff {feature}`；
  - 合并成功后自动 `git push` 目标分支（无冲突即推送）；默认不删除 feature 分支。
- 冲突处理：打印步骤提示并以非零码退出，保留当前状态供用户解决。

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
- 达到上限仍失败则报错退出；不支持手工 `--slug` 覆盖（MVP）。

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
  - `switch/create/commit/merge/pull` 等封装，失败返回结构化错误（含 `hint`）。
- 安全原则：在任一步失败前不写入任何文件、不创建分支（原子性）。

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

- config：加载/默认值回填/非法配置报错。
- preflight：仓库检测、工作区清洁度解析、错误映射。
- slug：响应解析、正则校验、违规反馈拼接、重试上限逻辑、唯一性冲突处理。
- git 参数构造：普通 merge 的命令拼装（不包含 squash/rebase）。

### 10.3 集成测试（E2E）

- `spec init`：在空仓库内生成 `spec.config.json`，断言内容与默认值。
- `spec create`：
  - 生成 `docs/{slug}/` 与空白模板；
  - 新建分支并提交；
  - 冲突与不合规返回路径验证（借助 FakeLlmClient 注入不同响应）。
- `spec list`：基于 docs 目录正确枚举。
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


