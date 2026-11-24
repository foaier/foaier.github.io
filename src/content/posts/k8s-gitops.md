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

## 概念讲透：它负责什么，不负责什么

GitOps 把期望部署状态存进版本库，由集群中的协调器持续比较 Git 与实际对象并修正漂移。CI 构建、测试和发布镜像；CD/GitOps 控制器拉取声明并协调部署。两者职责不同。只用 GitHub Actions SSH 到服务器也是自动化，但没有持续对账、漂移修复和清晰的配置所有权。

## 运行过程拆解：从输入到结果

协调器周期性拉取 Git 中的目标版本，与集群当前状态比较后应用差异；如果有人手工改了副本数，它会继续把对象拉回仓库声明。这个自动纠偏要求仓库真的是唯一配置来源，否则团队会互相覆盖。把镜像摘要、环境值、资源和权限都纳入审查，秘密通过专用加密或外部管理服务提供。

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

## 案例推演

运维在集群里手工把副本从两份扩到五份，第二天 GitOps 又改回两份。协调器是在恢复 Git 里的期望状态，不是随机覆盖。紧急改动先按事故流程记录，再把需要保留的变更提交回仓库；发布镜像按提交 SHA 或 digest 更新，回滚则把声明指向上一个可用版本。

## 留一个小练习

设计镜像交付链：CI 产出 SHA/digest，PR 更新部署仓库，controller 用只读 repo 权限同步，监控验证健康，失败时以新的 PR 回滚。标明每步是否需要人工审批和什么敏感凭证。

## 没跑通时先查什么

Git 与集群不一致，先查 controller 的 branch/path、commit、同步错误和权限，再看应用 rollout。不要让 kubectl 与 controller 同时维护同一 Deployment。

持续协调让意外的手工改动被恢复到 Git 记录状态，这是预期行为；紧急修复后也要尽快把合法变更提交回仓库。不把 Git 当唯一记录仍需维护的内容，例如外部数据库迁移、证书授权和密钥轮换，需要各自有审计路径。

## 并排检查 Git 期望状态和集群当前状态

第一条显示 Git 中渲染的声明，第二条显示集群现状，第三条查看部署模板修订。若手工 scale 后同步又改回去，说明 Git 仍声明旧副本数。把需要保留的变更提交回仓库，让一个来源负责期望状态。

~~~powershell
kubectl kustomize k8s
kubectl -n container-course get deployment course-api -o yaml
kubectl -n container-course rollout history deployment/course-api
~~~


## 生产里怎么用、怎么排障

GitOps 仓库的写权限就是部署权限，应保护分支、审查变更并分环境隔离凭证。控制器失联时集群已有 Pod 可能继续运行，但新变更和漂移修正会停滞；要监控同步状态与错误。Secret 使用密钥管理或加密方案，不能因为 GitOps 就把生产密码明文提交。

## 参考资料

- [OpenGitOps 原则](https://opengitops.dev/)
- [Actions 安全强化](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [Flux 文档](https://fluxcd.io/flux/)
