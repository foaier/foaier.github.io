---
title: "做一次完整演练：把 API 从源码带到可检查的集群"
date: "2026-11-24"
summary: "串起镜像、配置、发布、排错与数据边界，写一份自己的容器运行清单。"
series: "Docker 与 Kubernetes"
order: 42
tags: ["Kubernetes 进阶","Docker","Kubernetes"]
level: "Kubernetes 进阶"
prerequisites: ["k8s-gitops"]
goals: ["独立构建课程 API、部署到 kind、验证写入并收集故障证据。"]
---

到这里每一块工具都见过了。综合练习不要求把所有云产品装进电脑，而是完成闭环：输入是什么、部署后如何验证、失败时第一条证据在哪儿、实验后数据有没有保留。

## 概念讲透：它负责什么，不负责什么

综合链路包含源码、镜像、配置、控制器、Service、存储、观测和恢复。每一层的绿色状态只证明局部条件：镜像能构建不等于业务可用，Pod Ready 不等于数据可恢复，备份命令成功也不等于恢复成功。最终验收应从用户请求和故障恢复两个角度走通。

## 运行过程拆解：从输入到结果

把完整发布链画成源码提交 → CI 测试 → 镜像摘要 → 配置与 Secret → Deployment → Ready Pod → Service 后端 → 用户请求，再加数据库卷和备份恢复支线。每个箭头都有失败信号和责任人。综合演练要人为制造一个可控错误、保留证据、修复、验证并复盘；否则只跑一次成功路径，尚未证明自己会处理生产问题。

## 先定清这次演练的完成标准

Pull Request workflow 会编译并构建镜像；main push 发布带提交号的 GHCR 镜像。kind 用本地标签验证声明、Service、探针和卷。两种环境目标不同：本地运行通过，不代表公网入口、云卷、证书和私有仓库凭证已经配置。

完成标准是镜像可追溯、Secret 不进 Git、工作负载有 requests 与探针、数据库数据放 PVC 并理解 PVC 仍需独立备份、权限有范围。每一步留一条验证和失败恢复方法。

## 从镜像到数据库，把链路走完

确认 context 为课程 kind，再 build/load 本地镜像，应用 Kustomize overlay。按照前面步骤先创建虚构的 course-db Secret。验证 API 与数据库 rollout，端口转发后检查 readiness，写入再读取记录。

~~~powershell
kubectl config current-context
kubectl apply -f k8s/00-namespace.yaml
kubectl -n container-course create secret generic course-db --from-literal=password=course-local-only # 只在首次创建时执行
docker build -t container-course-api:local .
kind load docker-image container-course-api:local --name course
kubectl apply -k k8s
kubectl -n container-course rollout status deployment/postgres --timeout=180s
kubectl -n container-course rollout status deployment/course-api --timeout=180s
kubectl -n container-course port-forward service/course-api 8080:80
~~~

## 怎么确认做对了

API 两副本 Ready，Service 有后端，PVC Bound，health/ready 返回 ready，演示记录可读。port-forward 在第一个终端保持运行；再开一个 PowerShell 请求就绪地址，并用 POST 写入、GET 查询虚构记录。Git 中清单与当前 image tag 对得上。

## 案例推演

一次发布换了 API 镜像，Pods Ready，但用户写入时报数据库连接失败。沿版本号确认镜像，再查 Secret 引用和应用配置，验证 Service DNS、数据库 Pod 与 PVC，最后做真实 POST/GET。修复后回顾为何健康检查没有发现这个问题，并补充能覆盖业务依赖的就绪判断和告警。

## 留一个小练习

模拟本地镜像标签错误或配置引用名错误，记录 Events、修复和验证。写半页值班笔记：版本辨认、日志、数据库健康、谁能管理 Secret、哪些变更能回滚、PVC 和备份分别在哪儿。

## 没跑通时先查什么

从压缩包开始需先创建 kind 和 Secret；apply -k 不会自动构建镜像。8080 冲突先停 Compose 或改本机映射端口。结束前确认 context 和资源归属仍是 kind-course。

自检：两个 API Ready；删一个后能恢复；数据库 Pod 重建后能读回记录；镜像有版本；密码未提交；另一位读者能按文档重复验证。本地 PVC 不代替独立备份演练。

## 生产里怎么用、怎么排障

上线评审至少要回答：镜像如何追溯、配置和密钥如何轮换、失败如何止损、数据库如何备份恢复、容量不足谁处理、告警谁接、回滚会不会破坏数据。把演练结果写成运行手册并由另一位同事照着执行。kind 的成功只证明本地练习链路通，云负载均衡、真实存储和集群高可用仍需在目标环境单独验证。

## 参考资料

- [kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [生产环境规划](https://kubernetes.io/docs/setup/production-environment/)
- [Docker GitHub Actions](https://docs.docker.com/build/ci/github-actions/)
