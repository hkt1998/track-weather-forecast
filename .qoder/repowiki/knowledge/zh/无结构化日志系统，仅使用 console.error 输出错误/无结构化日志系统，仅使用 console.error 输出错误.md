---
kind: logging_system
name: 无结构化日志系统，仅使用 console.error 输出错误
category: logging_system
scope:
    - '**'
source_files:
    - app/api/weather/route.ts
    - app/history/page.tsx
    - app/result/page.tsx
---

该仓库未引入任何第三方日志框架（如 pino、winston、bunyan、debug 等），也未在 `lib/` 或根目录中定义统一的 logger 模块。当前所有日志输出均直接使用 Node.js /浏览器内置的 `console.error()`，且仅用于记录异常场景：

- `app/api/weather/route.ts`：数据库写入失败时 `console.error("Failed to save route to database:", dbError)`
- `app/history/page.tsx`：加载历史、删除轨迹失败时 `console.error(...)`
- `app/result/page.tsx`：从数据库读取路线、重新查询失败时 `console.error(...)`

这些调用没有统一的前缀、级别、结构化字段（如请求 ID、用户标识、时间戳等），也没有集中路由到文件、远程服务或监控平台。`package.json` 中不存在任何日志相关依赖，`next.config.ts`、`tsconfig.json`、`eslint.config.mjs` 中也未见与日志相关的配置。

因此，本项目目前**不存在成型的日志系统**，仅以零散的 `console.error` 作为调试手段。