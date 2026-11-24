---
title: GitOps 是让 GitHub 自动 SSH 吗？先把部署的职责拆开
date: '2026-11-24'
summary: 区分 Actions 构建发布与集群侧持续协调，并练习可审查的变更流程。
series: Docker 与 Kubernetes
order: 41
tags:
  - Kubernetes 进阶
  - Docker
  - Kubernetes
level: Kubernetes 进阶
prerequisites:
  - k8s-etcd-upgrades
goals:
  - 为镜像更新画出 CI 与 GitOps 的职责边界，以及可审查的回滚路径。
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

## 并排检查 Git 期望状态和集群当前状态

第一条显示 Git 中渲染的声明，第二条显示集群现状，第三条查看部署模板修订。若手工 scale 后同步又改回去，说明 Git 仍声明旧副本数。把需要保留的变更提交回仓库，让一个来源负责期望状态。

~~~powershell
kubectl kustomize k8s
kubectl -n container-course get deployment course-api -o yaml
kubectl -n container-course rollout history deployment/course-api
~~~

## CI、镜像仓库和 GitOps 各负责一段

| 环节 | 典型负责人 | 产物或状态 |
|---|---|---|
| CI | GitHub Actions 等 Runner | 测试报告、镜像 digest、供应链元数据 |
| 镜像仓库 | GHCR 或企业 Registry | 可拉取的不可变制品 |
| 部署仓库 | 平台/应用团队 | 环境期望版本、YAML/Chart/values |
| GitOps controller | 集群内 Flux、Argo CD 等 | Git 与实际集群状态的持续对账 |
| 运行验收 | 业务与平台团队 | rollout、健康请求、告警和回滚证据 |

CI 把镜像发布成功，不代表集群已经部署；GitOps 对账成功，也不代表请求链路和数据迁移正确。每一段都需要独立的权限和验收条件。

## 漂移为什么会被自动改回去

GitOps controller 周期性读取受信任分支的期望对象，与 live state 做比较。手工 kubectl scale 造成副本数不同后，controller 会再次应用 Git 里的副本数；这不是随机覆盖，而是声明式控制的核心行为。事故中的临时修复要记录，并通过 PR 把长期需要的状态提交回配置仓库。

敏感值不应以明文进入 Git。常见做法包括外部 Secret controller、加密后提交的 Secret 文件或云端身份短期取密；具体选型要验证密钥轮换、审计和恢复流程。Git 只读权限也要限制到必要仓库和分支。

## 上线前设计一条能回滚的变更路径

新版本镜像先由 CI 产出 SHA 标签和 digest；PR 更新部署仓库中的镜像引用、资源和配置；审查通过后 controller 同步；发布后观察 Deployment condition、就绪副本、错误率和真实请求。失败时回滚配置提交或提交一个指向旧 digest 的新变更，保留完整审计历史。

集群 controller 失联时已有工作负载可能继续运行，但新变更和漂移修复停滞。应监控最近同步时间、错误状态、仓库认证和 API 访问；恢复后先检查差异再让它自动协调，避免一次性应用过多积压变更。

## 参考资料

- [OpenGitOps 原则](https://opengitops.dev/)
- [Actions 安全强化](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Flux 文档](https://fluxcd.io/flux/)
