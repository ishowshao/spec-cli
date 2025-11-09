# 添加关键集成测试 – 技术规范

所有者：spec-cli 维护者  
日期：2025-11-09  
范围：测试策略、目录布局、Vitest 配置、npm 脚本和初始集成测试计划

## 目标

- 引入确定性的、CI 友好的集成测试，不增加外部依赖。
- 将测试套件拆分为单元测试和集成测试，目录和脚本清晰分离。
- 保持 90% 覆盖率阈值，但仅将单元测试计入覆盖率。
- 目前避免交互式流程（跳过 `spec init`）。

## 非目标

- 实现 `spec init` 的交互式测试。
- 在测试期间调用真实的 OpenAI 或任何外部网络服务。

## 测试分类

- 单元测试：快速、隔离、模拟外部边界；如果提高真实性，允许在临时目录中使用文件系统和 git，但非必需。这些是覆盖率的主要来源。
- 集成测试：在可行的情况下，在进程级别端到端执行命令，在临时仓库中使用真实的 `git`，并通过 Node 使用 TypeScript 入口点。不使用网络。

## 目录布局

- `tests/unit/**` – 所有现有测试移至此（1:1 重命名）。
- `tests/integration/**` – 新的集成测试和辅助工具。
- `tests/integration/helpers/` – 共享测试工具（临时仓库脚手架、CLI 运行器）。

无需其他结构更改。

## Vitest 配置

采用 Vitest 项目以实现清晰分离。覆盖率仅对 `unit` 项目强制执行。

```ts
// vitest.config.ts (草图)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 两者共用的默认值
  test: {
    globals: true,
    environment: 'node',
  },
  projects: [
    {
      test: {
        name: 'unit',
        include: ['tests/unit/**/*.test.ts'],
        coverage: {
          thresholds: { branches: 90, functions: 90, lines: 90, statements: 90 },
          exclude: ['node_modules/**', 'dist/**', 'src/cli.ts'],
        },
      },
    },
    {
      test: {
        name: 'integration',
        include: ['tests/integration/**/*.test.ts'],
        // 集成测试运行针对稳定性优化，而非覆盖率导向
        coverage: { enabled: false as unknown as boolean },
        pool: 'forks',            // 测试之间更强的隔离
        fileParallelism: false,   // 串行运行集成文件以确保确定性
        testTimeout: 60_000,
        hookTimeout: 20_000,
        teardownTimeout: 20_000,
      },
    },
  ],
})
```

注意事项：
- 我们保持全局默认值最小化，并将覆盖率阈值移至 `unit` 项目，以便 `integration` 永远不会贡献覆盖率。
- 即使 Vitest 在配置中忽略 `coverage.enabled`，我们的脚本（如下）确保 `--coverage` 标志仅与 `--project unit` 一起使用。

## npm 脚本

添加或调整脚本以分离单元/集成流程和覆盖率：

```json
{
  "scripts": {
    "test": "vitest run --project unit --project integration",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:watch": "vitest --project unit",
    "coverage": "vitest run --project unit --coverage"
  }
}
```

理由：
- `test` 运行两个套件，在 CI 或本地提供完整信号。
- `coverage` 仅根据要求测量单元测试。
- `test:watch` 仅针对单元测试以快速反馈。

## 集成测试基础设施

辅助工具（将在 `tests/integration/helpers/` 下添加）：

- `repo.ts`
  - `initRepo(options)` 创建一个临时 Git 仓库，配置 `user.name/email`，并提交一个最小的 `spec.config.json` 以保持工作树清洁。
  - `initBareRemote()`（每个测试可选）创建一个本地裸远程，返回路径和辅助工具以执行 `git push -u origin <branch>`。
  - 始终返回 `{ repo, cleanup }` 以确保清理。

- `cli.ts`
  - `runCli(args, opts)` 通过 `execa` 执行 `node --loader tsx src/cli.ts ...`，使用 `reject: false` 以断言退出代码和标准输入输出。
  - 设置测试安全环境，例如 `{ CI: '1' }`，且永远不需要 `SPEC_OPENAI_API_KEY`。

