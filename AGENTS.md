# 项目协作约定

## 包管理器

- 本项目统一使用 pnpm；版本以 `package.json` 的 `packageManager` 字段为准（当前为 `pnpm@12.5.1`）。
- 安装依赖使用 `pnpm install`；CI 和需要严格复现依赖时使用 `pnpm install --frozen-lockfile`。
- 添加、移除依赖使用 `pnpm add`、`pnpm add -D`、`pnpm remove`；执行工具使用 `pnpm exec`。
- 执行脚本使用 `pnpm run <脚本名>`，例如 `pnpm run dev`、`pnpm run build`、`pnpm test`。
- 只维护并提交 `pnpm-lock.yaml`，依赖变更时同步更新；不要使用 npm/yarn 安装依赖或生成 `package-lock.json`、`yarn.lock`。
- 保留 `pnpm-workspace.yaml` 中的 `nodeLinker: hoisted` 和依赖构建许可，以支持 Electron 安装与打包。新增需要安装脚本的依赖时，检查后按需更新 `allowBuilds`。

## 验证

- 修改后按影响范围运行 `pnpm test` 和 `pnpm run build`。
- 界面和放映交互由人工测试；不要添加会启动浏览器或 Electron 窗口的自动化测试。
