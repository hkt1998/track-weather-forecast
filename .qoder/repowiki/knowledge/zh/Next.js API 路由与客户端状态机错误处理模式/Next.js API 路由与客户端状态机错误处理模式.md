---
kind: error_handling
name: Next.js API 路由与客户端状态机错误处理模式
category: error_handling
scope:
    - '**'
source_files:
    - app/api/history/route.ts
    - app/api/parse-gpx/route.ts
    - app/api/weather/route.ts
    - app/page.tsx
    - app/compare/page.tsx
    - app/history/page.tsx
    - lib/gpx-parser.ts
    - lib/database.ts
---

本仓库采用**分散式 try/catch + NextResponse.json 统一响应体**的错误处理策略，未建立集中式错误类型体系或全局中间件。具体模式如下：

## API 层（服务端）
- 每个 Route Handler 使用 `try/catch` 包裹业务逻辑，捕获异常后通过 `NextResponse.json({ error: message }, { status })` 返回。
- 参数校验失败直接返回 400/404，数据库/IO 异常统一返回 500，并提取 `error instanceof Error ? error.message : '默认消息'` 作为用户可读信息。
- 示例文件：`app/api/history/route.ts`、`app/api/parse-gpx/route.ts`、`app/api/weather/route.ts`。
- 底层库函数（如 `lib/database.ts`、`lib/gpx-parser.ts`）**不定义自定义 Error 类**，而是抛出原生 `Error`，由上层 route 捕获并格式化。

## 客户端层（React 组件）
- 页面级使用**状态机模式**管理错误：`AppState` 联合类型包含 `{ status: 'error'; message: string }`，通过 `setState({ status: 'error', message })` 切换 UI。
- fetch 调用后检查 `res.ok`，若失败则解析 `err.error` 字段并重新抛出 `new Error(...)`，再由外层 catch 转换为状态更新。
- 对比页 `app/compare/page.tsx` 中用 `useState<string | null>(null)` 单独维护 `error` 字段，渲染时以 `<p className="text-red-500">{error}</p>` 展示。
- 历史页 `app/history/page.tsx` 在 catch 分支仅 `console.error` 记录日志，未向用户反馈错误（不一致之处）。

## 约定与缺失
- **无全局错误边界**：未发现 `ErrorBoundary` 组件或 `unhandledrejection` 监听。
- **无统一错误码/枚举**：所有错误以字符串消息传递，没有 `errorCode` 字段。
- **无中间件**：未在 `middleware.ts` 中集中处理 5xx 或鉴权错误。
- **无 panic/recover**：Node/Next.js 环境不使用该模式。
- 建议后续引入集中式错误类型（如 `AppError extends Error`）、API 层包装器以及 React Error Boundary，以提升一致性与可观测性。