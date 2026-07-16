---
kind: dependency_management
name: npm 依赖管理与锁定策略
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - next.config.ts
---

本项目采用标准的 npm 单包管理方式，基于 create-next-app 脚手架生成，未使用 monorepo 或私有仓库。

1. 使用的系统/工具
- 包管理器：npm（通过 package-lock.json 锁定）
- 运行时框架：Next.js 16 + React 19
- 构建与脚本：由 Next.js CLI 提供，通过 package.json 的 scripts 字段声明 dev、build、start、lint 四个命令

2. 核心文件
- package.json：唯一依赖声明入口，区分 dependencies 与 devDependencies
- package-lock.json：npm 生成的完整依赖树锁定文件，所有第三方包的精确版本与来源（registry.npmjs.org）均被固定
- next.config.ts：当前为空对象，未配置任何自定义依赖解析规则（如 webpack alias、external 等）

3. 架构与约定
- 无 vendoring / nohoist / workspace 等多包策略，为单一 flat 依赖树
- 依赖按功能分组清晰：业务层（better-sqlite3、@tmcw/togeojson、@xmldom/xmldom、leaflet、react-leaflet）、框架层（next、react、react-dom）、开发层（typescript、eslint、tailwindcss、@tailwindcss/postcss、各类 @types/*）
- 版本号策略：生产依赖使用 ^ 前缀（允许小版本/补丁自动升级），但 package-lock.json 锁定了实际安装版本；next 与 eslint-config-next 保持严格一致（均为 16.2.10）
- 未发现 .npmrc、pnpm-workspace.yaml、bun.lockb、yarn.lock、verdaccio 或私有 registry 配置，全部从官方 npm 源拉取

4. 开发者应遵循的规则
- 新增依赖时统一在 package.json 中声明，不要手动编辑 package-lock.json
- 保持 next 与 eslint-config-next 主版本号一致，避免 ESLint 规则不匹配
- 若引入 Node-only 包（如 better-sqlite3），需确保其原生模块在部署环境可编译
- 由于未配置私有 registry，所有依赖均来自公共 npm，如需内部包需额外配置 .npmrc 或 CI 环境变量
- 项目标记为 private: true，不应发布到 npm 公共仓库