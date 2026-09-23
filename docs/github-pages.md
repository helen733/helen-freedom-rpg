# GitHub Pages：最短配置步骤

当前状态：项目和自动部署工作流已经准备好；尚未创建 GitHub 仓库或发布 Pages。账号配置与首次上传由你操作。

## 1. 创建仓库并上传

在 GitHub 新建一个 **Public** 仓库，建议名称 `helen-freedom-rpg`，默认分支使用 `main`。公共仓库适合使用免费的 GitHub Pages；上传的是应用代码，不包含手机里的个人存档。

项目根目录的 `github-pages-upload.zip` 是上传用源码包。**先解压，再上传里面的文件和文件夹，不要直接上传 ZIP 文件。**

在空仓库点击 **uploading an existing file**，上传解压后的所有内容，提交到 `main`。文件结构必须是：

```text
仓库根目录/
├── .github/workflows/pages.yml
├── dist/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── state.js
│   ├── load-check.js
│   ├── sw.js
│   ├── manifest.webmanifest
│   ├── icon.svg
│   ├── .nojekyll
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── scripts/build.mjs
├── tests/
├── docs/
├── package.json
├── server.mjs
├── README.md
└── 启动应用.cmd
```

务必确认 `.github/workflows/pages.yml` 已上传。若浏览器拖拽漏掉隐藏文件夹，在仓库点 **Add file → Create new file**，文件名输入 `.github/workflows/pages.yml`，粘贴本地同名文件的全部内容并提交。

不要把整个解压目录再套一层上传，也不要只上传 `dist`；自动部署需要根目录的构建脚本和工作流。

## 2. 开启 Pages

1. 仓库 → **Settings → Pages**。
2. **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开仓库 **Actions → Deploy GitHub Pages → Run workflow → main → Run workflow**。
4. 等待 `build` 和 `deploy` 都变为绿色；如果首次上传时 Pages 尚未开启导致失败，在配置完成后重新运行即可。
5. 到 **Settings → Pages** 点击 **Visit site**。默认地址形式为 `https://你的用户名.github.io/helen-freedom-rpg/`，以 GitHub 实际显示的地址为准。

使用默认 `github.io` 地址即可，不需要域名或服务器。若设置页提供 **Enforce HTTPS**，保持勾选。

以后修改代码并提交到 `main` 会自动构建与发布。不需要在电脑上持续运行命令。

## 3. 手机安装

1. 在手机 Safari（iPhone）或 Chrome（安卓）的普通模式打开 Pages HTTPS 地址，不要用微信附件预览。
2. 等页面底部显示 **离线已就绪**。
3. iPhone：分享 → 添加到主屏幕；安卓：浏览器菜单 → 安装应用 / 添加到主屏幕。
4. 从桌面图标重新打开，尝试断网再打开一次。离线资源首次下载完成后，无需电脑或同一 Wi-Fi。

## 原有进度迁移

在原入口“导出存档”，再到新 Pages 入口“恢复存档”。不同网址的本地存储互不相通，不会自动迁移；若手机网页与桌面应用的进度不同，可在桌面应用内恢复同一备份。

## 已检查的兼容性

- `dist` 是完整静态网站，无需后端。
- manifest、图标、Service Worker 全部采用相对路径，适配 `/helen-freedom-rpg/` 仓库子目录。
- Service Worker 在应用目录内注册，支持离线页面和本地存档。
- 工作流只发布 `dist`；测试截图、浏览器资料、Git 元数据和旧托管平台配置不在源码上传包内。
- 原 UI、游戏规则与存档结构保留，没有新增游戏功能。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
