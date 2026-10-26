# 今天吃什么｜午餐选择器

结合定位、天气和附近餐饮快速决定午餐。可在本机运行，也可免费部署到 Vercel；不需要 Cloudflare、数据库或 API 密钥。

## 本地启动

安装 Node.js 22.13 或更高版本（推荐 Node.js 24），在项目目录运行：

```sh
npm install
npm run build
npm start
```

打开 http://localhost:3000 。开发时使用 `npm run dev`，Windows 可双击 `start-local.cmd`。

## Vercel 免费部署

1. 使用个人 Vercel Hobby 账号，登录 https://vercel.com/new 。
2. 导入 GitHub 仓库 `M1-NGC1952/EAT-WHAT`，如提示则授权 Vercel 访问该仓库。
3. 项目名建议 `eat-what`（最终名称取决于可用性），框架 Next.js，根目录 `./`，Node.js 24.x。仓库已包含构建配置，无需填写环境变量。
4. 点击 Deploy，等待 Ready，然后使用项目 Domains 中的生产域名分享。不要分享单次预览部署的网址。
5. 确认 Git 设置的 Production Branch 为 `main`。以后推送 main 会自动部署；部署成功后，刷新原生产网址即可看到新版。没有推送或部署失败时，线上不会更新。

不要更换项目域名，否则浏览器中的手账不会自动转移到新域名。先用大陆手机流量和 Wi-Fi 分别测试首页、地点搜索、天气、午餐选择及手账。Vercel 在大陆的连通性不作保证；Hobby 适用于个人非商业用途，受免费额度限制。

## 手账保存

手账保存在当前浏览器的 localStorage，不上传到云端，不需要登录或付费数据库。刷新、重新打开、正常发布新版本后记录仍保留。不同手机、浏览器、微信内置浏览器和域名之间不共享数据；清理网站数据或退出无痕模式可能导致数据丢失。

之前版本的 SQLite 或原 Sites 云数据库记录不会自动迁移。当前版本不再使用 `/api/lunches` 和本地数据库。

## 外部服务

天气和城市查询经服务端访问 Open-Meteo；附近餐饮经服务端访问 OpenStreetMap Overpass。两者需要联网，无服务商密钥。浏览器定位需授权；附近餐厅无真实结果时展示标注为示例的候选餐厅。免费版不提供外卖下单或配送服务。

## 后续修改

在 Codex 中指定仓库 https://github.com/M1-NGC1952/EAT-WHAT 提出修改需求。修改、验证并推送 main 后，由 Vercel 的 GitHub 集成部署。构建日志和最终上线状态在 Vercel 的 Deployments 中查看。
