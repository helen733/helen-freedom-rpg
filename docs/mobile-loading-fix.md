# 手机加载修复记录 · 2026-09-23

## 原因与证据

用户确认：通过微信、文件管理器或下载文件打开 `index.html`。

旧版本是多文件网页：HTML 通过 `./styles.css` 请求样式，通过模块入口 `./app.js` 加载 `./state.js`。只转发一个 HTML，或在无法读取同目录文件的预览沙箱中打开时，样式文件无法读取，页面退回浏览器默认纯文字排版。中文和结构来自 HTML 本身，因此仍会出现。这不是手机屏幕宽度或 CSS 媒体查询的问题。

本地核查结果：

- 所有源码、manifest、图标均存在于正确目录，名称大小写一致。
- `localhost:4173` 和 `192.168.1.4:4173` 的 HTML、CSS、JS、manifest、图标均为 HTTP 200，Content-Type 正确。
- 单独复制旧 HTML 到空目录后，实际复现背景透明、卡片样式消失。
- 即使保留相邻文件，浏览器直接打开旧版 `file://.../index.html` 时，ES 模块未运行，任务编辑框没有初始化。
- 原页面没有独立加载提示，无法向用户解释失败。

没有访问用户实体手机的网络日志，因此不能判断具体预览器底层返回的是文件不存在还是文件访问权限拒绝；用户确认的打开方式与独立文件复现结果一致。

## 修改清单

| 文件 | 修改 |
| --- | --- |
| `dist/index.html` | 内嵌原有完整 CSS 与打包后的普通脚本，不再依赖相邻 CSS / JS 文件；增加独立诊断入口和静态提示。页面正文、布局、角色和任务内容保留。 |
| `dist/app.js` | 只在 HTTP(S) 安全上下文注册 Service Worker；注册失败和后续缓存安装失败均显示可持续查看的诊断。 |
| `dist/load-check.js`（新增） | CSS / JS 加载与运行诊断；本地文件模式提醒。此脚本也内嵌到 HTML，主程序失败时仍能显示提示。 |
| `dist/sw.js` | 缓存升级为 `helen-rpg-v0.1-2`；按自包含首页缓存必需资源；网络 404 / 5xx 时使用可用缓存。 |
| `scripts/build.mjs`（新增） | 零依赖打包与一致性检查；保留 CSS / JS 可维护源文件。 |
| `server.mjs` | 启动前自动打包，防止生成的 HTML 落后于源码。 |
| `package.json` | 增加 build、check 和加载测试命令。 |
| `tests/loading.browser.mjs`（新增） | 覆盖单文件、本地文件、404、CSS / JS 缺失、禁用脚本、子目录与 PWA 离线场景。 |
| `README.md`、本文件 | 更新正确打开方式、维护流程与排查说明。 |

`dist/styles.css` 的设计内容没有修改；`dist/state.js` 的游戏规则、存档键和数据结构也未修改。manifest 与图标文件检查正确，保留原配置。

## 完整项目结构

```text
海伦自由人生 RPG/
├── .gitignore
├── package.json
├── README.md
├── server.mjs
├── 启动应用.cmd
├── dist/                         ← 完整静态交付目录
│   ├── index.html                ← 自带 CSS 和 JS，可单独显示
│   ├── styles.css                ← 原有样式源码
│   ├── app.js                    ← 原有应用源码
│   ├── state.js                  ← 原有规则源码
│   ├── load-check.js             ← 加载诊断源码
│   ├── sw.js
│   ├── manifest.webmanifest
│   ├── icon.svg
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── scripts/
│   └── build.mjs
├── tests/
│   ├── state.test.mjs
│   ├── browser.mjs
│   └── loading.browser.mjs
├── docs/
│   ├── mobile-loading-fix.md
│   └── superpowers/plans/
│       └── 2026-09-22-v01.md
└── artifacts/                    ← 本机测试截图与复现证据，不部署
```

## 手机正确打开

1. 电脑双击 `启动应用.cmd`，或在项目目录执行 `npm start`；保持启动窗口运行。
2. 电脑、手机连接同一 Wi-Fi。
3. 在手机 Safari / Chrome 地址栏输入启动窗口中的局域网地址。目前为 `http://192.168.1.4:4173/`。地址变化时以窗口显示为准。
4. 不要在手机使用 `localhost:4173`；该地址指手机自身。不要使用微信附件预览作为每日入口。
5. 长期独立使用及添加桌面：将完整 `dist/` 内容部署到 HTTPS 静态地址。根目录与 `/helen/` 等子目录均可；子目录须使用末尾斜杠或明确的 `index.html` 路径。
6. iPhone 用 Safari 分享菜单“添加到主屏幕”；安卓在浏览器菜单“安装应用 / 添加到主屏幕”。首次联网加载并缓存完成后可离线使用。

只发 `index.html` 现在不会因为缺少旁边的 CSS 而丢失设计，但文件预览器可能禁止 JavaScript 或持久化存储。HTML 无法绕过这些宿主限制。完整 PWA 必须通过受支持浏览器的 HTTPS 地址使用，不能从微信附件安装。

## 验证范围

- 已验证独立 HTML、本地 `file://`、网络 CSS / JS 404 时原有样式与任务交互正常。
- 已验证 CSS / JS 被移除及 JavaScript 被禁用时，诊断提示可见。
- 已验证 PWA manifest 的浏览器解析、PNG 图标、子目录 scope、离线缓存及 503 回退；安装图标缺失时会明确显示 PWA 安装失败提示。
- 390px 手机与 1440px 桌面修复前后截图逐字节一致；原始 `styles.css` 逐字节未变。
- 原有游戏规则及全部交互继续通过回归测试。
- 测试采用移动尺寸的 Chromium / Edge 浏览器环境；没有把模拟器测试当成实体 iPhone / 安卓安装实测。