## 初始集成场景

1) `spec list` – 正常路径
- 准备：具有最小配置的临时仓库，在 `docs/` 下有两个功能目录（例如，`a-feature/`、`b-feature/`）。
- 执行：`runCli(['list'], { cwd: repo })`。
- 断言：退出代码 0；stdout 列出排序后的 slug；无 stderr。

2) `spec list` – Git 仓库外
- 准备：没有 `git init` 的临时目录。
- 执行：`list`。
- 断言：非零退出代码（预检），保留错误消息。

3) `spec merge` – 带远程的正常路径
- 准备：
  - 创建临时仓库和本地裸远程；`main` 有推送到 `origin` 的初始提交。
  - 创建功能分支 `feature-foo`，添加文件，提交；仅推送到本地仓库（我们的代码路径不需要将功能推送到上游）。
  - 确保检出 `main` 并设置了上游。
- 执行：`runCli(['merge', 'foo', '--verbose'], { cwd: repo })`。
- 断言：退出代码 0；最后一次提交是合并提交；如果存在上游，CLI 打印 `Pushed to: <remote>`。

4) `spec merge` – 未配置上游
- 准备：只有本地分支的临时仓库；`main` 没有上游。
- 执行：`merge foo`。
- 断言：非零退出（GIT_ERROR）；消息提示设置上游。

5) `createCommand()` – 函数级集成（无 CLI）
- 使用依赖注入和假 LLM 客户端（已在现有测试中使用）在临时仓库中验证分支创建、docs/scaffold 路径和提交消息。
- 理由：避免交互式提示和 OpenAI；保留核心流程覆盖率。

注意事项：
- 我们有意跳过 CLI 级别的 `spec create`，直到我们引入仅测试的 LLM 存根选择器（例如，`SPEC_LLM_DRIVER=stub`）。

## 迁移计划

1) 创建 `tests/unit/` 和 `tests/integration/` 文件夹。
2) 将所有现有的 `tests/*.test.ts` 文件移至 `tests/unit/`（保留文件名）。
3) 添加辅助工具 `tests/integration/helpers/{repo.ts,cli.ts}`。
4) 为 `list`（2 个用例）和 `merge`（2 个用例）添加初始集成规范。
5) 将 `vitest.config.ts` 更新为草图中所示的项目布局，确保覆盖率阈值位于 `unit` 项目下。
6) 按指定更新 npm 脚本。
7) 本地运行：
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run coverage`（应仅对单元测试强制执行 90%）

## 确定性与性能

- 使用 `tempy` 创建唯一的临时目录并清理；不在工作区外写入。
- 对于集成项目：`pool: 'forks'`、`fileParallelism: false` 以避免 git 进程交叉干扰。
- 保持单个测试较小；优先使用本地裸远程而非网络来测试推送/拉取路径。

## 风险与缓解措施

- Git 在不同环境中的行为差异：通过仅本地仓库/远程和测试中的显式用户配置来缓解。
- 如果意外计入集成测试导致覆盖率波动：通过仅在 `--project unit` 上运行 `coverage` 并在单元项目配置中保持阈值来缓解。
- 未来 `create` 的 CLI E2E：需要产品级开关，根据环境变量选择存根 LLM 客户端；将单独提出。

## 验收标准

- `npm run test:unit` 通过并反映当前信号（文件移动后）。
- `npm run test:integration` 在无网络或密钥的干净机器上通过。
- `npm run coverage` 仅基于单元测试强制执行 90% 阈值。
- `npm run test` 运行两个套件，无需预先构建。
- 没有测试需要 `SPEC_OPENAI_API_KEY`。

## 附录 – 测试中使用的最小 `spec.config.json`

```json
{
  "schemaVersion": 1,
  "docsDir": "docs",
  "docTemplates": ["requirements.md", "tech-spec.md"],
  "scaffoldPaths": ["tests/{slug}.test.ts", "e2e/{slug}/"],
  "branchFormat": "feature-{slug}",
  "defaultMergeTarget": "main"
}
```
