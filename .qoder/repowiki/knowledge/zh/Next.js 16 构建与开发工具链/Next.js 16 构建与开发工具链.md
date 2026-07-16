---
kind: build_system
name: Next.js 16 构建与开发工具链
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - next.config.ts
    - tsconfig.json
    - eslint.config.mjs
    - postcss.config.mjs
---

本项目基于 create-next-app 脚手架生成，采用 Next.js 16 + React 19 的默认构建体系，未引入自定义 Makefile、Dockerfile 或 CI 流水线，构建完全由 Next.js 内置命令驱动。

构建系统组成：
- 包管理与脚本：package.json 定义四组核心脚本 — dev（next dev）、build（next build）、start（next start）、lint（eslint），无预/后构建钩子，无多环境变体。
- 类型编译：tsconfig.json 使用 moduleResolution: bundler、jsx: react-jsx、noEmit: true，将类型检查交给 Next.js 内部 TypeScript 集成；路径别名 @/* 指向项目根目录，配合 Next 插件完成增量编译。
- 样式管线：postcss.config.mjs 仅注册 @tailwindcss/postcss 插件，Tailwind v4 通过 PostCSS 在 Next 构建阶段处理 CSS。
- 代码质量：eslint.config.mjs 基于 ESLint Flat Config，继承 eslint-config-next/core-web-vitals 和 typescript 规则集，并通过 globalIgnores 显式忽略 .next、out、build、next-env.d.ts。
- 框架配置：next.config.ts 为空对象导出，保持开箱即用，未启用自定义 webpack、输出目录重写、API 路由前缀等扩展。

约定与约束：
- 所有构建产物输出到 .next/ 目录（Next.js 默认），该目录被 .gitignore 排除。
- 依赖版本锁定于 package-lock.json，生产依赖与开发依赖严格分离，Next 与 eslint-config-next 版本号一致。
- 未定义任何发布、打包为 Docker 镜像或部署到特定平台的脚本，部署方式取决于宿主平台（Vercel 默认支持）。

缺失能力：
仓库中不存在 Makefile、Dockerfile、GitHub Actions / GitLab CI 等 CI/CD 配置文件，也没有版本语义化或变更日志管理脚本，属于最小化的本地开发构建体系。