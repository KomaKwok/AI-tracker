# AI Radar

AI Radar 是一个用于追踪 AI 产品官方更新动态的 MVP 工具。它的目标不是做泛 AI 新闻聚合，而是围绕官方 release notes、changelog、RSS 等一手更新渠道，持续输出可用于分析判断的结构化信号。

## 产品定义

AI Radar 将“AI 动态追踪”定义为对以下官方更新渠道的持续监测：

- 官方 release notes
- 官方 changelog
- 官方 RSS / Atom feed
- 官方帮助中心或产品更新页

当前版本有意避免二手聚合。如果某个来源当前无法访问、没有更新或抓取失败，系统会直接记录状态，而不会伪造内容。

## 当前接入的数据源

当前版本只保留以下 4 个目标源：

- Claude Release Notes
- OpenAI News RSS
- OpenAI API Changelog
- Gemini API Changelog

说明：

- `OpenAI News RSS` 与 `Claude Release Notes` 当前相对稳定
- `Gemini API Changelog` 在部分网络环境下可访问，但 Node 运行时可能超时
- `OpenAI API Changelog` 在部分环境下仍可能返回 `403`

## 项目结构

- `app/`: Next.js 15 App Router 页面与接口路由
- `components/`: 可复用 UI 组件
- `lib/data/`: 本地 JSON 存储与来源配置
- `lib/radar/`: 抓取流程、评分、趋势汇总与导出逻辑
- `lib/ai/`: 摘要与标签生成逻辑，支持启发式回退
- `scripts/seed.ts`: 初始化本地数据
- `scripts/fetch.ts`: 手动执行抓取

## 技术方案

- 框架：Next.js 15 App Router
- 语言：TypeScript
- 样式：Tailwind CSS
- 存储：本地 JSON store

之所以使用本地 JSON，而不是 Prisma / SQLite，是为了降低笔试演示成本，保证项目开箱即用，并保留后续替换为数据库层的空间。

## 抓取策略

当前版本采用“官方优先、结构化优先”的抓取策略：

1. 优先尝试官方 RSS / Atom feed
2. 若无 feed，则尝试官方 changelog / release notes HTML
3. 若主入口失败，则尝试官方 fallback URL
4. 若仍失败，则在 Sources 页面记录失败原因

系统不会因为抓不到内容而自动回退到伪造数据。

## 评分逻辑

当前版本统一以 `signalScore` 作为用户可见主评分。评分由四个维度组成：

1. 来源直接性
2. 更新强度
3. 时效性
4. 分析相关性

其中：

- 来源直接性：衡量该信息离官方产品动作有多近
- 更新强度：衡量该更新是否属于真正重要的产品变更
- 时效性：衡量发布时间距当前有多近
- 分析相关性：衡量其对产品分析和商业判断是否有价值

页面展示、排序和重点雷达模块均统一使用 `signalScore`，避免多套评分标准造成理解混乱。

## 页面功能

### Dashboard

- 展示来源覆盖数、最近更新时间、近 24 小时 / 7 天新增信号数
- 展示“今日 / 本周更新”
- 展示“重点雷达”
- 展示趋势摘要
- 支持手动刷新

### Signals

- 展示全部归一化后的信号流
- 支持按区域、来源类型、标签、时间范围筛选
- 支持按时间或综合评分排序

### Sources

- 展示当前已配置来源
- 展示抓取方式、优先级、最近抓取时间
- 展示成功 / 空结果 / 失败状态
- 展示失败原因，便于说明当前环境限制

### Method

- 说明工具如何定义“AI 动态追踪”
- 说明评分逻辑
- 说明为什么优先官方更新页而不是普通新闻

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 初始化数据

```bash
npm run seed
```

3. 启动开发环境

```bash
npm run dev
```

4. 手动执行抓取

```bash
npm run fetch
```

启动后访问：

- [http://localhost:3000](http://localhost:3000)

## 刷新与导出

每次执行 `npm run seed` 或 `npm run fetch` 后，系统会自动生成：

- `data/exports/latest-links-zh.md`
- `data/exports/latest-links.json`

其中：

- `latest-links-zh.md` 是中文阅读包，适合进一步交给其他 AI 工具做总结
- `latest-links.json` 是结构化原始结果，可用于后续处理

## 环境变量

如需启用可选能力，可在 `.env.local` 中配置：

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
CRON_SECRET=your-secret
```

说明：

- `OPENAI_API_KEY`：启用 OpenAI 接口生成摘要与标签建议
- `OPENAI_MODEL`：指定摘要模型
- `CRON_SECRET`：保护定时抓取接口

## 定时任务

项目内置了 cron 兼容接口：

- `GET /api/cron/fetch`

若配置了 `CRON_SECRET`，则需要携带请求头：

- `x-cron-token: $CRON_SECRET`

`vercel.json` 示例：

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## 当前限制

- 不同官方站点在不同网络环境下可能返回 `403`、超时或访问限制
- 当前最稳定的公开源并不完全一致，受网络节点影响较大
- 部分页面虽然浏览器层面可访问，但 Node 抓取层面仍可能不稳定
- 当前版本更适合作为“官方更新情报工具 MVP”，而不是大规模爬虫平台
- 若未配置 `OPENAI_API_KEY`，摘要与标签将使用启发式回退逻辑

## 推荐交付方式

如果需要对外展示，推荐：

1. 部署到 Vercel
2. 将在线链接与说明文档一起发送
3. 同时附上源码压缩包作为补充材料

这样既方便业务人员直接查看，也便于技术同事检查实现细节。
