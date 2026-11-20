# Foaier · 个人技术博客

基于 Next.js、React 和 TypeScript 构建，并以静态文件发布到 GitHub Pages。

## 本地开发

安装 Node.js 22 或更新版本，然后运行：

    npm ci
    npm run dev

开发服务器默认地址为 http://localhost:3000。

## 发布文章

在 src/content/posts 目录新增 Markdown 文件，例如 2026-data-migration.md：

    ---
    title: 数据迁移中的校验策略
    date: 2026-11-18
    summary: 文章摘要
    tags:
      - 数据迁移
      - 工程实践
    ---

    从这里开始写正文。

`series` 与 `order` 为可选字段，例如在 Agent 开发系列追加文章时填写 `series: Agent 开发`，并为 `order` 使用该系列下一个序号。同一系列的序号应连续且不重复；普通随笔不填写这两个字段，归入“工程笔记”。文章页支持目录、阅读时长、代码高亮与复制、表格和系列前后篇导航。文章列表支持按系列筛选，以及搜索标题、简介与标签。

发布前运行 `npm run content:check`、`npm run lint`、`npm run typecheck` 和 `npm run build`。

推送到 main 后，GitHub Actions 会检查并构建站点，再自动部署到 GitHub Pages。
Pull Request 会运行相同的检查和构建，但不会部署。

## GitHub Pages 设置

在仓库 Settings → Pages 中，将 Build and deployment 的 Source 设为 GitHub Actions。
静态构建产物位于 out 目录，站点地址为 https://foaier.github.io/。

简历保留在 public/resume/index.html，可通过 /resume/ 访问。
