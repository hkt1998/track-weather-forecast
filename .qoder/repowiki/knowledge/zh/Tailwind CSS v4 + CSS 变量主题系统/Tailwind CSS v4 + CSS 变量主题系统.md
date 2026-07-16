---
kind: frontend_style
name: Tailwind CSS v4 + CSS 变量主题系统
category: frontend_style
scope:
    - '**'
source_files:
    - app/globals.css
    - postcss.config.mjs
    - app/layout.tsx
    - app/page.tsx
---

本项目采用 Tailwind CSS v4（通过 `@tailwindcss/postcss` 插件）作为唯一样式方案，结合原生 CSS 自定义属性实现设计令牌与暗色模式。核心架构如下：

**样式入口与主题定义**
- `app/globals.css` 是全局样式入口，使用 `@import "tailwindcss"` 引入 Tailwind，并通过 `:root` 定义 `--background`、`--foreground` 两个基础 CSS 变量，再通过 `@theme inline` 块映射到 Tailwind 的 `--color-background`、`--color-foreground` 以及 `--font-sans`、`--font-mono` 字体族。
- 暗色模式基于 `prefers-color-scheme: dark` 媒体查询自动切换，无需 JS 驱动。
- 针对 Leaflet 地图组件做了 Tailwind v4 preflight reset 的兼容修复（`.leaflet-container img.leaflet-tile` 覆盖 `max-width/max-height` 等限制）。

**构建配置**
- `postcss.config.mjs` 仅注册 `@tailwindcss/postcss` 插件，无额外 PostCSS 处理链。
- `next.config.ts` 未对样式进行特殊定制，保持 Next.js 默认行为。

**组件层约定**
- 所有 UI 组件（`components/` 下 `.tsx` 文件）及页面（`app/` 下 `.tsx`）统一使用 Tailwind 原子类在 `className` 中声明样式，未见任何内联 `style` 对象或第三方 CSS-in-JS 库。
- 广泛使用 `dark:` 前缀为每个元素提供暗色变体，配合全局 `prefers-color-scheme` 媒体查询实现系统级暗色模式。
- 布局以 Flexbox/Grid 原子类为主（`flex`、`items-center`、`justify-between`、`gap-*`），容器宽度通过 `max-w-7xl mx-auto` 等类控制。
- 颜色体系围绕 Tailwind 内置 gray/blue/green 调色板，辅以半透明背景（如 `bg-white/60`）和圆角（`rounded-xl`、`rounded-lg`）形成统一的卡片风格。

**设计令牌策略**
- 目前仅暴露了背景/前景色与两套字体族作为可复用令牌，其余间距、字号、圆角等均直接使用 Tailwind 原子值，尚未建立更细粒度的 design token 层。

开发者应遵循：优先使用 Tailwind 原子类；需要新增品牌色时先在 `:root` 定义 CSS 变量再经 `@theme inline` 注入；为所有可见元素补充 `dark:` 变体；避免编写独立 CSS 文件，将局部样式直接内联于 `className`。