# Foaier · 个人技术博客

基于 Next.js、React 和 TypeScript 构建，并以静态文件发布到 GitHub Pages。

## AI 学习路线

`/learn/` 提供 8 个阶段的学习路线，包含 17 篇推荐入门文章，以及记忆、Skills、MCP、模型接入、工作流等选读专题。课程主线使用 C# / .NET 10。每篇包含学习目标和前置文章，实操专题配有运行方法、结果说明与排错。

课程源码位于 `examples/ai-course/`，使用说明见其中的 README。`npm run examples:pack` 生成只含源码的 `public/downloads/ai-course.zip`，构建时自动执行。下载包不手工维护，不收录编译产物、凭证或实验状态。

## Docker 与 Kubernetes 学习路线

访问 `/containers/` 学习 24 篇 Docker 教程和 31 篇 Kubernetes 教程。Docker 从基础概念、命令讲解开始，包含 Nginx/Tomcat、MySQL、Redis、Dockerfile、Java + Compose、主从复制、Redis 集群、Portainer、监控与 Actions 实验。Kubernetes 从 kind 集群和 Nginx 开始，逐步练习对象、探针、存储、权限、网络、监控、日志、kubeadm、备份恢复与 GitOps，最后完成 ASP.NET Core API + PostgreSQL 综合实验。整条路线使用 Bash。

Docker 源码位于 `examples/docker-labs/`，Kubernetes 分课实验位于 `examples/k8s-labs/`，综合项目位于 `examples/container-course/`。`npm run container:pack` 生成三个同名 ZIP，放在 `public/downloads/`；构建时自动执行。压缩包不包含编译产物、课程外密钥或本地数据。

## 本地开发

首页包含像素风坦克大战，50 关分为五大战区，逐步增加敌军数量、兵种和火力。支持方向键 / WASD 移动、空格 / J 开火、P 暂停，以及手机双手触控。通关进度、最高单关分数和音效设置保存在当前浏览器。

游戏逻辑与地图位于 `src/lib/tank-game/`，界面位于 `src/components/tank-battle.tsx`。运行 `npm run game:check` 可检查 50 关地图连通性、敌军寻路、碰撞、补给和通关存档；GitHub Actions 也会执行这些检查。

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

普通随笔可省略 `series` 和 `order`，归入“工程笔记”。课程文章的系列名称来自 `src/content/curriculum.json`，填写该系列下连续且不重复的 `order`，并提供 `level`、`goals`（目标数组）和 `prerequisites`（前置文章 slug 数组，可为空）。前置知识不能形成循环。学习路线的起始篇和推荐篇也在 curriculum 中维护。

文章页支持目录、阅读时长、代码高亮与复制、表格和系列前后篇导航。文章列表支持按系列筛选，以及搜索标题、简介与标签。教程先说明解决什么问题，再给准备条件、步骤、预期结果、小练习和排错；保留官方参考资料，区分实测结果、可编译示例和需要读者配置的云端能力。

发布前运行 `npm run content:check`、`npm run lint`、`npm run typecheck` 和 `npm run build`。

推送到 main 后，GitHub Actions 会检查文章、构建站点，并编译 .NET 示例、运行不需要密钥的检查；两个任务都成功后才部署到 GitHub Pages。
Pull Request 会运行相同的检查和构建，但不会部署。

## GitHub Pages 设置

在仓库 Settings → Pages 中，将 Build and deployment 的 Source 设为 GitHub Actions。
静态构建产物位于 out 目录，站点地址为 https://foaier.github.io/。

简历保留在 public/resume/index.html，可通过 /resume/ 访问。
