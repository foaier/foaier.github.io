# 杨乘峰 · 个人技术博客

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

推送到 main 后，GitHub Actions 会检查并构建站点，再自动部署到 GitHub Pages。
Pull Request 会运行相同的检查和构建，但不会部署。

## GitHub Pages 设置

在仓库 Settings → Pages 中，将 Build and deployment 的 Source 设为 GitHub Actions。
静态构建产物位于 out 目录，站点地址为 https://foaier.github.io/。

简历保留在 public/resume/index.html，可通过 /resume/ 访问。
