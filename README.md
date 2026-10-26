# 今天吃什么｜午餐选择器

保留午餐推荐、定位、天气、附近餐饮和午餐手账功能。本地版使用 SQLite 保存记录，不需要 Cloudflare 或 ChatGPT 账号。

## 本地部署

安装 Node.js 22.13 或更高版本（推荐 Node.js 24），在项目目录运行：

```sh
npm install
npm run build
npm start
```

Windows 也可以双击 `start-local.cmd` 启动（首次使用需安装 Node.js 和依赖）。

打开 http://localhost:3000 。开发时使用 `npm run dev`。也可以使用 pnpm 安装并运行同名命令。

服务默认只监听本机，关闭终端即停止。记录保存在 `data/lunch.sqlite`，重启后保留。备份前停止服务并复制整个 `data` 文件夹。不同浏览器通过设备 Cookie 区分记录，清除 Cookie 后不会再显示原有记录。

可复制 `.env.example` 为 `.env.local` 并设置 `LUNCH_DB_PATH` 更换数据库位置。数据库、环境文件和个人记录不应上传到 GitHub；项目已包含忽略规则。线上原数据库的数据不会自动迁移。

天气和城市查询使用 Open-Meteo，附近餐饮使用 OpenStreetMap Overpass，需要联网。浏览器定位需要授权；餐饮服务无结果时会使用原有示例数据。

## GitHub

在 GitHub 创建空仓库后，在本目录运行（替换为实际仓库地址）：

```sh
git init -b main
git add .
git commit -m "Add locally deployable lunch picker"
git remote add origin https://github.com/M1-NGC1952/EAT-WHAT.git
git push -u origin main
```

GitHub 托管源码。本项目包含服务端接口和数据库，GitHub Pages 无法运行完整功能。

