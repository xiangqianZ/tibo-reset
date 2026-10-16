# tibo · 28 天更新日历

适合微信公众号内打开的 H5，整理 [tibo / @thsottiaux](https://x.com/thsottiaux) 的 28 天计划公告。页面使用奶油白、暖橙色和卡片日历，仅保留日期选择、同页分类筛选和每日详情。

## 当前内容状态

**尚未填入真实公告。** 用户指定通过 RSSHub 的 `/twitter/user/thsottiaux` 获取。当前云环境的 `localhost:1200` 没有服务监听（IPv4、IPv6 均连接失败）；如果 RSSHub 运行在个人电脑，云环境的 localhost 无法访问它。原先的虚构演示内容及日期已移除，未核实的日子显示「待核实」，不会按日期流逝自动变成已发布。

RSSHub 导入命令已经实现，支持 URL 和离线 XML。提供当前云环境可访问的 RSSHub 地址或实际 XML 后，即可继续核实原文并填入日历。此前直连 X 也返回代理 403，网络域名已保存到配置草稿；保存草稿不代表运行实例网络已经更新。

## 开发与检查

使用 Node.js 22.12+，推荐 Node.js 24。无需数据库或密钥，运行时字体、图标和插画都随页面一起部署。

```bash
npm ci
npm run dev       # 开发服务器，5173 端口
npm run import:rss # 读取 RSSHub 并保留原文归档
npm test          # 日期、来源校验和待核实状态
npm run build    # 类型检查与生产构建
npm run preview  # 本地生产预览
npm run test:e2e # 构建并运行桌面与手机浏览器测试
```

浏览器测试复用 `/usr/bin/chromium`；其他机器可执行 `npx playwright install chromium`，或用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定路径。

## 从 RSSHub 获取推文

在能访问 RSSHub 的机器上执行：

```bash
# 默认读取 http://localhost:1200/twitter/user/thsottiaux
npm run import:rss

# RSSHub 位于其他地址时，填写当前机器能访问的完整订阅 URL
npm run import:rss -- --url 'https://你的RSSHub地址/twitter/user/thsottiaux'

# 也可以先把该订阅保存成 XML，再离线导入
npm run import:rss -- --file /path/to/thsottiaux.xml
```

也支持 `RSSHUB_URL` 环境变量；`--url` 优先。默认归档至 `data/thsottiaux-rss.json`，可用 `--output` 改变路径。导入会保留推文原文、原始发布时间、北京时间日期和规范化的原帖 URL；同一帖子去重，重复执行时合并历史，避免 RSS 只返回最近条目导致旧记录丢失。HTTP 错误、空订阅或无效 XML 不覆盖已有归档。

只收录原始链接可确认属于 `@thsottiaux` 的帖子；转帖带有标记供后续审核。导入仅归档原文，不会把回复、转帖、猜测或预告自动标记为已上线功能。读取实际推文后，再根据原文核对 28 天计划的开始日期、更新类别和发布状态，填写下节的数据。

公众号访客不会请求 `localhost:1200`，网站仍然发布静态内容。RSSHub 仅用于维护阶段获取来源；其最近条目不一定覆盖整个 28 天，较早公告仍需历史 RSS 或原始记录。

## 录入核实后的公告

编辑 `src/data/plan.ts`，先核实 `planConfig.startDate`（`YYYY-MM-DD`），再按计划天数将公告写入 `verifiedContent`。每条已发布或已预告记录必须有原始来源及实际发布时间，缺少来源时构建数据模型会明确报错。

字段说明：

- `category`：`reset` 全局重置、`card` 重置卡、`update` 功能更新。
- `title`、`summary`、`changes`：根据原文整理的中文标题、摘要和变化条目。
- `publicationStatus`：`published` 已发布、`scheduled` 官方已预告、`unverified` 未核实。
- `sources`：原始帖子 URL、`publishedAt` 实际发布时间、`title` 原文标题或摘录。

明确区分“功能已经发布”和“官方已经预告”，不把推测或没有公告的日期写成更新。原始时间保留时区；页面进度以 Asia/Shanghai 为准。

## 部署到公众号

执行 `npm run build`，将 `dist/` 的全部内容上传到 HTTPS 静态托管服务。支持根目录或 `/tibo/` 等子目录部署，子目录地址保留末尾 `/`。

根据公众号已开通的能力，将正式 HTTPS 地址配置到自定义菜单网页链接或文章「阅读原文」。H5 交互代码作为独立网页运行。上传后再用真实 iOS / Android 微信检查展示和日期详情。
