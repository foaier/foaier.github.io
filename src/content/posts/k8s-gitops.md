---
title: "GitOps 是让 GitHub 自动 SSH 吗？先把部署的职责拆开"
date: "2026-11-24"
summary: "区分 Actions 构建发布与集群侧持续协调，并练习可审查的变更流程。"
series: "Docker 与 Kubernetes"
order: 41
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-etcd-upgrades"]
goals: ["为镜像更新画出 CI 与 GitOps 的职责边界，以及可审查的回滚路径。"]
---

CI 把镜像推到 GHCR 后，为什么它没自动出现在 kind 里？构建发布和部署是两段工作。把权限与变更记录分开，能减少长期集群凭证落进 CI 的风险。

## 构建镜像与协调部署各自负责一段

CI 通常负责测试、构建、扫描并产出不可变标签或 digest。GitOps controller 部署在集群侧，持续比较 Git 声明与运行状态并协调差异。开发者通过 PR 更新镜像版本，审核通过后 controller 同步。Flux 与 Argo CD 是常见实现，不是 GitHub Actions 的另一个名字。

本仓库 workflow 发布课程 GHCR 镜像，不部署生产集群。kind 用本机镜像和 kubectl。上 GitOps 前要设计 repo 读取权限、secret、分支保护、漂移告警和人工回滚，而不是把管理员 kubeconfig 存进 Actions。

## 对上代码、镜像和当前部署

下面两条读文件和 Git 历史的命令在**整站仓库根目录**执行；源码压缩包不是 Git 仓库，可以改为[在线查看 workflow](https://github.com/foaier/foaier.github.io/blob/main/.github/workflows/container-course.yml)。集群仍选 kind-course。先读触发条件和权限，再看 Deployment 的镜像版本。

~~~powershell
Get-Content .github/workflows/container-course.yml
kubectl -n container-course get deployment course-api -o jsonpath="{.spec.template.spec.containers[0].image}"
git log -5 --oneline -- examples/container-course .github/workflows/container-course.yml
~~~

## 怎么确认做对了

Actions 只有 GHCR 写包权限，没有集群管理员权限；当前 Deployment 为手动 manifest 管理。CI 绿灯只证明 workflow 声明的步骤通过，不代表域名、数据库迁移与线上服务已验证。

## 留一个小练习

设计镜像交付链：CI 产出 SHA/digest，PR 更新部署仓库，controller 用只读 repo 权限同步，监控验证健康，失败时以新的 PR 回滚。标明每步是否需要人工审批和什么敏感凭证。

## 没跑通时先查什么

Git 与集群不一致，先查 controller 的 branch/path、commit、同步错误和权限，再看应用 rollout。不要让 kubectl 与 controller 同时维护同一 Deployment。

持续协调让意外的手工改动被恢复到 Git 记录状态，这是预期行为；紧急修复后也要尽快把合法变更提交回仓库。不把 Git 当唯一记录仍需维护的内容，例如外部数据库迁移、证书授权和密钥轮换，需要各自有审计路径。

## 参考资料

- [OpenGitOps 原则](https://opengitops.dev/)
- [Actions 安全强化](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Flux 文档](https://fluxcd.io/flux/)
