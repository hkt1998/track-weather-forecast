---
kind: configuration_system
name: Next.js 应用根配置与脚手架
category: configuration_system
scope:
    - '**'
source_files:
    - next.config.ts
    - tsconfig.json
    - package.json
    - eslint.config.mjs
    - postcss.config.mjs
---

本项目为基于 create-next-app 生成的 Next.js 16 + React 19 单页应用，采用框架内置的“约定优于配置”模式，未引入独立运行时配置系统（无 .env、config/ 目录、环境变量加载库或 feature flag 机制）。所有构建期与开发期配置集中在仓库根目录的几个声明式文件中：

- **next.config.ts**：Next.js 构建与运行期配置入口，当前为空对象占位，未定义任何环境变量读取或外部配置加载逻辑。
- **tsconfig.json**：TypeScript 编译选项，启用 strict、isolatedModules、bundler 模块解析，并通过 `paths` 将 `@/*` 映射到项目根，配合 Next.js 插件提供路径别名。
- **package.json**：依赖与脚本声明，scripts 仅暴露 dev/build/start/lint 四个标准命令，未封装自定义配置加载或环境切换脚本。
- **eslint.config.mjs**：ESLint Flat Config，继承 eslint-config-next 的规则集，未包含自定义规则或按环境分发的配置分支。
- **postcss.config.mjs**：PostCSS 配置（Tailwind v4），样式处理链由框架自动集成，无需额外运行时配置。

在应用代码层（app/、lib/、components/）中未发现对 `process.env`、dotenv、conf、configstore 等运行时配置库的使用，API 路由与服务逻辑也未通过环境变量注入数据库连接串、密钥或第三方服务凭据——SQLite 数据文件位于 data/routes.db，属于静态资源而非可配置项。因此该项目目前不存在跨模块共享的运行时配置体系，所有行为均由上述声明式配置文件与硬编码值决定。若后续需要引入环境变量或外部配置，建议优先使用 Next.js 原生支持的 `.env.local` / `.env.production` 以及 `NEXT_PUBLIC_` 前缀常量，并在 next.config.ts 中集中管理构建期变量。